import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey, DEMO_POLICIES } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"
import { logAuditEvent } from "@/lib/server/audit-log"

export async function GET() {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ policies: DEMO_POLICIES })
    }

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("system_policies")
      .select("policy_key, policy_value, updated_by, updated_at")
      .order("policy_key", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ policies: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load policies" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const policyKey = String(body?.policyKey || "").trim()
    const policyValue = body?.policyValue

    if (!policyKey) {
      return NextResponse.json({ error: "policyKey is required" }, { status: 400 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({
        policy: { policy_key: policyKey, policy_value: policyValue ?? {}, updated_by: "mock-admin-1", updated_at: new Date().toISOString() },
      })
    }

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("system_policies")
      .upsert(
        {
          policy_key: policyKey,
          policy_value: policyValue ?? {},
          updated_by: admin.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "policy_key" },
      )
      .select("policy_key, policy_value, updated_by, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.policy_updated",
      resourceType: "system_policy",
      resourceId: policyKey,
      metadata: { policyValue: policyValue ?? {} },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ policy: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update policy" }, { status: 500 })
  }
}
