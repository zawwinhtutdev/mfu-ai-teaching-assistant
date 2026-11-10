import { NextResponse } from "next/server"
import { getDefaultRouteForRole } from "@/lib/demo-auth"
import { isUniversityEmail } from "@/lib/email-validation"
import { createClient } from "@/lib/supabase/server"
import { toUserRole } from "@/lib/auth/roles"

function loginErrorUrl(origin: string, error: string) {
  const url = new URL("/login", origin)
  url.searchParams.set("error", error)
  return url
}

/**
 * Supabase forwards provider failures here as query params, and the shape
 * differs by failure mode (`error` for OAuth errors, `error_code` for the
 * token exchange). Collapse them into the handful of causes the login page
 * knows how to explain, rather than leaving users with a raw provider string.
 */
function classifyProviderError(code: string, description: string): string {
  const text = `${code} ${description}`.toLowerCase()

  // The email-uniqueness constraint fires before our domain check runs, so a
  // Google account whose address is already registered via password lands here.
  if (
    text.includes("duplicate key") ||
    text.includes("already registered") ||
    text.includes("already exists") ||
    text.includes("user_already_exists")
  ) {
    return "account_exists"
  }

  if (text.includes("access_denied") || text.includes("consent")) {
    return "oauth_cancelled"
  }

  return "oauth_failed"
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)

  // Providers report failures two ways; check both before attempting exchange.
  const providerError = searchParams.get("error") || searchParams.get("error_code") || ""
  const providerDescription =
    searchParams.get("error_description") || searchParams.get("msg") || ""

  if (providerError) {
    return NextResponse.redirect(
      loginErrorUrl(origin, classifyProviderError(providerError, providerDescription)),
    )
  }

  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(loginErrorUrl(origin, "oauth_failed"))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user?.email) {
    return NextResponse.redirect(
      loginErrorUrl(origin, classifyProviderError(error?.code || "", error?.message || "")),
    )
  }

  // Defence in depth. The database trigger refuses non-MFU addresses on insert,
  // but a pre-existing account could still hold one, so check again here.
  if (!isUniversityEmail(data.user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(loginErrorUrl(origin, "university_email_required"))
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()

  // A Google sign-in that reaches this point but has no profile row means the
  // signup trigger did not run (e.g. a user created out-of-band). Send them
  // back rather than dropping them into a portal with no role.
  if (!profile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(loginErrorUrl(origin, "profile_missing"))
  }

  // Authoritative role source; user_metadata is user-writable.
  const role = toUserRole(profile.role)

  return NextResponse.redirect(new URL(getDefaultRouteForRole(role), origin))
}
