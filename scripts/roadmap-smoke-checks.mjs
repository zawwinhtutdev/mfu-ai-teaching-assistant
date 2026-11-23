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
expectFile("lib/server/query-logging.ts", "consent-aware query logging")
expectFile("lib/ai/transcription.ts", "provider-agnostic audio transcription")
expectFile("scripts/seed-course-content.mjs", "FAQ and assignment seeding")
expectFile("components/teacher/materials-review-panel.tsx", "material approval UI")
expectFile("components/teacher/survey-panel.tsx", "SUS/satisfaction survey UI")

/* ── Spec features must stay wired, not just present ── */

// Generation without persistence is the bug this suite exists to prevent:
// students were told to "check the Flashcards tab", which was always empty.
expectContains(
  "app/api/generate-flashcards/route.ts",
  /from\("flashcards"\)\s*\.insert|\.from\("flashcards"\)\.insert/,
  "flashcard generation must persist the deck, not just return it",
)
expectContains(
  "app/api/generate-quiz/route.ts",
  /from\("quizzes"\)/,
  "quiz generation must persist the quiz",
)
expectContains(
  "app/api/summarize/route.ts",
  /material_summaries|summary_text/,
  "summaries must be stored so they survive a reload",
)

// The approval gate is meaningful only if the RLS policy reads the column.
expectContains(
  "supabase/migrations/20261118001000_study_assets_and_approval_gate.sql",
  /approval_status = 'published'/,
  "students must not be able to read draft materials",
)

// Audio must not be hard-wired to a cloud provider while AI_PROVIDER is local.
expectContains(
  "lib/ai/transcription.ts",
  /findWhisperBinary/,
  "audio transcription must try a local provider before any cloud call",
)

// PDPA: unattributed logging must be possible.
expectContains(
  "supabase/migrations/20261118002000_anonymized_query_logs.sql",
  /drop not null/,
  "student_queries.student_id must allow null so anonymized logs can be stored",
)

// Admin member management is split by role, chosen from the sidebar rather than
// a tab bar on the page, so a teacher is never buried among hundreds of students.
expectContains(
  "app/admin/dashboard/users/page.tsx",
  /searchParams\.get\("role"\)/,
  "user management must take the role view from the URL",
)
expectContains(
  "components/admin/admin-shell.tsx",
  /label: "Teachers"/,
  "the sidebar must offer a Teachers view under Members",
)

// The role-change guard must read the JWT claim shape PostgREST actually sets.
// Reading only `request.jwt.claim.role` rejected every admin role change with a
// 500, because current PostgREST publishes `request.jwt.claims` as JSON.
expectContains(
  "supabase/migrations/20261118003000_fix_role_guard_jwt_claims.sql",
  /request\.jwt\.claims/,
  "the role guard must support the current request.jwt.claims payload",
)

// Course detail and section data: an admin-created course carries a full
// academic record, not just a code and title.
expectFile(
  "supabase/migrations/20261118005000_course_details_and_sections.sql",
  "course detail columns and the sections table",
)
expectContains(
  "supabase/migrations/20261118005000_course_details_and_sections.sql",
  /create table if not exists public\.course_sections/,
  "sections must have their own table",
)

// The course dialog is deliberately limited to identity, placement, and
// ownership. Grading, the credit split, and section editing were removed from
// the form on request, so this guards against them creeping back in.
expectContains(
  "components/admin/course-dialog.tsx",
  /academicYear/,
  "the course dialog must capture the academic year",
)
expectContains(
  "components/admin/course-dialog.tsx",
  /furtherInformation/,
  "the course dialog must capture further information",
)

// Course timetables must reach the calendar: a section's timetable text is
// parsed to a weekday and expanded into one event per week.
expectFile("lib/course-schedule.ts", "timetable parsing and weekly expansion")
expectContains(
  "lib/course-schedule.ts",
  /weeklyDatesInMonth/,
  "schedules must expand into weekly dates",
)
expectFile("app/api/course-schedules/route.ts", "class schedule API for the calendar")
expectContains(
  "app/dashboard/teacher/calendar/page.tsx",
  /buildClassScheduleItems/,
  "the teacher calendar must include class schedules",
)
expectFile("components/admin/course-schedule-dialog.tsx", "weekly schedule editor")

