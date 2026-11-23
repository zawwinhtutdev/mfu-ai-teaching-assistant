# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Conventional Commits](https://www.conventionalcommits.org/) and
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] — 2026-11-19

First public release: a course-scoped AI teaching assistant for Mae Fah Luang
University, deployed on Vercel + Supabase.

### Added

- Course-scoped RAG: instructor PDFs indexed per course, hybrid retrieval, strict
  grounding, verified/ repaired citations, and refusal when no evidence exists.
- Role-aware portals for students, teachers and administrators with server-side
  authorization (Supabase RLS + middleware guards).
- Google OIDC sign-in plus email/password; roles derived from the MFU email
  domain, with an explicit admin allowlist.
- Multi-teacher courses, course sections, assignments and deadline reminders,
  gradebook, quizzes, study plans, flashcards and analytics.
- Admin console: people and role management, courses/enrolments, policies,
  privacy/consent controls, audit log and notification operations.
- In-app documentation at `/docs`, seeded demo accounts, and a 36-student
  **Design Concept (1001143)** class.
- Production Docker/Caddy deployment, VPS runbooks, and a hosted Vercel path.

### Changed

- Retrieval and generation run in-process against one Supabase database; the
  FastAPI pipeline is retained as a reference implementation and evaluation harness.
- Gemini calls disable the hidden thinking budget and use a configurable,
  current model id; OpenAI is available as a hosted provider.
- Repository documentation, README, screenshots and open-source project files.

### Fixed

- Co-teachers can read the profiles of students enrolled in their courses.
- Google SSO button explains when the provider is unavailable instead of failing
  silently after a click.
- Deploy preflight validates credentials with a real generation; seed scripts no
  longer target the local database silently.
