#!/usr/bin/env node
/**
 * Walk every page as each real role and report failures.
 *
 * A page returning 200 is not proof it works: this app renders many pages as
 * client components that fetch after hydration, so a broken API shows up as an
 * "error" banner inside an otherwise-200 page. This crawler separates the two:
 *
 *   - status  : the HTTP response for the route
 *   - server  : Next.js logged an error while rendering
 *   - uiError : the rendered HTML contains a visible error message
 *
 * Sessions come from a real Supabase sign-in, exactly as a person would log in.
 * The previous version used the demo-cookie endpoint, which no longer exists on
 * the login page and would have tested a code path users never take.
 *
 * Usage:
 *   node scripts/check-pages.mjs                # all roles, all routes
 *   node scripts/check-pages.mjs --role teacher # one role
 *   node scripts/check-pages.mjs --verbose
 */

import fs from "node:fs"
import process from "node:process"

const BASE = process.env.CHECK_BASE_URL || "http://localhost:3000"
const VERBOSE = process.argv.includes("--verbose")
const roleFilter = (() => {
  const index = process.argv.indexOf("--role")
  return index === -1 ? null : process.argv[index + 1]
})()

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(".env.local")

/** Seeded accounts, all with the same password. */
const PASSWORD = "demo1234"
const ROLES = {
  teacher: { email: "anan.suwan@mfu.ac.th" },
  student: { email: "6531503078@lamduan.mfu.ac.th" },
  admin: { email: "admin@mfu.ac.th" },
}

/**
 * Routes per role. Demo seed ids are used for course detail pages because that
 * is exactly what the portal links to — the bug class we are hunting is code
 * that assumes a uuid.
 */
const ROUTES = {
  teacher: [
    "/teacherportal",
    "/teacherportal/mycourses",
    "/teacherportal/mycourses/course-csb321",
    "/teacherportal/mycourses/course-csb321?tab=content",
    "/teacherportal/mycourses/course-csb321?tab=evaluation",
    "/teacherportal/mycourses/course-csb321?tab=settings",
    "/teacherportal/mycourses/course-csb321/analytics",
    "/teacherportal/analytics",
    "/teacherportal/calendar",
    "/teacherportal/documents",
    "/teacherportal/agentbuilder",
    "/teacherportal/settings",
    "/teacherportal/mfucampusresources",
    "/dashboard/teacher",
    "/dashboard/teacher/courses",
    "/dashboard/teacher/analytics",
    "/dashboard/teacher/calendar",
    "/dashboard/teacher/forums",
    "/dashboard/teacher/reminders",
    "/dashboard/teacher/settings",
    "/dashboard/teacher/agent",
  ],
  student: [
    "/studentportal",
    "/studentportal/mycourses",
    "/studentportal/mycourses/course-csb321",
    "/studentportal/courses/course-csb321",
    "/studentportal/courses",
    "/studentportal/analytics",
    "/studentportal/calendar",
    "/studentportal/documents",
    "/studentportal/reminders",
    "/studentportal/settings",
    "/studentportal/setting",
    "/studentportal/study",
    "/studentportal/todo",
    "/studentportal/aistudytools",
    "/studentportal/agentbuilder",
    "/studentportal/archived",
    "/studentportal/mfuclubs",
    "/studentportal/mfucampusresources",
    "/chat",
    "/chat/documents",
    "/dashboard",
  ],
  admin: [
    "/admin",
    "/admin/dashboard",
    "/admin/dashboard/users",
    "/admin/dashboard/org",
    "/admin/dashboard/profile",
    "/admin/dashboard/audit-logs",
    "/admin/dashboard/notifications",
    "/admin/dashboard/policies",
    "/admin/dashboard/privacy",
    "/admin/dashboard/manage/approval",
    "/admin/dashboard/manage/bulk-post",
    "/admin/dashboard/manage/playback",
    "/admin/dashboard/manage/downloads",
    "/admin/dashboard/manage/defaults",
    "/admin/login",
  ],
  public: [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/privacy",
    "/terms",
    "/contact",
    "/faq",
    "/docs",
    "/knowledge",
    "/campus",
    "/feedback",
    "/signup-success",
  ],
}

