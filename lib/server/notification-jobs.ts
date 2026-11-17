type SupabaseLikeClient = {
  from: (table: string) => any
}

export function isNotificationsTableMissing(error: any) {
  return error?.code === "42P01"
}

export async function queueReminderNotificationJobs(params: {
  supabase: SupabaseLikeClient
  userId: string
  /** Where to deliver email reminders. Required for the email channel. */
  email?: string | null
  courseId: string
  reminderId: string
  reminderText: string
  reminderTime: string
  lineEnabled?: boolean
  /** LINE user id, when the student has linked one. */
  lineUserId?: string | null
}) {
  // The processor reads `payload.email` (and `payload.lineUserId`) to decide
  // where to send. Leaving them out of the payload — which is what happened
  // before — made every queued job fail with "Missing email destination", so
  // the scheduler ran daily and delivered nothing.
  if (!params.email && !params.lineUserId) {
    throw new Error("No delivery destination: the student has no email or LINE id on file")
  }

  const basePayload = {
    reminderId: params.reminderId,
    reminderText: params.reminderText,
    reminderTime: params.reminderTime,
    ...(params.email ? { email: params.email } : {}),
    ...(params.lineUserId ? { lineUserId: params.lineUserId } : {}),
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

  // LINE is only offered when a destination exists. Queuing a job that the
  // processor is guaranteed to reject just produces noise in the admin view.
  if (params.lineEnabled && params.lineUserId) {
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
