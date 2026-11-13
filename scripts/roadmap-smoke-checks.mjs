#!/usr/bin/env node
/**
 * Structural smoke checks.
 *
 * These are guardrails for the seams that have broken before, not a test suite:
 * they assert the pieces that must exist together still do, and fail loudly if a
 * refactor removes one half of a pair.
 *
 * The previous version required `components/chat/documents-page.tsx` and forced
 * `pdfRagEnabled: true` in it. That component no longer exists, so the check
 * failed on every run and stopped being useful. It also asserted on the retired
 * FastAPI proxy, which is no longer on the chat path.
 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const failures = []

function read(relativePath) {
  const full = path.join(root, relativePath)
  if (!fs.existsSync(full)) {
    failures.push(`Missing file: ${relativePath}`)
    return ""
  }
  return fs.readFileSync(full, "utf8")
}

function expectContains(relativePath, pattern, description) {
  const text = read(relativePath)
  if (!text) return
  const ok = typeof pattern === "string" ? text.includes(pattern) : pattern.test(text)
  if (!ok) failures.push(`Check failed: ${description} (${relativePath})`)
}

function expectFile(relativePath, description) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`Missing file for ${description}: ${relativePath}`)
  }
}

/* ── Files that must exist ── */

expectFile("app/api/chat/route.ts", "chat API")
expectFile("app/api/reminders/route.ts", "reminders API")
expectFile("app/api/notifications/process/route.ts", "notification processor API")
expectFile("app/api/courses/[courseId]/assignments/route.ts", "assignments API")
expectFile("app/privacy/page.tsx", "privacy notice page")
expectFile("lib/ai/ollama.ts", "local model client")
expectFile("lib/ai/grounding.ts", "grounded answer pipeline")
expectFile("lib/server/principal.ts", "identity and course-access resolver")
expectFile("lib/server/assignment-reminders.ts", "deadline reminder scheduler")
expectFile("scripts/eval-answers.mjs", "answer-accuracy evaluation")

/* ── Chat must answer from one database, in-process ── */

expectContains(
  "lib/ai/local-chat.ts",
  /retrieveCourseRagContext/,
  "local chat should do retrieval in-process rather than proxying to a second service",
)
expectContains(
  "lib/ai/local-chat.ts",
  /groundedSystemPrompt/,
  "local chat should ground answers in retrieved sources",
)

expectContains(
  "app/api/chat/route.ts",
  /assertCourseAccess/,
  "chat must authorize the requested course before retrieving",
)
expectContains(
  "app/api/chat/route.ts",
  /onComplete/,
  "chat must persist the exchange on the local-model path so analytics is populated",
)

/* ── Reminders must carry a destination ── */

expectContains(
  "lib/server/notification-jobs.ts",
  /payload\.email|email: params\.email/,
  "queued notification jobs must include the delivery address",
)

/* ── Schema that the code depends on ── */

expectContains(
  "supabase/migrations/20261118000000_assignments_and_approval.sql",
  "approval_status",
  "course_materials.approval_status column must be migrated",
)
expectContains(
  "supabase/migrations/20261118000000_assignments_and_approval.sql",
  "create table if not exists public.assignments",
  "assignments table must be migrated",
)

if (failures.length > 0) {
  console.error("Smoke checks failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("Smoke checks passed.")
