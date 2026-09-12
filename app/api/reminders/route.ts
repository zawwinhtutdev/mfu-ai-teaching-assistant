import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNotificationsTableMissing, queueReminderNotificationJobs } from "@/lib/server/notification-jobs"
import { logAuditEvent } from "@/lib/server/audit-log"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: reminders, error } = await supabase
      .from("study_reminders")
      .select("id, student_id, course_id, reminder_text, reminder_time, is_completed, created_at, courses(title, code)")
      .eq("student_id", user.id)
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Only students can create reminders" }, { status: 403 })
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

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("course_id", courseId)
      .eq("student_id", user.id)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 })
    }

    const reminderTime = reminderDate.toISOString()

    const { data: reminder, error: reminderError } = await supabase
      .from("study_reminders")
      .insert({
        student_id: user.id,
        course_id: courseId,
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
        userId: user.id,
        courseId,
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
        actorId: user.id,
        action: "reminder.created",
        resourceType: "study_reminder",
        resourceId: reminder.id,
        metadata: {
          courseId,
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
