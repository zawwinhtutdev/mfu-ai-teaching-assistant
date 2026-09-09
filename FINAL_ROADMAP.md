# Final Roadmap: AI Teaching Assistant

Date: February 16, 2026  
Last updated: February 17, 2026  
Scope source: `Project_Requirements_Official.md` + current codebase audit

## 1) Objective

Ship a production-ready AI Teaching Assistant that satisfies MVP and core system requirements:

- [x] Role-based login (Student/Teacher) and route protection.
- [x] Course-grounded FAQ chatbot for at least one course.
- [x] Lecture summarization + flashcards + quizzes from uploaded materials.
- [x] Assignment reminder system with real notification delivery.
- [x] Teacher dashboard with real analytics.
- [x] Privacy compliance (consent, retention, opt-out).

## 2) Current State Summary

- [x] Chat streaming + conversation persistence exists.
- [x] Real accounts now load portal/chat data from Supabase-backed loaders; mock data is limited to demo sessions.
- [x] Reminders/notifications, SSO, admin/audit, and compliance are implemented end-to-end.
- [x] Teacher settings and agent-builder placeholder pages are now wired to real data/actions.
- [x] Schema and migrations are now centralized under `supabase/migrations` with a bootstrap script.

## 3) Completed Since This Roadmap Was Written

- [x] Demo teacher and student accounts added with cookie-based demo session flow.
- [x] Demo logins now show mock-data-driven portal/chat experience.
- [x] Role-based middleware guards implemented for student-only and teacher-only routes.
- [x] Post-login redirect by role implemented.
- [x] Auth route normalization improved (`/login`, `/signup` primary; legacy `/auth/*` paths redirect).
- [x] Real-account portal/chat/course/analytics pages moved to server-side Supabase data loaders.
- [x] Mock fallback constrained to demo accounts/profile IDs (no mock fallback for normal real-user operation).
- [x] `npm run build` passes in current setup.

## 4) Delivery Phases

## Phase 0: Stabilization and Data Foundation (Week 1)

Deliverables:

- [x] Consolidate SQL migrations into a single canonical path.
- [x] Remove schema drift and add missing columns/tables:
  - [x] `chatbot_settings.system_prompt`, `grading_policy`, `course_rules`
  - [x] `announcements`, `announcement_files`
  - [x] `consents`, `audit_logs`, `notification_jobs`, `notification_deliveries`
- [x] Replace duplicated auth pages/routes and normalize URL structure.
- [x] Turn on strict build safety (remove `ignoreBuildErrors`).

Acceptance criteria:

- [x] Fresh database bootstrap works with one command sequence.
- [x] `npm run build` passes without TypeScript suppression.
- [x] All core entities are versioned by migrations only.

## Phase 1: Real Data Portals and Core RBAC (Weeks 2-3)

Deliverables:

- [x] Replace mock-data loaders with Supabase-backed server/client fetches for:
  - [x] Student portal
  - [x] Teacher portal
  - [x] Course pages and analytics pages
- [x] Role-based middleware guards:
  - [x] Student-only routes
  - [x] Teacher-only routes
- [x] Post-login redirect by role.
- [x] Course enrollment flow fixed (`?enroll=CODE` link actually enrolls).

Acceptance criteria:

- [x] No portal-critical screen depends on `lib/mock-data.ts` for real-account sessions.
- [x] Student cannot access teacher-only pages and vice versa.
- [x] Invite link enrollment completes and shows enrolled course immediately.

## Phase 2: Course-Grounded AI (RAG) and Study Tools (Weeks 4-5)

Deliverables:

- [x] FAQ knowledge ingestion pipeline:
  - [x] Upload files -> extract text -> chunk -> embed -> store vectors.
- [x] Retrieval-augmented `/api/chat`:
  - [x] retrieve top context by `course_id`
  - [x] strict grounding prompt + fallback when unknown.
- [x] Connect course chatbot settings (tone/system prompt/rules) into runtime prompt.
- [x] Summarization/flashcards/quizzes use extracted document content (not only manual text).

Acceptance criteria:

- [x] Chat answers cite/reflect uploaded course materials.
- [x] Teacher customization changes model behavior per course.
- [x] At least one pilot course has complete ingestion and QA pass.

## Phase 3: Teacher Operations and Analytics (Weeks 6-7)

Deliverables:

- [x] Announcement CRUD with attachments.
- [x] Student management CRUD:
  - [x] add/remove enrollment by user lookup
  - [x] optional invite dispatch trigger.
- [x] Teacher analytics backed by real query/reminder/enrollment events.
- [x] Quiz/flashcard views stop falling back to mock data in normal operation.

Acceptance criteria:

- [x] Teacher can create/edit/delete announcements and students see updates.
- [x] Teacher can manage enrollment from UI end-to-end.
- [x] Analytics charts reflect real DB events with expected counts.

## Phase 4: Reminders, Compliance, and Admin/IT (Weeks 8-10)

Deliverables:

- [x] Reminder scheduler + delivery channels:
  - [x] email first
  - [x] LINE/push optional second channel.
- [x] Consent + opt-out + retention policy implementation.
- [x] Audit logging for sensitive reads/writes and admin actions.
- [x] Admin role and minimal admin panel:
  - [x] user role management
  - [x] log viewer
  - [x] policy toggles.
- [x] SSO integration (OIDC/SAML via Supabase-compatible provider flow).

Acceptance criteria:

- [x] Reminder records move through queued/sent/failed lifecycle.
- [x] Users can view/modify consent and opt-out preference.
- [x] Audit trails are queryable with actor/time/action/resource.
- [x] SSO login works for at least one university identity provider test config.

## 5) Cross-Cutting Quality Gates (Every Phase)

- [x] Security: enforce RLS for every new table.
- [x] Observability: structured logs + API error tracking.
- [x] Testing:
  - [x] schema migration tests (baseline smoke checks)
  - [x] API integration tests (baseline smoke checks)
  - [x] role-access route tests (baseline smoke checks)
- [x] Performance:
  - [x] index review for heavy analytics/retrieval queries
  - [x] chat response latency baseline and regression checks.

## 6) Requirement Traceability (High-Level)

- [x] Student FAQ chatbot -> Phase 2.
- [x] Lecture summarization + flashcards + quizzes -> Phase 2.
- [x] Reminders + notifications -> Phase 4.
- [x] Teacher dashboard + analytics -> Phase 3.
- [x] Customization (tone/rules/policies) -> Phase 2.
- [x] RBAC + SSO + Admin + audit -> Phases 1 and 4.
- [x] Privacy/PDPA/GDPR compliance -> Phase 4.

## 7) Recommended Execution Order (Priority)

1. Phase 0 (required foundation)
2. Phase 1 (remove mock dependency + enforce RBAC)
3. Phase 2 (MVP intelligence quality)
4. Phase 3 (teacher operational completeness)
5. Phase 4 (compliance + enterprise readiness)