// A teacher must be able to open their own course roster. Two bugs made the
// list useless: it was generated from a count (invented names), and the course
// page's only roster UI sat in a tab with no trigger, so it was unreachable.
expectContains(
  "lib/server/session-data.ts",
  /enrolledStudents/,
  "the teacher course page must receive real enrolled students",
)
expectContains(
  "supabase/migrations/20261118006000_teacher_can_read_own_students.sql",
  /c\.teacher_id = auth\.uid\(\)/,
  "a teacher may read profiles only for students in their own courses",
)

// Adding a student must not depend on that student having signed in already.
// The dialog previously looked profiles up from the browser, where RLS hides
// every un-enrolled account, so it reported "No student accounts found" even
// for real students. The server route resolves addresses and stores an
// invitation when there is no account yet.
expectFile(
  "supabase/migrations/20261119004000_course_invitations.sql",
  "pending course invitations",
)
expectContains(
  "supabase/migrations/20261119004000_course_invitations.sql",
  /create table if not exists public\.course_invitations/,
  "course invitations must be persisted",
)
expectContains(
  "supabase/migrations/20261119004000_course_invitations.sql",
  /delete from public\.course_invitations/,
  "signup must claim pending invitations",
)
expectFile(
  "app/api/teacher/courses/[courseId]/students/route.ts",
  "teacher roster management API",
)
expectContains(
  "components/teacher/manage-students-dialog.tsx",
  /api\/teacher\/courses/,
  "the roster dialog must use the authorized server route",
)
expectContains(
  "components/teacher/manage-students-dialog.tsx",
  /pendingInvitations/,
  "the roster dialog must show pending invitations",
)

// Profile pictures: `profiles.avatar_url` existed but nothing could populate it
// — no bucket, no endpoint, no UI.
expectFile("supabase/migrations/20261118007000_avatar_storage.sql", "avatar storage bucket")
expectFile("app/api/profile/avatar/route.ts", "avatar upload endpoint")
expectFile("components/profile/avatar-upload.tsx", "avatar uploader used by both roles")
expectContains(
  "components/teacher/settings-page.tsx",
  /AvatarUpload/,
  "teachers must be able to upload a profile photo",
)
expectContains(
  "components/student/settings-page.tsx",
  /AvatarUpload/,
  "students must be able to upload a profile photo",
)

// Uploaded course files must be retrievable. The route used to read the PDF for
// text and discard it, leaving `file_url` null — so the source document could
// never be opened again.
expectFile("supabase/migrations/20261118008000_material_file_storage.sql", "course material file storage")
expectContains(
  "app/api/courses/[courseId]/materials/route.ts",
  /storeMaterialFile/,
  "uploaded materials must be stored, not just parsed",
)
expectContains(
  "components/student/material-card.tsx",
  /material\.file_url/,
  "a student must be able to open the uploaded file",
)

// Materials must be newest-first everywhere. The API ordered descending while
// the server-rendered list ordered ascending, so the page showed the oldest
// upload first and only corrected itself after a refetch.
expectContains(
  "lib/server/session-data.ts",
  /order\("created_at", \{ ascending: false \}\)/,
  "materials must be sorted newest first in the server-rendered list",
)

// The portal addresses a course by Supabase uuid; the RAG service uses its own
// `course-<code>` ids. Without translation, every teacher upload was rejected
// with "You do not have access to this course".
expectFile("lib/server/course-id-map.ts", "course id translation between the two databases")
expectContains(
  "app/api/rag/documents/route.ts",
  /toRagCourseId/,
  "RAG document uploads must translate the portal course id before proxying",
)
expectContains(
  "app/api/rag/documents/route.ts",
  /mapDocumentCourseIds/,
  "RAG responses must translate course ids back to portal uuids",
)

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
