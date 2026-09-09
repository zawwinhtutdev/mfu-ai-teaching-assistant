#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const failures = []

function readFile(relativePath) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing file: ${relativePath}`)
    return ""
  }
  return fs.readFileSync(fullPath, "utf8")
}

function expectContains(relativePath, pattern, description) {
  const text = readFile(relativePath)
  if (!text) return
  const ok = typeof pattern === "string" ? text.includes(pattern) : pattern.test(text)
  if (!ok) failures.push(`Check failed: ${description} (${relativePath})`)
}

function expectFile(relativePath, description) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing file for ${description}: ${relativePath}`)
  }
}

expectFile("app/api/chat/route.ts", "chat API")
expectFile("app/api/reminders/route.ts", "reminders API")
expectFile("app/api/notifications/process/route.ts", "notification processor API")
expectFile("app/api/documents/[id]/reindex/route.ts", "PDF reindex API")
expectFile("app/admin/page.tsx", "admin panel page")

expectContains(
  "lib/supabase/middleware.ts",
  /studentportal|teacherportal|\/admin/,
  "role-based route checks should include student/teacher/admin routes",
)

expectContains(
  "supabase/migrations/20260217114000_phase0_schema_foundation.sql",
  "create table if not exists public.notification_jobs",
  "notification jobs migration should exist",
)
expectContains(
  "supabase/migrations/20260217114000_phase0_schema_foundation.sql",
  "create table if not exists public.audit_logs",
  "audit logs migration should exist",
)
expectContains(
  "supabase/migrations/20260217162000_phase2_rag_chunks_and_jobs.sql",
  "create table if not exists public.course_material_chunks",
  "course chunk vector table migration should exist",
)
expectContains(
  "components/chat/documents-page.tsx",
  "pdfRagEnabled: true",
  "documents sidebar chat should force PDF-RAG mode",
)

if (failures.length > 0) {
  console.error("Roadmap smoke checks failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("Roadmap smoke checks passed.")

