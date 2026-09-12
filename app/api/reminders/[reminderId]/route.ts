import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cancelReminderNotificationJobs } from "@/lib/server/notification-jobs"
import { logAuditEvent } from "@/lib/server/audit-log"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ reminderId: string }> },
) {
  try {
    const { reminderId } = await params
    const body = await req.json().catch(() => ({}))
    const isCompleted = !!body?.isCompleted

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: reminder, error } = await supabase
      .from("study_reminders")
      .update({ is_completed: isCompleted })
      .eq("id", reminderId)
      .eq("student_id", user.id)
      .select("id, student_id, course_id, reminder_text, reminder_time, is_completed, created_at, courses(title, code)")
      .single()

    if (error || !reminder) {
      return NextResponse.json({ error: error?.message || "Reminder not found" }, { status: 404 })
    }

    if (isCompleted) {
      await cancelReminderNotificationJobs({
        supabase: supabase as any,
        userId: user.id,
        reminderId,
      })
    }

    await logAuditEvent({
      supabase: supabase as any,
      actorId: user.id,
      action: "reminder.updated",
      resourceType: "study_reminder",
      resourceId: reminderId,
      metadata: { isCompleted },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ reminder })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update reminder" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ reminderId: string }> },
) {
  try {
    const { reminderId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from("study_reminders")
      .delete()
      .eq("id", reminderId)
      .eq("student_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await cancelReminderNotificationJobs({
      supabase: supabase as any,
      userId: user.id,
      reminderId,
    })

    await logAuditEvent({
      supabase: supabase as any,
      actorId: user.id,
      action: "reminder.deleted",
      resourceType: "study_reminder",
      resourceId: reminderId,
      ipAddress: _req.headers.get("x-forwarded-for"),
      userAgent: _req.headers.get("user-agent"),
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete reminder" }, { status: 500 })
  }
}
