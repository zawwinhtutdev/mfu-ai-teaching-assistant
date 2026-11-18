import { NextResponse } from "next/server"
import { logAuditEvent } from "@/lib/server/audit-log"
import { clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

/**
 * Consent records (spec §2.3 / §6).
 *
 * Authenticated with `supabase.auth.getUser()` only, so a demo student's
 * Settings page showed no consent state and the toggles silently did nothing.
 */

export async function GET(_req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Demo accounts have no profile row, so no consent can be recorded for them.
    // An empty list is the honest answer; the UI then shows the platform default.
    if (!principal.isPersistable) {
      return NextResponse.json({ consents: [] })
    }

    const supabase = await clientForPrincipal(principal)
    const { data, error } = await supabase
      .from("consents")
      .select("consent_type, is_granted, granted_at, revoked_at, updated_at")
      .eq("user_id", principal.userId)

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
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const consentType = String(body?.consentType || "").trim()
    const isGranted = !!body?.isGranted

    if (!consentType) {
      return NextResponse.json({ error: "consentType is required" }, { status: 400 })
    }

    if (!principal.isPersistable) {
      return NextResponse.json(
        { error: "Demo accounts cannot record consent. Sign in with a real university account." },
        { status: 403 },
      )
    }

    const now = new Date().toISOString()
    const row = {
      user_id: principal.userId,
      consent_type: consentType,
      is_granted: isGranted,
      granted_at: isGranted ? now : null,
      revoked_at: isGranted ? null : now,
      updated_at: now,
      source: "settings_page",
    }

    const supabase = await clientForPrincipal(principal)
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
      actorId: principal.userId,
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

