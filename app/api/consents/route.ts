import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logAuditEvent } from "@/lib/server/audit-log"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("consents")
      .select("consent_type, is_granted, granted_at, revoked_at, updated_at")
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ consents: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load consents" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const consentType = String(body?.consentType || "").trim()
    const isGranted = !!body?.isGranted

    if (!consentType) {
      return NextResponse.json({ error: "consentType is required" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const row = {
      user_id: user.id,
      consent_type: consentType,
      is_granted: isGranted,
      granted_at: isGranted ? now : null,
      revoked_at: isGranted ? null : now,
      updated_at: now,
      source: "settings_page",
    }

    const { data, error } = await supabase
      .from("consents")
      .upsert(row, { onConflict: "user_id,consent_type" })
      .select("consent_type, is_granted, granted_at, revoked_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase: supabase as any,
      actorId: user.id,
      action: "consent.updated",
      resourceType: "consent",
      resourceId: consentType,
      metadata: { consentType, isGranted },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ consent: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update consent" }, { status: 500 })
  }
}
