import { NextResponse } from "next/server"

/**
 * Liveness + readiness probe for the web tier.
 *
 * The FastAPI service has `/health`; the web app had nothing, so an uptime
 * monitor or load balancer had to scrape `/` and could not tell a healthy
 * deploy from a 200-served error page or a stale cache.
 *
 * Strict production semantics only apply when `ENVIRONMENT=production`.
 * That keeps a local `next start` against `.env.local` green (localhost and
 * insecure dev auth are legitimate there), while `scripts/deploy.sh` requires
 * `ENVIRONMENT=production` so a real deployment gets the strict checks.
 */
export const dynamic = "force-dynamic"

type Check = { ok: boolean; detail?: string }

function isLocalUrl(value: string) {
  try {
    const host = new URL(value).hostname
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0"
  } catch {
    return false
  }
}

export async function GET() {
  const checks: Record<string, Check> = {}
  const isProduction = process.env.ENVIRONMENT === "production"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const insecureAuth = process.env.ALLOW_INSECURE_DEV_AUTH === "true"

  // NEXT_PUBLIC_* values are inlined at build time, so a missing or wrong value
  // here cannot be repaired at runtime — the bundle already contains it.
  if (!supabaseUrl) {
    checks.supabaseUrl = { ok: false, detail: "NEXT_PUBLIC_SUPABASE_URL is not set" }
  } else if (isProduction && isLocalUrl(supabaseUrl)) {
    checks.supabaseUrl = {
      ok: false,
      detail: `${supabaseUrl} is loopback; a production build cannot reach a local Supabase`,
    }
  } else {
    checks.supabaseUrl = { ok: true }
  }

  checks.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? { ok: true }
    : { ok: false, detail: "SUPABASE_SERVICE_ROLE_KEY is not set" }

  // The insecure dev-auth path mints a passwordless session, so on a real
  // deployment it is a security incident rather than a warning.
  if (isProduction && insecureAuth) {
    checks.secureAuth = { ok: false, detail: "ALLOW_INSECURE_DEV_AUTH is enabled in production" }
  } else {
    checks.secureAuth = { ok: true }
  }

  // Reachability: a HEAD against the REST endpoint proves DNS, TLS, and that
  // the project is not paused.
  if (supabaseUrl && !(isProduction && isLocalUrl(supabaseUrl))) {
    try {
      const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/`, {
        method: "HEAD",
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
        signal: AbortSignal.timeout(4000),
      })
      checks.database = res.status < 500 ? { ok: true } : { ok: false, detail: `HTTP ${res.status}` }
    } catch (error: any) {
      checks.database = { ok: false, detail: error?.message || "unreachable" }
    }
  } else {
    checks.database = { ok: false, detail: "skipped: no usable Supabase URL" }
  }

  const healthy = Object.values(checks).every((check) => check.ok)

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "ata-web",
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.ENVIRONMENT || "development",
      checks,
    },
    { status: healthy ? 200 : 503 },
  )
}
