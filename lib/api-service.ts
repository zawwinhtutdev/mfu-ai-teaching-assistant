import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { toUserRole } from "@/lib/auth/roles"

export const API_URL = process.env.API_SERVICE_URL?.replace(/\/+$/, "")

/**
 * Headers for calling the FastAPI service.
 *
 * Uses the Supabase access token when there is a session. In local demo mode
 * (ALLOW_INSECURE_DEV_AUTH=true) it falls back to the dev principal; the API
 * refuses that header in production.
 */
export async function serviceHeaders(req?: Request): Promise<Record<string, string> | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` }
  }

  if (process.env.ALLOW_INSECURE_DEV_AUTH === "true") {
    // Prefer the signed-in demo user so uploaded_by reflects who did it,
    // not a shared default principal.
    const jar = await cookies()
    const principal =
      req?.headers.get("x-dev-principal") ??
      jar.get("mfu_demo_email")?.value ??
      process.env.DEV_PRINCIPAL ??
      "demo.student@mfu.ac.th"
    return { "X-Dev-Principal": principal }
  }

  return null
}

export type Role = "student" | "teacher" | "admin"

/**
 * Resolve the caller's role.
 *
 * A live Supabase session wins over a demo cookie. The role itself comes from
 * public.profiles — never user_metadata, which the signed-in user can rewrite
 * and would therefore allow client-side self-promotion to admin.
 */
export async function resolveRole(): Promise<Role | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id) {
    const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    const role = toUserRole(profileRow?.role)
    return role
  }

  const jar = await cookies()
  const demoRole = jar.get("mfu_demo_role")?.value
  if (demoRole === "student" || demoRole === "teacher" || demoRole === "admin") {
    return demoRole
  }

  return null
}

export async function canManageMaterials(): Promise<boolean> {
  // Course materials belong to teachers; admins do not upload them.
  const role = await resolveRole()
  return role === "teacher"
}
