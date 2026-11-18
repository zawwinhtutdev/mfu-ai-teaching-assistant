#!/usr/bin/env node
/**
 * Sign in as a seeded account and print a Supabase SSR cookie header.
 *
 * Usage: node scripts/dev-cookie.mjs <email> [password]
 */
import fs from "node:fs"
import process from "node:process"

for (const rawLine of fs.readFileSync(".env.local", "utf8").split("\n")) {
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

const email = process.argv[2]
const password = process.argv[3] || "demo1234"
if (!email) {
  console.error("usage: node scripts/dev-cookie.mjs <email> [password]")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: anon },
  body: JSON.stringify({ email, password }),
})

const session = await res.json()
if (!session?.access_token) {
  console.error("login failed:", JSON.stringify(session).slice(0, 200))
  process.exit(1)
}

const stored = {
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  expires_in: session.expires_in ?? 3600,
  token_type: "bearer",
  user: session.user,
}

const ref = new URL(url).hostname.split(".")[0]
const encoded = "base64-" + Buffer.from(JSON.stringify(stored)).toString("base64")
process.stdout.write(`sb-${ref}-auth-token=${encodeURIComponent(encoded)}`)