/** Patterns that indicate a page rendered a failure to the user. */
const UI_ERROR_PATTERNS = [
  /invalid input syntax for type uuid/i,
  /violates row-level security policy/i,
  /PGRST\d{3}/,
  /Failed to (load|save|fetch|generate)/i,
  /Something went wrong/i,
  /Unhandled Runtime Error/i,
  /Application error: a (client|server)-side exception/i,
  /permission denied for table/i,
]

/**
 * Sign in through Supabase and return a Cookie header.
 *
 * @supabase/ssr stores the session either as a single `sb-<ref>-auth-token`
 * cookie or split into `.0`, `.1`, ... parts once the payload exceeds the
 * browser's per-cookie limit. Both forms are reconstructed here, and the cookie
 * name is derived from the project URL the same way the library does, so this
 * keeps working when the local port or a hosted project changes.
 */
async function login(role) {
  const account = ROLES[role]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set")
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email: account.email, password: PASSWORD }),
  })

  if (!response.ok) {
    throw new Error(`login failed for ${role}: ${response.status} ${await response.text()}`)
  }

  const session = await response.json()
  const stored = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    expires_in: session.expires_in ?? 3600,
    token_type: "bearer",
    user: session.user,
  }

  // Same derivation as @supabase/ssr: the storage key is derived from the
  // project host, and a local URL keeps the "127" or "localhost" spelling.
  const projectRef = new URL(url).hostname.split(".")[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const encoded = "base64-" + Buffer.from(JSON.stringify(stored), "utf8").toString("base64")

  const CHUNK = 3180
  if (encoded.length <= CHUNK) {
    return `${cookieName}=${encodeURIComponent(encoded)}`
  }

  const parts = []
  for (let offset = 0, index = 0; offset < encoded.length; offset += CHUNK, index += 1) {
    parts.push(`${cookieName}.${index}=${encodeURIComponent(encoded.slice(offset, offset + CHUNK))}`)
  }
  return parts.join("; ")
}

async function checkPage(path, cookie) {
  const started = Date.now()
  let status = 0
  let html = ""
  let error = null

  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
    })
    status = response.status
    html = await response.text()
  } catch (cause) {
    error = cause?.message || String(cause)
  }

  const uiHits = []
  for (const pattern of UI_ERROR_PATTERNS) {
    const match = html.match(pattern)
    if (match) uiHits.push(match[0])
  }

  return { path, status, uiHits, error, ms: Date.now() - started, bytes: html.length }
}

function summarize(results) {
  const failing = results.filter(
    (row) => row.error || row.status >= 400 || row.uiHits.length > 0,
  )
  return failing
}

async function main() {
  const roles = roleFilter ? [roleFilter] : ["public", "teacher", "student", "admin"]
  const report = {}

  for (const role of roles) {
    const paths = ROUTES[role]
    if (!paths) {
      console.error(`Unknown role: ${role}`)
      process.exit(1)
    }

    const cookie = role === "public" ? "" : await login(role)
    const results = []

    for (const path of paths) {
      const result = await checkPage(path, cookie)
      results.push(result)
      const bad = result.error || result.status >= 400 || result.uiHits.length > 0
      const marker = bad ? "FAIL" : "ok  "
      const detail = result.error
        ? `error=${result.error}`
        : `status=${result.status}`
      console.log(`${marker} ${role.padEnd(7)} ${path.padEnd(56)} ${detail} ${result.ms}ms`)
      if (VERBOSE && result.uiHits.length > 0) {
        console.log(`       ui: ${result.uiHits.join(" | ")}`)
      }
    }

    report[role] = results
  }

  const allResults = Object.entries(report).flatMap(([role, rows]) =>
    rows.map((row) => ({ role, ...row })),
  )
  const failing = summarize(allResults)

  console.log(`\n${"-".repeat(72)}`)
  console.log(`checked ${allResults.length} pages, ${failing.length} with problems`)

  if (failing.length > 0) {
    for (const row of failing) {
      console.log(`\n${row.role} ${row.path}`)
      if (row.error) console.log(`  request error: ${row.error}`)
      if (row.status >= 400) console.log(`  http status: ${row.status}`)
      for (const hit of row.uiHits) console.log(`  ui error: ${hit}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("check-pages failed:", error)
  process.exit(1)
})
