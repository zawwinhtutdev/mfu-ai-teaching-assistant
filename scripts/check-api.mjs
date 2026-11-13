#!/usr/bin/env node
/**
 * Exercise every API route as each real role.
 *
 * Pages returning 200 prove nothing: the Agent Builder bug rendered a perfectly
 * fine page while its settings request failed after hydration with
 * `invalid input syntax for type uuid: "course-ai-edu"`. Only calling the API
 * the page calls catches that.
 *
 * Each probe declares the statuses that are *correct* for a read-only check, so
 * a 403 from an ownership check counts as a pass rather than noise. Routes that
 * mutate (POST/PUT/DELETE) are probed with deliberately invalid payloads and
 * expected to fail validation, which exercises the route without writing data.
 *
 * Usage:
 *   node scripts/check-api.mjs
 *   node scripts/check-api.mjs --role teacher --verbose
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

const ACCOUNTS = {
  teacher: { email: "anan.suwan@mfu.ac.th" },
  student: { email: "6631503078@lamduan.mfu.ac.th" },
  admin: { email: "admin@mfu.ac.th" },
}
const PASSWORD = "demo1234"

const COURSE_SEED_ID = "course-csb321"
const COURSE_UUID = "a5f8e6a3-6f46-451a-a466-63dd11bd319c"

/**
 * Probes.
 *
 * `ok` lists every status that means the route handled the request. A 403 is a
 * pass anywhere the route is expected to enforce ownership, because that is the
 * route working. 500 is never a pass.
 */
