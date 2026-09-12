import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey, DEMO_CONSENTS } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"

export async function GET(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ consents: DEMO_CONSENTS })
    }

    const url = new URL(req.url)
    const limit = Math.min(300, Math.max(20, Number(url.searchParams.get("limit") || 100)))

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("consents")
      .select("id, user_id, consent_type, is_granted, source, granted_at, revoked_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ consents: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load consents" }, { status: 500 })
  }
}
