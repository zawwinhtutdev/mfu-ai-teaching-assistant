import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const API_URL = process.env.API_SERVICE_URL?.replace(/\/+$/, "")

/**
 * Thin streaming proxy to the FastAPI service.
 *
 * The browser never talks to FastAPI directly: this route resolves the Supabase
 * session, forwards the access token, and pipes the SSE body straight back.
 *
 * Local demo mode: when ALLOW_INSECURE_DEV_AUTH=true and there is no session,
 * the demo cookie identity is forwarded as X-Dev-Principal so the flow can be
 * exercised without a Supabase project. The API refuses that header in
 * production.
 */
export async function POST(req: Request) {
  if (!API_URL) {
    return Response.json(
      { error: "API service not configured", hint: "set API_SERVICE_URL" },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  } else if (process.env.ALLOW_INSECURE_DEV_AUTH === "true") {
    const devPrincipal =
      req.headers.get("x-dev-principal") ??
      (await cookies()).get("mfu_demo_email")?.value ??
      process.env.DEV_PRINCIPAL ??
      "demo.student@mfu.ac.th"
    headers["X-Dev-Principal"] = devPrincipal
  } else {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const upstream = await fetch(`${API_URL}/v1/chat`, {
    method: "POST",
    headers,
    body: await req.text(),
    cache: "no-store",
  })

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "")
    // Forward the service's verdict (403 = not your course) instead of a 502.
    return Response.json(
      { error: "Chat service refused", status: upstream.status, detail: detail.slice(0, 500) },
      { status: upstream.status },
    )
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
