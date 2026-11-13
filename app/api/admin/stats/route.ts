import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { fetchPlatformStats } from "@/lib/server/academic"
import { requireAdminUser } from "@/lib/server/admin-auth"

export async function GET() {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Without a service-role key the service database is the source of truth.
    if (!hasServiceRoleKey()) {
      const stats = await fetchPlatformStats()
      if (!stats) {
        return NextResponse.json({ error: "Stats unavailable" }, { status: 503 })
      }
      return NextResponse.json({ stats })
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
      materialsRes,
      chunksRes,
      policiesRes,
    ] = await Promise.all([
      serviceClient.from("profiles").select("role", { count: "exact", head: false }),
      serviceClient.from("courses").select("id", { count: "exact", head: true }),
      serviceClient.from("course_enrollments").select("id", { count: "exact", head: true }),
      serviceClient.from("conversations").select("id", { count: "exact", head: true }),
      serviceClient.from("notification_jobs").select("status", { count: "exact", head: false }),
      serviceClient.from("consents").select("consent_type, is_granted", { count: "exact", head: false }),
      serviceClient.from("audit_logs").select("id", { count: "exact", head: true }),
      // Course materials drive the "Course documents" card. Previously absent,
      // so the card rendered `undefined ready · undefined failed`.
      serviceClient.from("course_materials").select("id", { count: "exact", head: true }),
      serviceClient.from("course_material_chunks").select("material_id", { count: "exact", head: false }),
      serviceClient.from("system_policies").select("policy_key", { count: "exact", head: false }),
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

    // A material counts as "ready" once it has at least one indexed chunk.
    // "Failed" is materials with no chunks yet — indexing either has not run or
    // did not produce anything, which is what an admin needs to notice.
    const materialIds = new Set<string>()
    const chunkRows = chunksRes.data || []
    const indexedMaterialIds = new Set<string>()
    for (const chunk of chunkRows) {
      if ((chunk as any).material_id) indexedMaterialIds.add((chunk as any).material_id)
    }

    const totalDocuments = materialsRes.count ?? 0
    const documentsReady = indexedMaterialIds.size
    const documentsFailed = Math.max(totalDocuments - documentsReady, 0)

    return NextResponse.json({
      stats: {
        totalUsers: profiles.length,
        roleCounts,
        totalCourses: coursesRes.count || 0,
        totalEnrollments: enrollmentsRes.count || 0,
        totalConversations: conversationsRes.count || 0,
        totalAuditLogs: auditLogsRes.count || 0,
        totalDocuments,
        totalChunks: chunkRows.length,
        documentsReady,
        documentsFailed,
        totalPolicies: policiesRes.count ?? (policiesRes.data?.length ?? 0),
        notifications: notifCounts,
        consents: consentStats,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load stats" }, { status: 500 })
  }
}
