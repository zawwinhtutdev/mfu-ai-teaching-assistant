import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"

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
 * Local demo mode carries the role in a cookie; a real Supabase session carries
 * it in user metadata. Order matters: a live session wins over the demo cookie.
 */
export async function resolveRole(): Promise<Role | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const metadataRole =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined)
  if (metadataRole === "student" || metadataRole === "teacher" || metadataRole === "admin") {
    return metadataRole
  }

  const jar = await cookies()
  const demoRole = jar.get("mfu_demo_role")?.value
  if (demoRole === "student" || demoRole === "teacher" || demoRole === "admin") {
    return demoRole
  }

  return null
}

export async function canManageMaterials(): Promise<boolean> {
  const role = await resolveRole()
  return role === "teacher" || role === "admin"
}
