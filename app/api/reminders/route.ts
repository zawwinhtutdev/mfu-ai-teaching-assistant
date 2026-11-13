import { NextResponse } from "next/server"
import { isNotificationsTableMissing, queueReminderNotificationJobs } from "@/lib/server/notification-jobs"
import { logAuditEvent } from "@/lib/server/audit-log"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

/**
 * Study reminders.
 *
 * Authenticated with `supabase.auth.getUser()` only, so demo accounts saw an
 * empty Reminders page even after the deadline scheduler had created reminders
 * for them. Identity now comes from `resolvePrincipal`, which understands both
 * a real Supabase session and a demo cookie.
 */

export async function GET() {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await clientForPrincipal(principal)

    // Reminders are per-student. A teacher or admin asking has no personal
    // reminder list, and returning an empty array is more useful than either a
    // 403 or somebody else's rows.
    if (!principal.isPersistable) {
      return NextResponse.json({ reminders: [] })
    }

    const { data: reminders, error } = await supabase
      .from("study_reminders")
      .select("id, student_id, course_id, reminder_text, reminder_time, is_completed, created_at, courses(title, code)")
      .eq("student_id", principal.userId)
      .order("reminder_time", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reminders: reminders || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load reminders" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (principal.role !== "student") {
      return NextResponse.json({ error: "Only students can create reminders" }, { status: 403 })
    }

    // A demo student has no profile row, so the reminder could not be stored.
    // Say that plainly instead of letting a foreign-key error surface later.
    if (!principal.isPersistable) {
      return NextResponse.json(
        { error: "Demo accounts cannot save reminders. Sign in with a real university account." },
        { status: 403 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const reminderText = String(body?.reminderText || "").trim()
    const courseId = String(body?.courseId || "").trim()
    const lineEnabled = !!body?.lineEnabled
    const reminderTimeRaw = String(body?.reminderTime || "")
    const reminderDate = new Date(reminderTimeRaw)

    if (!reminderText) {
      return NextResponse.json({ error: "Reminder text is required" }, { status: 400 })
    }

    if (!courseId) {
      return NextResponse.json({ error: "Course is required" }, { status: 400 })
    }

    if (Number.isNaN(reminderDate.getTime())) {
      return NextResponse.json({ error: "Invalid reminder time" }, { status: 400 })
    }

    if (reminderDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Reminder time must be in the future" }, { status: 400 })
    }

    // Accepts a course code or uuid, then confirms this student is enrolled.
    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 })
    }

    const supabase = await clientForPrincipal(principal)
    const reminderTime = reminderDate.toISOString()

    const { data: reminder, error: reminderError } = await supabase
      .from("study_reminders")
      .insert({
        student_id: principal.userId,
        course_id: course.id,
        reminder_text: reminderText,
        reminder_time: reminderTime,
      })
      .select("id, student_id, course_id, reminder_text, reminder_time, is_completed, created_at, courses(title, code)")
      .single()

    if (reminderError || !reminder) {
      return NextResponse.json({ error: reminderError?.message || "Failed to create reminder" }, { status: 500 })
    }

    try {
      const queuedJobs = await queueReminderNotificationJobs({
        supabase: supabase as any,
        userId: principal.userId,
        // Resolve the destination here, where the profile is already in scope.
        // The processor cannot look it up without a service-role client.
        email: principal.email,
        courseId: course.id,
        reminderId: reminder.id,
        reminderText,
        reminderTime,
        lineEnabled,
      })

      return NextResponse.json({
        reminder,
        queuedJobs: queuedJobs.length,
      })
    } catch (notificationError: any) {
      if (!isNotificationsTableMissing(notificationError)) {
        await supabase.from("study_reminders").delete().eq("id", reminder.id)
        return NextResponse.json(
          { error: notificationError?.message || "Failed to queue reminder notification" },
          { status: 500 },
        )
      }

      return NextResponse.json({
        reminder,
        queuedJobs: 0,
        warning: "Notification queue table is not available yet",
      })
    } finally {
      await logAuditEvent({
        supabase: supabase as any,
        actorId: principal.userId,
        action: "reminder.created",
        resourceType: "study_reminder",
        resourceId: reminder.id,
        metadata: {
          courseId: course.id,
          lineEnabled,
          reminderTime,
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create reminder" }, { status: 500 })
  }
}