const PROBES = {
  teacher: [
    { method: "GET", path: "/api/teacher/courses", ok: [200] },
    { method: "GET", path: "/api/course-schedules", ok: [200], name: "class schedules" },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/chatbot-settings`, ok: [200], name: "settings by seed id" },
    { method: "GET", path: `/api/courses/${COURSE_UUID}/chatbot-settings`, ok: [200], name: "settings by uuid" },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/materials`, ok: [200] },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/announcements`, ok: [200] },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/assignments`, ok: [200] },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/faqs`, ok: [200] },
    { method: "GET", path: `/api/surveys?courseId=${COURSE_UUID}`, ok: [200] },
    { method: "GET", path: "/api/study-assets?courseId=course-csb321", ok: [200] },
    { method: "GET", path: "/api/portal-data", ok: [200] },
    { method: "GET", path: "/api/conversations", ok: [200] },
    { method: "GET", path: "/api/reminders", ok: [200] },
    { method: "GET", path: "/api/documents", ok: [200] },
    { method: "GET", path: "/api/rag/documents", ok: [200] },
    { method: "GET", path: "/api/docs/search?q=grading", ok: [200] },
    // Mutating routes: invalid payload must be rejected by validation, and must
    // not be a 500 (which would mean the route threw instead of validating).
    { method: "PUT", path: `/api/courses/${COURSE_SEED_ID}/chatbot-settings`, body: { tone: "nonsense" }, ok: [400], name: "settings rejects bad tone" },
    { method: "POST", path: `/api/courses/${COURSE_SEED_ID}/faqs`, body: {}, ok: [400] },
    { method: "POST", path: `/api/courses/${COURSE_SEED_ID}/assignments`, body: {}, ok: [400] },
    { method: "POST", path: "/api/surveys", body: {}, ok: [400] },
    { method: "POST", path: "/api/summarize", body: {}, ok: [400] },
    { method: "POST", path: "/api/generate-quiz", body: {}, ok: [400] },
    { method: "POST", path: "/api/generate-flashcards", body: {}, ok: [400] },
    // Reminders are a student-only resource, so a teacher being refused is the
    // route working rather than a failure.
    { method: "POST", path: "/api/reminders", body: {}, ok: [403], name: "teacher cannot create reminder" },
    // A teacher must not be able to read another teacher's course.
    { method: "GET", path: "/api/courses/course-ai-edu/chatbot-settings", ok: [403], name: "no cross-teacher access" },
    // The gradebook reads across a whole course, so it must be teacher-only.
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/submissions`, ok: [200], name: "gradebook" },
    // Teachers manage quizzes: drafts visible, publish controlled.
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/quizzes`, ok: [200], name: "course quizzes" },
  ],
  student: [
    { method: "GET", path: "/api/portal-data", ok: [200] },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/materials`, ok: [200] },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/assignments`, ok: [200] },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/faqs`, ok: [200] },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/announcements`, ok: [200] },
    { method: "GET", path: "/api/study-assets?courseId=course-csb321", ok: [200] },
    { method: "GET", path: "/api/reminders", ok: [200] },
    { method: "GET", path: "/api/conversations", ok: [200] },
    { method: "GET", path: "/api/documents", ok: [200] },
    { method: "GET", path: "/api/surveys?courseId=" + COURSE_UUID, ok: [200] },
    { method: "POST", path: "/api/summarize", body: {}, ok: [400] },
    { method: "POST", path: "/api/generate-flashcards", body: {}, ok: [400] },
    { method: "POST", path: "/api/generate-quiz", body: {}, ok: [400] },
    { method: "POST", path: "/api/study-planner", body: {}, ok: [400, 403] },
    { method: "PATCH", path: "/api/consents", body: {}, ok: [400] },
    // A student must not be able to read or change another course's agent.
    { method: "GET", path: "/api/courses/course-ai-edu/chatbot-settings", ok: [403], name: "no cross-course access" },
    // The gradebook exposes every student's work, so a student must be refused.
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/submissions`, ok: [403], name: "student cannot read gradebook" },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/quizzes`, ok: [200], name: "course quizzes" },
    // A quiz answer key must not be reachable before submitting.
    { method: "POST", path: "/api/quizzes/00000000-0000-4000-8000-000000000000/attempt", body: { answers: {} }, ok: [404], name: "attempt requires a real quiz" },
    // Only a teacher may publish.
    { method: "PATCH", path: `/api/courses/${COURSE_SEED_ID}/quizzes`, body: { quizId: "x", isPublished: true }, ok: [403], name: "student cannot publish a quiz" },
    { method: "PUT", path: `/api/courses/${COURSE_SEED_ID}/chatbot-settings`, body: { tone: "friendly" }, ok: [403], name: "student cannot edit settings" },
  ],
  admin: [
    { method: "GET", path: "/api/admin/stats", ok: [200] },
    { method: "GET", path: "/api/admin/users", ok: [200] },
    { method: "GET", path: "/api/admin/audit-logs", ok: [200] },
    { method: "GET", path: "/api/admin/courses", ok: [200] },
    { method: "GET", path: "/api/admin/policies", ok: [200] },
    { method: "GET", path: "/api/admin/consents", ok: [200] },
    { method: "GET", path: "/api/admin/status", ok: [200] },
    { method: "GET", path: "/api/admin/notifications", ok: [200] },
    // Course creation rejects a bad payload without writing anything, which is
    // what proves the validation path runs before the insert.
    { method: "POST", path: "/api/admin/courses", body: {}, ok: [400], name: "course create validates" },
    { method: "POST", path: "/api/admin/courses", body: { code: "x", title: "y" }, ok: [400], name: "course code validated" },
    { method: "PATCH", path: "/api/admin/courses", body: {}, ok: [400], name: "course patch validates" },
    { method: "GET", path: "/api/admin/course-enrollment", ok: [400], name: "enrolment needs courseId" },
  ],
  public: [
    { method: "GET", path: "/api/auth/google/status", ok: [200] },
    { method: "GET", path: "/api/demo-auth/session", ok: [200] },
    { method: "GET", path: "/api/docs/search?q=summary", ok: [200] },
    { method: "GET", path: "/api/keep-alive", ok: [200] },
    { method: "GET", path: "/api/lms", ok: [200] },
    // Unauthenticated access to protected routes must be refused, not 500.
    { method: "GET", path: "/api/portal-data", ok: [401, 403], name: "anon blocked" },
    { method: "GET", path: "/api/admin/stats", ok: [401, 403], name: "anon blocked" },
    { method: "GET", path: `/api/courses/${COURSE_SEED_ID}/chatbot-settings`, ok: [401, 403], name: "anon blocked" },
    { method: "POST", path: "/api/chat", body: { messages: [] }, ok: [400, 401, 403], name: "anon blocked" },
  ],
}

/**
 * Sign in through Supabase and return a Cookie header.
 *
 * Same approach as scripts/check-pages.mjs: a real password sign-in, then the
 * session encoded the way @supabase/ssr stores it (single cookie, or chunked
 * once the payload exceeds the per-cookie limit).
 */
async function login(role) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set")
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email: ACCOUNTS[role].email, password: PASSWORD }),
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

async function probe(item, cookie) {
  const started = Date.now()
  try {
    const response = await fetch(`${BASE}${item.path}`, {
      method: item.method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(item.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(item.body ? { body: JSON.stringify(item.body) } : {}),
      signal: AbortSignal.timeout(180_000),
    })

    const text = await response.text()
    const ok = item.ok.includes(response.status)
    let bodyError = null
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error) bodyError = String(parsed.error)
    } catch {
      // Non-JSON bodies are fine for HTML error pages; the status tells the story.
    }

    return {
      ...item,
      expected: item.ok,
      status: response.status,
      ok,
      bodyError,
      ms: Date.now() - started,
      sample: text.slice(0, 160),
    }
  } catch (cause) {
    return {
      ...item,
      expected: item.ok,
      status: 0,
      ok: false,
      transportError: cause?.message || String(cause),
      ms: Date.now() - started,
    }
  }
}

async function main() {
  const roles = roleFilter ? [roleFilter] : ["public", "teacher", "student", "admin"]
  const all = []

  for (const role of roles) {
    const probes = PROBES[role]
    if (!probes) {
      console.error(`Unknown role: ${role}`)
      process.exit(1)
    }
    const cookie = role === "public" ? "" : await login(role)

    for (const item of probes) {
      const result = await probe(item, cookie)
      all.push({ role, ...result })
      const label = item.name || item.path
      console.log(
        `${result.ok ? "ok  " : "FAIL"} ${role.padEnd(7)} ${item.method.padEnd(4)} ${label.padEnd(34)} ${result.status} ${result.ms}ms`,
      )
      if (!result.ok) {
        if (result.transportError) console.log(`       transport: ${result.transportError}`)
        if (result.bodyError) console.log(`       error: ${result.bodyError}`)
        if (VERBOSE && result.sample) console.log(`       body: ${result.sample}`)
      }
    }
  }

  const failed = all.filter((row) => !row.ok)
  console.log(`\n${"-".repeat(72)}`)
  console.log(`checked ${all.length} API probes, ${failed.length} failing`)

  if (failed.length > 0) {
    for (const row of failed) {
      console.log(`\n${row.role} ${row.method} ${row.path}`)
      console.log(`  expected ${row.expected.join("|")}, got ${row.status}`)
      if (row.bodyError) console.log(`  error: ${row.bodyError}`)
      if (row.transportError) console.log(`  transport: ${row.transportError}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("check-api failed:", error)
  process.exit(1)
})
