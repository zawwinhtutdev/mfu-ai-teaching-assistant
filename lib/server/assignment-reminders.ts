/**
 * Derive study reminders from assignment deadlines (spec §4 / DoD #4).
 *
 * Before this, reminders were free text a student typed by hand, so the
 * "automated reminders for assignment deadlines" requirement had nothing to
 * automate. This turns each upcoming, released assignment into one reminder per
 * enrolled student, offset before the due date.
 *
 * Idempotency comes from the database, not from in-process bookkeeping:
 * `idx_study_reminders_student_assignment` is unique on
 * (student_id, assignment_id), so re-running the scheduler is a no-op for
 * reminders that already exist.
 */

const DEFAULT_LEAD_HOURS = 24

export type SchedulerSummary = {
  assignmentsScanned: number
  remindersCreated: number
  notificationsQueued: number
  skipped: number
  errors: string[]
}

type SupabaseLikeClient = {
  from: (table: string) => any
}

function leadHours() {
  const configured = Number(process.env.REMINDER_LEAD_HOURS || DEFAULT_LEAD_HOURS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LEAD_HOURS
}

/**
 * Create reminders for assignments whose due date is inside the lead window.
 *
 * `now` is injectable so tests can run against a fixed clock.
 */
export async function scheduleAssignmentReminders(
  supabase: SupabaseLikeClient,
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<SchedulerSummary> {
  const now = options.now ?? new Date()
  const windowEnd = new Date(now.getTime() + leadHours() * 60 * 60 * 1000)

  const summary: SchedulerSummary = {
    assignmentsScanned: 0,
    remindersCreated: 0,
    notificationsQueued: 0,
    skipped: 0,
    errors: [],
  }

  // Only released assignments with a future deadline can produce a reminder:
  // a draft has no student-facing date, and a past one would fire immediately
  // for something already overdue.
  const { data: assignments, error: assignmentError } = await supabase
    .from("assignments")
    .select("id, course_id, title, due_at, visible_to_students")
    .eq("visible_to_students", true)
    .not("due_at", "is", null)
    .gt("due_at", now.toISOString())
    .lte("due_at", windowEnd.toISOString())

  if (assignmentError) {
    summary.errors.push(`assignments: ${assignmentError.message}`)
    return summary
  }

  for (const assignment of assignments || []) {
    summary.assignmentsScanned += 1

    const { data: enrollments, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select("student_id")
      .eq("course_id", assignment.course_id)

    if (enrollmentError) {
      summary.errors.push(`enrollments ${assignment.id}: ${enrollmentError.message}`)
      continue
    }

    // Fire the reminder one lead-period before the deadline, but never in the
    // past — an assignment created inside the window should remind now.
    const reminderTime = new Date(
      Math.max(
        now.getTime(),
        new Date(assignment.due_at).getTime() - leadHours() * 60 * 60 * 1000,
      ),
    )

    for (const enrollment of enrollments || []) {
      const reminderText = `Upcoming deadline: ${assignment.title} is due ${new Date(
        assignment.due_at,
      ).toLocaleString()}`

      if (options.dryRun) {
        summary.remindersCreated += 1
        continue
      }

      const { data: existing } = await supabase
        .from("study_reminders")
        .select("id")
        .eq("student_id", enrollment.student_id)
        .eq("assignment_id", assignment.id)
        .maybeSingle()

      if (existing) {
        summary.skipped += 1
        continue
      }

      const { data: reminder, error: insertError } = await supabase
        .from("study_reminders")
        .insert({
          student_id: enrollment.student_id,
          course_id: assignment.course_id,
          assignment_id: assignment.id,
          reminder_text: reminderText,
          reminder_time: reminderTime.toISOString(),
        })
        .select("id")
        .single()

      if (insertError || !reminder) {
        // A unique-violation here just means a concurrent run won the race.
        if (insertError?.code === "23505") {
          summary.skipped += 1
        } else {
          summary.errors.push(`reminder ${assignment.id}/${enrollment.student_id}: ${insertError?.message}`)
        }
        continue
      }

      summary.remindersCreated += 1

      // Deliverability requires a destination. Resolve the email once and skip
      // the notification (not the reminder) when the student has none, so the
      // in-app reminder still appears.
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", enrollment.student_id)
        .maybeSingle()

      if (!profile?.email) {
        summary.errors.push(`no email for ${enrollment.student_id}; reminder kept, notification skipped`)
        continue
      }

      const { error: jobError } = await supabase.from("notification_jobs").insert({
        user_id: enrollment.student_id,
        course_id: assignment.course_id,
        channel: "email",
        template: "assignment_reminder",
        payload: {
          email: profile.email,
          reminderId: reminder.id,
          assignmentId: assignment.id,
          reminderText,
          reminderTime: reminderTime.toISOString(),
        },
        status: "queued",
        scheduled_for: reminderTime.toISOString(),
      })

      if (jobError) {
        summary.errors.push(`job for ${reminder.id}: ${jobError.message}`)
      } else {
        summary.notificationsQueued += 1
      }
    }
  }

  return summary
}
