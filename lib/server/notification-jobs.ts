type SupabaseLikeClient = {
  from: (table: string) => any
}

export function isNotificationsTableMissing(error: any) {
  return error?.code === "42P01"
}

export async function queueReminderNotificationJobs(params: {
  supabase: SupabaseLikeClient
  userId: string
  courseId: string
  reminderId: string
  reminderText: string
  reminderTime: string
  lineEnabled?: boolean
}) {
  const basePayload = {
    reminderId: params.reminderId,
    reminderText: params.reminderText,
    reminderTime: params.reminderTime,
  }

  const jobs = [
    {
      user_id: params.userId,
      course_id: params.courseId,
      channel: "email",
      template: "study_reminder",
      payload: basePayload,
      status: "queued",
      scheduled_for: params.reminderTime,
    },
  ] as any[]

  if (params.lineEnabled) {
    jobs.push({
      user_id: params.userId,
      course_id: params.courseId,
      channel: "line",
      template: "study_reminder",
      payload: basePayload,
      status: "queued",
      scheduled_for: params.reminderTime,
    })
  }

  const { data, error } = await params.supabase
    .from("notification_jobs")
    .insert(jobs)
    .select("id, channel, status")

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

export async function cancelReminderNotificationJobs(params: {
  supabase: SupabaseLikeClient
  userId: string
  reminderId: string
}) {
  const { error } = await params.supabase
    .from("notification_jobs")
    .update({ status: "canceled" })
    .eq("user_id", params.userId)
    .eq("template", "study_reminder")
    .contains("payload", { reminderId: params.reminderId })
    .in("status", ["queued", "processing"])

  return error
}
