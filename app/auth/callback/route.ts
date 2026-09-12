import { NextResponse } from "next/server"
import { getDefaultRouteForRole } from "@/lib/demo-auth"
import { isUniversityEmail } from "@/lib/email-validation"
import { createClient } from "@/lib/supabase/server"

function loginErrorUrl(origin: string, error: string) {
  const url = new URL("/login", origin)
  url.searchParams.set("error", error)
  return url
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(loginErrorUrl(origin, "oauth_failed"))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user?.email) {
    return NextResponse.redirect(loginErrorUrl(origin, "oauth_failed"))
  }

  if (!isUniversityEmail(data.user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(loginErrorUrl(origin, "university_email_required"))
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
  const role = profile?.role ?? data.user.user_metadata?.role

  return NextResponse.redirect(new URL(getDefaultRouteForRole(role), origin))
}
