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
    const principal =
      req?.headers.get("x-dev-principal") ??
      process.env.DEV_PRINCIPAL ??
      "demo.student@mfu.ac.th"
    return { "X-Dev-Principal": principal }
  }

  return null
}
