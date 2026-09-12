import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey, DEMO_USERS } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"
import { logAuditEvent } from "@/lib/server/audit-log"

const ALLOWED_ROLES = new Set(["student", "teacher", "admin"])

export async function GET() {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ users: DEMO_USERS })
    }

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id, email, full_name, role, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(300)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load users" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || "").trim()
    const role = String(body?.role || "").trim()

    if (!userId || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Invalid userId or role" }, { status: 400 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ user: { id: userId, role, email: "demo@mfu.ac.th", full_name: "Demo User", created_at: new Date().toISOString() } })
    }

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("id, email, full_name, role, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.user_role_updated",
      resourceType: "profile",
      resourceId: userId,
      metadata: { role },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ user: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update role" }, { status: 500 })
  }
}
