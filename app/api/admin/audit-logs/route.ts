import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey, DEMO_AUDIT_LOGS } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"

export async function GET(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ logs: DEMO_AUDIT_LOGS })
    }

    const url = new URL(req.url)
    const limit = Math.min(200, Math.max(20, Number(url.searchParams.get("limit") || 100)))

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("audit_logs")
      .select("id, actor_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load audit logs" }, { status: 500 })
  }
}
