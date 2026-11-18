// Rotate the seeded demo passwords on the hosted project.
//
// `supabase/seed.sql` creates 10 accounts (including an admin) all sharing the
// password "demo1234". On a public URL that is an open admin account, so every
// seeded account gets a fresh random password here. Prints a table to save.
//
// Usage: set -a && . ./.env.production && set +a && node scripts/rotate-demo-passwords.mjs
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const envFile = path.join(root, ".env.production")

// Allow running standalone without the caller sourcing .env.production.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    if (process.env[line.slice(0, eq).trim()] === undefined) {
      process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
    }
  }
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  process.exit(1)
}
if (URL_BASE.includes("localhost") || URL_BASE.includes("127.0.0.1")) {
  console.error(`Refusing to rotate passwords on a local database (${URL_BASE}).`)
  process.exit(1)
}

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
}

// A password that is long, unambiguous to read aloud, and not guessable.
function strongPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = randomBytes(20)
  let out = ""
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return `${out.slice(0, 20)}!9`
}

const usersRes = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=200`, { headers: adminHeaders })
if (!usersRes.ok) {
  console.error(`Could not list users: HTTP ${usersRes.status} ${(await usersRes.text()).slice(0, 200)}`)
  process.exit(1)
}
const { users = [] } = await usersRes.json()

// Only the accounts seed.sql created; leave any real signups untouched.
const SEEDED_DOMAINS = ["@lamduan.mfu.ac.th", "@mfu.ac.th"]
const seeded = users.filter((u) => SEEDED_DOMAINS.some((d) => (u.email || "").endsWith(d)))
if (seeded.length === 0) {
  console.log("No seeded accounts found — nothing to rotate.")
  process.exit(0)
}

const results = []
for (const user of seeded) {
  const password = strongPassword()
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    console.error(`FAILED ${user.email}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`)
    process.exitCode = 1
    continue
  }
  results.push({ email: user.email, password })
  console.log(`rotated ${user.email}`)
}

console.log("\n--- new credentials (store these; they are not recoverable from here) ---")
for (const r of results) console.log(`${r.email.padEnd(34)} ${r.password}`)

// Verify the old shared password no longer works, so this is not just a claim.
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (anonKey) {
  const probe = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@mfu.ac.th", password: "demo1234" }),
  })
  console.log(
    probe.ok
      ? "\n*** WARNING: admin@mfu.ac.th still accepts demo1234 ***"
      : "\nverified: demo1234 no longer works for admin@mfu.ac.th",
  )
  if (probe.ok) process.exitCode = 1
}
