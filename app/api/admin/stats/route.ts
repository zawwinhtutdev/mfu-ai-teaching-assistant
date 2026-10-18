import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { seedStats } from "@/lib/demo-seed"
import { requireAdminUser } from "@/lib/server/admin-auth"

export async function GET() {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Demo mode fallback: derived from the seeded teachers/courses/enrollments.
    if (!hasServiceRoleKey()) {
      return NextResponse.json({ stats: seedStats() })
    }

    const serviceClient = createServiceRoleClient()

    const [
      profilesRes,
      coursesRes,
      enrollmentsRes,
      conversationsRes,
      notifJobsRes,
      consentsRes,
      auditLogsRes,
    ] = await Promise.all([
      serviceClient.from("profiles").select("role", { count: "exact", head: false }),
      serviceClient.from("courses").select("id", { count: "exact", head: true }),
      serviceClient.from("course_enrollments").select("id", { count: "exact", head: true }),
      serviceClient.from("conversations").select("id", { count: "exact", head: true }),
      serviceClient.from("notification_jobs").select("status", { count: "exact", head: false }),
      serviceClient.from("consents").select("consent_type, is_granted", { count: "exact", head: false }),
      serviceClient.from("audit_logs").select("id", { count: "exact", head: true }),
    ])

    const profiles = profilesRes.data || []
    const roleCounts = { student: 0, teacher: 0, admin: 0 }
    for (const p of profiles) {
      const role = (p as any).role as string
      if (role in roleCounts) roleCounts[role as keyof typeof roleCounts]++
    }

    const notifJobs = notifJobsRes.data || []
    const notifCounts = { queued: 0, processing: 0, sent: 0, failed: 0, canceled: 0 }
    for (const j of notifJobs) {
      const status = (j as any).status as string
      if (status in notifCounts) notifCounts[status as keyof typeof notifCounts]++
    }

    const consents = consentsRes.data || []
    const consentStats = { total: consents.length, granted: 0, revoked: 0 }
    for (const c of consents) {
      if ((c as any).is_granted) consentStats.granted++
      else consentStats.revoked++
    }

    return NextResponse.json({
      stats: {
        totalUsers: profiles.length,
        roleCounts,
        totalCourses: coursesRes.count || 0,
        totalEnrollments: enrollmentsRes.count || 0,
        totalConversations: conversationsRes.count || 0,
        totalAuditLogs: auditLogsRes.count || 0,
        notifications: notifCounts,
        consents: consentStats,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load stats" }, { status: 500 })
  }
}
