import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { scheduleAssignmentReminders } from "@/lib/server/assignment-reminders"
import { trackApiError } from "@/lib/server/observability"

async function sendEmailJob(params: {
  to: string
  courseTitle?: string | null
  reminderText?: string | null
  reminderTime?: string | null
}) {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFICATION_FROM_EMAIL || "MFU AI Assistant <no-reply@mfuassistant.local>"
  const subject = `Study reminder${params.courseTitle ? ` • ${params.courseTitle}` : ""}`
  const text = [
    "Your study reminder is due.",
    params.reminderText ? `Reminder: ${params.reminderText}` : "",
    params.courseTitle ? `Course: ${params.courseTitle}` : "",
    params.reminderTime ? `Time: ${new Date(params.reminderTime).toLocaleString()}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  if (!resendApiKey) {
    // Report what actually happened. Claiming "sent" with a fake provider id
    // marked every job delivered while nothing left the machine, which is why
    // the notification dashboard looked healthy and no email ever arrived.
    if (process.env.NOTIFICATIONS_DRY_RUN === "true") {
      console.log(`[notifications] dry run — would email ${params.to}: ${subject}`)
      return { sent: true, providerMessageId: "dry-run" }
    }
    throw new Error(
      "RESEND_API_KEY is not set: email cannot be delivered. " +
        "Set it, or set NOTIFICATIONS_DRY_RUN=true to log instead of send.",
    )
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      text,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || "Email provider request failed")
  }

  return {
    sent: true,
    providerMessageId: payload?.id || "resend-message",
  }
}

/**
 * LINE Messaging API push.
 *
 * Requires a channel access token and the recipient's LINE user id. Without
 * both, this throws with a message that says which one is missing — the old
 * code threw a blanket "not configured" for the whole channel, so a genuinely
 * misconfigured token was indistinguishable from an unlinked student.
 */
async function sendLineJob(params: {
  to: string
  reminderText?: string | null
  reminderTime?: string | null
  courseTitle?: string | null
}) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set: LINE delivery is unavailable")
  }

  const lines = [
    params.courseTitle ? `📚 ${params.courseTitle}` : "Study reminder",
    params.reminderText || "",
    params.reminderTime ? new Date(params.reminderTime).toLocaleString() : "",
  ].filter(Boolean)

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: params.to,
      messages: [{ type: "text", text: lines.join("\n") }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`LINE push failed (${response.status}): ${detail.slice(0, 200)}`)
  }

  return { sent: true, providerMessageId: `line-${Date.now()}` }
}

function isAuthorizedCronRequest(req: Request) {
  const expectedSecret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET
  if (!expectedSecret) return false

  const authorization = req.headers.get("authorization") || ""
  return authorization === `Bearer ${expectedSecret}`
}

async function runRetentionCleanup(supabase: ReturnType<typeof createServiceRoleClient>) {
  const retentionDays = Number(process.env.DATA_RETENTION_DAYS || 30)
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: optedOutRows, error: consentError } = await supabase
    .from("consents")
    .select("user_id")
    .eq("consent_type", "data_retention_opt_out")
    .eq("is_granted", true)

  if (consentError || !Array.isArray(optedOutRows) || optedOutRows.length === 0) {
    return { cleanedQueries: 0, cleanedAuditLogs: 0 }
  }

  const userIds = optedOutRows.map((row) => row.user_id).filter(Boolean)
  if (userIds.length === 0) {
    return { cleanedQueries: 0, cleanedAuditLogs: 0 }
  }

  const { count: cleanedQueries } = await supabase
    .from("student_queries")
    .delete({ count: "exact" })
    .in("student_id", userIds)
    .lt("created_at", cutoff)

  const { count: cleanedAuditLogs } = await supabase
    .from("audit_logs")
    .delete({ count: "exact" })
    .in("actor_id", userIds)
    .lt("created_at", cutoff)

  return {
    cleanedQueries: cleanedQueries || 0,
    cleanedAuditLogs: cleanedAuditLogs || 0,
  }
}

async function processNotifications(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceRoleClient()

    // Derive reminders from assignment deadlines before dispatching, so a
    // deadline that entered the lead window today is delivered today rather
    // than waiting for the next run.
    const scheduling = await scheduleAssignmentReminders(supabase as any)

    const { data: jobs, error: jobsError } = await supabase
      .from("notification_jobs")
      .select("id, user_id, course_id, channel, template, payload, status, scheduled_for, attempt_count")
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50)

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 })
    }

    const rows = Array.isArray(jobs) ? jobs : []
    let sent = 0
    let failed = 0

    for (const job of rows) {
      await supabase
        .from("notification_jobs")
        .update({
          status: "processing",
          attempt_count: (job.attempt_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)

      const payload = (job.payload || {}) as Record<string, any>
      const destination =
        job.channel === "email"
          ? String(payload.email || "").trim()
          : String(payload.lineUserId || payload.pushToken || "").trim()

      try {
        if (job.channel === "email") {
          if (!destination) {
            throw new Error("Missing email destination")
          }

          const { data: course } = await supabase
            .from("courses")
            .select("title")
            .eq("id", job.course_id)
            .maybeSingle()

          const emailResult = await sendEmailJob({
            to: destination,
            courseTitle: course?.title || null,
            reminderText: payload.reminderText,
            reminderTime: payload.reminderTime,
          })

          await supabase.from("notification_deliveries").insert({
            job_id: job.id,
            channel: "email",
            destination,
            provider_message_id: emailResult.providerMessageId,
            status: "sent",
            sent_at: new Date().toISOString(),
          })

          await supabase
            .from("notification_jobs")
            .update({ status: "sent", last_error: null, updated_at: new Date().toISOString() })
            .eq("id", job.id)

          sent += 1
        } else if (job.channel === "line") {
          if (!destination) {
            throw new Error("Missing LINE user id")
          }

          const { data: course } = await supabase
            .from("courses")
            .select("title")
            .eq("id", job.course_id)
            .maybeSingle()

          const lineResult = await sendLineJob({
            to: destination,
            courseTitle: course?.title || null,
            reminderText: payload.reminderText,
            reminderTime: payload.reminderTime,
          })

          await supabase.from("notification_deliveries").insert({
            job_id: job.id,
            channel: "line",
            destination,
            provider_message_id: lineResult.providerMessageId,
            status: "sent",
            sent_at: new Date().toISOString(),
          })

          await supabase
            .from("notification_jobs")
            .update({ status: "sent", last_error: null, updated_at: new Date().toISOString() })
            .eq("id", job.id)

          sent += 1
        } else {
          // in_app and push are persisted by other paths; record the reason
          // rather than leaving the job silently queued forever.
          throw new Error(`${job.channel} delivery is not implemented in this job processor`)
        }
      } catch (deliveryError: any) {
        await supabase.from("notification_deliveries").insert({
          job_id: job.id,
          channel: job.channel,
          destination: destination || null,
          status: "failed",
          error: deliveryError?.message || "Delivery failed",
        })

        await supabase
          .from("notification_jobs")
          .update({
            status: "failed",
            last_error: deliveryError?.message || "Delivery failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)

        failed += 1
      }
    }

    const retention = await runRetentionCleanup(supabase)

    return NextResponse.json({
      processed: rows.length,
      sent,
      failed,
      scheduling,
      retention,
    })
  } catch (error: any) {
    await trackApiError({
      route: "/api/notifications/process",
      error,
    })
    return NextResponse.json({ error: error?.message || "Failed to process notifications" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return processNotifications(req)
}

export async function POST(req: Request) {
  return processNotifications(req)
}
