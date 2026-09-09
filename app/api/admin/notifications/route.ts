import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey, DEMO_NOTIFICATION_JOBS } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"

export async function GET(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasServiceRoleKey()) {
      const url = new URL(req.url)
      const statusFilter = url.searchParams.get("status") || ""
      const filtered = statusFilter
        ? DEMO_NOTIFICATION_JOBS.filter((j) => j.status === statusFilter)
        : DEMO_NOTIFICATION_JOBS
      return NextResponse.json({ jobs: filtered })
    }

    const url = new URL(req.url)
    const status = url.searchParams.get("status") || ""
    const limit = Math.min(200, Math.max(20, Number(url.searchParams.get("limit") || 50)))

    const serviceClient = createServiceRoleClient()
    let query = serviceClient
      .from("notification_jobs")
      .select("id, user_id, course_id, channel, template, status, scheduled_for, attempt_count, last_error, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (status && ["queued", "processing", "sent", "failed", "canceled"].includes(status)) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load notification jobs" }, { status: 500 })
  }
}
