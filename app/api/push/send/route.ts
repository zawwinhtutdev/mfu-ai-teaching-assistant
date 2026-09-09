import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import webPush from "web-push"

let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const contact = process.env.VAPID_CONTACT_EMAIL || "mailto:admin@mfu.ac.th"
  if (pub && priv) {
    webPush.setVapidDetails(contact, pub, priv)
    vapidConfigured = true
  }
}

/**
 * POST /api/push/send
 * Send a push notification to a user or all students in a course
 * Body: { userId?, courseId?, title, body, url? }
 */
export async function POST(req: Request) {
  ensureVapidConfigured()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only teachers can send push notifications
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "teacher" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { userId, courseId, title, body, url } = await req.json()

    if (!title || !body) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 })
    }

    // Get target subscriptions
    let query = supabase.from("push_subscriptions").select("*")

    if (userId) {
      query = query.eq("user_id", userId)
    } else if (courseId) {
      // Get all students in the course
      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("student_id")
        .eq("course_id", courseId)

      const studentIds = (enrollments || []).map((e: any) => e.student_id)
      if (studentIds.length === 0) {
        return NextResponse.json({ sent: 0, failed: 0 })
      }
      query = query.in("user_id", studentIds)
    } else {
      return NextResponse.json({ error: "userId or courseId is required" }, { status: 400 })
    }

    const { data: subscriptions } = await query

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0 })
    }

    const payload = JSON.stringify({ title, body, url: url || "/" })

    let sent = 0
    let failed = 0

    await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys_p256dh,
                auth: sub.keys_auth,
              },
            },
            payload
          )
          sent++
        } catch (error: any) {
          failed++
          // Remove expired subscriptions (410 Gone)
          if (error?.statusCode === 410 || error?.statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id)
          }
        }
      })
    )

    return NextResponse.json({ sent, failed })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send notifications" }, { status: 500 })
  }
}
