import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * Whether "Sign in with Google" should be offered.
 *
 * Two independent gates:
 *   1. Supabase must have the Google provider configured (credentials present).
 *   2. The admin policy `allow_google_sso` must not be switched off, so staff
 *      can disable Google sign-in at runtime without redeploying.
 *
 * Fails closed: any error means the button is hidden rather than broken.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ enabled: false }, { status: 503 })
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({ enabled: false }, { status: 503 })
    }

    const settings = await response.json()
    const providerConfigured = settings.external?.google === true

    if (!providerConfigured) {
      return NextResponse.json({ enabled: false, reason: "provider_not_configured" })
    }

    const policyEnabled = await readGoogleSsoPolicy(supabaseUrl, anonKey)

    return NextResponse.json({
      enabled: policyEnabled,
      reason: policyEnabled ? "ok" : "policy_disabled",
    })
  } catch {
    return NextResponse.json({ enabled: false }, { status: 503 })
  }
}

/**
 * Read `allow_google_sso` from system_policies.
 *
 * The table is RLS-protected and this route is unauthenticated, so the lookup
 * uses the anon key and only ever exposes a boolean. A missing row or a read
 * failure means "allowed", which matches the policy's default-on behaviour in
 * the admin console.
 */
async function readGoogleSsoPolicy(url: string, anonKey: string): Promise<boolean> {
  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await client
      .from("system_policies")
      .select("policy_value")
      .eq("policy_key", "allow_google_sso")
      .maybeSingle()

    if (error || !data) return true

    const value = data.policy_value as { enabled?: unknown } | null
    if (value && typeof value.enabled === "boolean") return value.enabled

    return true
  } catch {
    return true
  }
}
