# MFU AI Teaching Assistant

A course-scoped RAG assistant for university teaching: teachers upload PDFs into
the courses they own, students ask questions about the courses they are enrolled
in, and every answer is cited or refused.

![Teacher portal — course-scoped document RAG](docs/assets/teacher-documents-rag.png)

Built as a full-stack replacement for a TypeScript/Supabase prototype: the web
app stays Next.js, and retrieval, documents, and access control now live in a
Python service backed by PostgreSQL + pgvector and local models via Ollama.

---

## Why

Most "chat with your PDF" demos answer from any file in one big pile. That does
not survive contact with a university:

- A student in CSD322 must not read CSB321's exam memo.
- An answer about a deadline must point at the page it came from.
- A model that has not read the material should say so instead of inventing it.

This project makes those three properties structural rather than hopeful: access
is enforced in the service, retrieval is scoped to one course, and answers carry
citations that are verified after generation.

## What it does

| Role | Can do |
| --- | --- |
| **Teacher** | See only their courses, upload material into them, post assignments with deadlines, read analytics, manage course assistant settings |
| **Student** | See only enrolled courses, read uploaded material, ask grounded questions with citations, see assignment deadlines |
| **Admin** | Platform overview: people, courses, enrollments, documents, indexed chunks |

Behaviour worth highlighting:

- **Course selector drives everything.** The document list, the chat, and the
  citations all follow the selected course; switching clears the conversation.
- **Enrollment is a database row, not a UI filter.** Requesting another course's
  chat or assignments returns `403` even if the URL is edited by hand.
- **Retrieval is scoped by the caller, not by the request.** The course is
  authorised before retrieval runs, and an unauthorised request is refused
  outright rather than falling through to a wider search.
- **Refusal over guessing.** If retrieval finds nothing relevant, the assistant
  replies *"The course materials do not cover this."* — and the refusal is
  recorded, so teachers can see which questions their material does not answer.
- **Citations are repaired.** When a small local model attaches a claim to the
  wrong source number, the marker is rewritten to the passage that actually
  supports it, and the change is reported.
- **Deadlines create reminders.** Releasing an assignment schedules one reminder
  per enrolled student ahead of the due date. Re-running the scheduler is
  idempotent, so the daily job cannot produce duplicates.
- **Consent gates logging, not answers.** A student who withdraws AI-processing
  consent still gets answers; their questions are simply not stored.
- **Per-course dedupe.** The same PDF in two courses is two documents, so each
  course owns its copy.

## Architecture

Retrieval and generation both run inside the Next.js server, against the same
Supabase database the portal pages read. There is no second database, so a
course id means exactly one thing.

```mermaid
flowchart LR
    subgraph Browser
      UI[Next.js App Router<br/>teacher / student / admin]
    end

    subgraph Web["Next.js server"]
      R[Route handlers<br/>/api/chat · /api/courses/:id/assignments]
      P[RAG pipeline<br/>chunk → embed → retrieve → build context → generate → repair]
      S[Assignment reminder scheduler]
    end

    subgraph Data
      PG[(Supabase PostgreSQL<br/>+ pgvector<br/>profiles · courses · enrollments<br/>course_materials · course_material_chunks<br/>faqs · assignments · study_reminders)]
      O[Ollama<br/>qwen2.5:7b<br/>nomic-embed-text]
    end

    UI -->|fetch / SSE| R
    R --> P
    R --> S
    P --> PG
    P --> O
    S --> PG
```

The browser never talks to the database and never decides what it may read.
Every course-scoped request is re-checked server-side by `assertCourseAccess`,
which understands both course codes and UUIDs so demo sessions and real
sessions take the same path.

### Why there is no separate API service

An earlier version had a FastAPI service with its own Postgres. Courses were
UUIDs in Supabase and slugs (`course-csb321`) in that second database, so every
course-scoped chat request was rejected with `403` before retrieval ran. The
pipeline was ported into the web app instead: one process, one database, no id
translation. `services/api` remains in the repository as the reference
implementation and evaluation harness, but it is not on the request path.

## Tech stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/Radix |
| Data | Supabase PostgreSQL + pgvector (`match_course_material_chunks`, `match_faqs`) |
| Models | Ollama: `qwen2.5:7b` (chat) and `nomic-embed-text` (768-dim embeddings); Gemini optional |
| Streaming | AI SDK UI message stream: `start → text-delta → text-end → finish` |
| Packaging | Docker Compose, or local processes via `scripts/dev.sh` |

## How an answer is produced

1. **Extract** — PDF text page by page, `.docx`/`.pptx` by reading the OOXML text
   runs out of the zip, audio via transcription. Control characters are stripped
   so the text can be stored safely (`0x00` in a parser dump is a real failure
   mode).
2. **Chunk** — ~1,400 characters with 220 overlap, split on paragraph or sentence
   boundaries so a chunk does not end mid-sentence.
3. **Embed** — one 768-dim vector per chunk via `nomic-embed-text`, unit
   normalised. The width matches the `vector(768)` column, so no schema change is
   needed when swapping between Ollama and Gemini embeddings.
4. **Retrieve** — cosine similarity through `match_course_material_chunks`,
   scoped to one course the caller is authorised for. FAQ answers are searched
   too and rank ahead of material chunks, because a teacher wrote them on purpose.
5. **Build context** — chunks are deduplicated (Jaccard ≥ 0.8), numbered `[1]…[n]`,
   and capped by a character budget. The budget stops adding sources rather than
   truncating one, because a half-supplied chunk produces citations that look
   supported but are not.
6. **Generate** — the passages go into a prompt with a strict grounding rule and a
   fixed refusal sentence. No sources means the refusal is emitted without
   spending a model call.
7. **Repair** — streaming and citation checking pull in opposite directions, so
   the user sees deltas as they are generated and the persisted text is corrected
   afterwards: any marker another passage supports better is rewritten, and
   duplicate markers collapse. Every change is reported, never silent.

The context budget is 6,000 characters. It was 2,400 until an evaluation run
showed ordinary questions refusing because only two chunks ever reached the
model — the single highest-impact fix in the project.

## Quickstart

### Authentication (real RBAC)

Signup and login run against a local Supabase stack. Roles are stored in
`public.profiles.role` and enforced by RLS plus a route guard in middleware.

```bash
supabase start          # API :54321, DB :54322, Studio :54323, Mail :54324
supabase db reset       # re-apply migrations + seed demo content
```

`.env.local` already points at the stack. Seeded accounts all use password
`demo1234`:

| Role | Email |
| --- | --- |
| Admin | `admin@mfu.ac.th` |
| Teacher | `anan.suwan@mfu.ac.th`, `malee.chaiyaporn@mfu.ac.th`, `somchai.prasert@mfu.ac.th` |
| Student | `6631503078@lamduan.mfu.ac.th`, `6631503085@lamduan.mfu.ac.th`, and four more |

New signups get a real `profiles` row via the `on_auth_user_created` trigger and
land in a portal populated with the same demo courses, enrollments, and
materials the old mock data showed.

**Role is derived from the email address, never chosen by the user.**

MFU issues distinct address patterns per population, and both domains are
controlled by the university's Google Workspace, so the address a person
authenticates with is proof of who they are:

| Address pattern | Role |
| --- | --- |
| `<studentID>@lamduan.mfu.ac.th` | `student` |
| `<firstname.last>@mfu.ac.th` | `teacher` |
| anything in `ADMIN_EMAILS` (default `admin@mfu.ac.th`) | `admin` |
| any other domain | **rejected** at insert |

The rule lives in `public.role_for_email()`
(`supabase/migrations/20261231000100_role_from_email.sql`) and is applied by the
signup trigger. This holds for **both** password signup and Google sign-in, so
teachers can self-provision with no admin step.

Admin is checked first because `admin@mfu.ac.th` sits on the teacher domain.
Because a fallback is exactly how the previous version let anyone claim
"teacher", an unrecognised address is rejected rather than defaulted.

The signup form previews the outcome live as the user types (`lib/auth/role-from-email.ts`)
but never sends a role — the database decides. An admin can still change a role
in the Admin Console, and the change is audited.

### Email confirmation

Email confirmation is **enabled**, matching production behaviour. After signing
up, the user sees "Check Your Email" and must open the link before they can log
in. Locally, no real email is sent — Supabase captures every message in Mailpit:

- Mailpit inbox: <http://localhost:54324>
- Open the message, click the confirmation link, and you are signed in and
  redirected to the portal for your role.

The link redirects through `/auth/callback`, which exchanges the PKCE code,
creates the session, and routes by role from `public.profiles`. Because the flow
uses PKCE, **the link must be opened in the same browser that signed up** — the
code verifier lives in that browser's storage. Opening it elsewhere returns
`?error=oauth_failed`.

Seeded accounts (below) are pre-confirmed, so they skip this step.

On Vercel, add the deployment URL to the hosted project's redirect allow-list
and configure a real SMTP provider under Authentication → Emails.

### Google sign-in

The login page offers "Google SSO" whenever two conditions hold: Supabase has
Google credentials configured, and the admin policy `allow_google_sso` is on.
Otherwise the button is disabled with an explanatory tooltip — it never fails
after a click.

**1. Create a Google OAuth client.** At
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → *Create OAuth client ID* → **Web application**. Register the
**Supabase** callback as the redirect URI, not the app:

```
http://127.0.0.1:54321/auth/v1/callback          # local
https://<project-ref>.supabase.co/auth/v1/callback   # hosted
```

**2. Export the credentials** before starting Supabase (see
`.envrc.private.example`):

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="..."
supabase stop && supabase start
```

`supabase/config.toml` substitutes these into `[auth.external.google]`. Without
them the provider still reports as enabled but Google returns
`invalid_client`, so the button is the only thing that tells you they are
missing — check `/api/auth/google/status`.

**3. On Vercel**, set the same pair in the hosted Supabase project under
Authentication → Providers → Google.

Behaviour worth knowing:

- Only `@mfu.ac.th` addresses are accepted. A database trigger enforces this on
  insert, and `/auth/callback` re-checks before creating a session.
- Google sign-in always creates a **student**. A teacher must be promoted to
  `teacher` in the Admin Console — Google never conveys a role.
- If someone already registered with a password, signing in with Google using
  the same address is rejected with an `account_exists` message rather than
  silently merging, because Supabase automatic linking is off.
- The display name falls back through `full_name` → `name` → the email local
  part, since Google sends a different metadata key than the signup form.

### Docker

```bash
cp .env.example .env.local     # fill in what you have; demo auth needs very little
docker compose up --build
```

Web on <http://localhost:3000>, API on <http://localhost:8000/docs>.

### Local processes

```bash
# database (the db service is behind the "platform" profile)
docker compose --profile platform up -d db

# api
cd services/api
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/alembic upgrade head
PYTHONPATH=. .venv/bin/python scripts/seed_academic.py
PYTHONPATH=. .venv/bin/python scripts/seed_documents.py
ALLOW_INSECURE_DEV_AUTH=true ENVIRONMENT=local \
  DATABASE_URL="postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata" \
  AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b \
  .venv/bin/python -m uvicorn app.main:app --port 8000

# web
npm install
npm run dev
```

Or the shortcut that starts both and prints the links:

```bash
./scripts/dev.sh start     # start | stop | restart | status
./scripts/dev.sh seed      # academic rows + demo course PDFs (idempotent)
```

### Local models

```bash
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

With `AI_PROVIDER=ollama` nothing leaves the machine. Set
`AI_PROVIDER=gemini` plus `GOOGLE_GENERATIVE_AI_API_KEY` to use a cloud model
instead; `AI_PROVIDER=stub` gives deterministic fakes for tests.

## Demo accounts

Demo auth is cookie-based (`mfu_demo_role`, `mfu_demo_email`) and only active
when `ALLOW_INSECURE_DEV_AUTH=true`.

| Email | Password | Role | Courses |
| --- | --- | --- | --- |
| `anan.suwan@mfu.ac.th` | `demo1234` | Teacher | CSB321, CSD323 |
| `malee.chaiyaporn@mfu.ac.th` | `demo1234` | Teacher | CSD322, CSA411 |
| `somchai.prasert@mfu.ac.th` | `demo1234` | Teacher | CSM324, GEN311, AI-EDU |
| `6631503078@lamduan.mfu.ac.th` | `demo1234` | Student | CSB321, CSD322, CSM324 |
| `6631503092@lamduan.mfu.ac.th` | `demo1234` | Student | CSD323, GEN311 |
| `admin@mfu.ac.th` | `demo1234` | Admin | all |

Sign in at `/login` with any of these — they are ordinary Supabase accounts, not
a special demo path. The full list, including how to reset a password or add an
account the normal way, is in [docs/TEST_ACCOUNTS.md](docs/TEST_ACCOUNTS.md).

## Configuration

Set in `.env.local` (web) or the environment. The web app reads these directly;
`services/api` (the reference implementation) reads them through
`pydantic-settings`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `auto` | `ollama`, `gemini`, or `auto` (Ollama when no Gemini key exists) |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Chat model, used for chat, summaries, quizzes and flashcards |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model (must stay 768-dim for the schema) |
| `ALLOW_INSECURE_DEV_AUTH` | `false` | Enables the demo cookie principal |
| `COURSE_RAG_CHUNK_CHARS` / `..._OVERLAP_CHARS` | `1400` / `220` | Chunking |
| `COURSE_RAG_MAX_CONTEXT_CHARS` | `22000` | Character budget sent to the model |
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | Only for `AI_PROVIDER=gemini` |
| `RESEND_API_KEY` | — | Email delivery for reminders |
| `NOTIFICATION_FROM_EMAIL` | `MFU AI Assistant <no-reply@…>` | Sender address |
| `NOTIFICATIONS_DRY_RUN` | `false` | Log instead of sending, without a provider key |
| `LINE_CHANNEL_ACCESS_TOKEN` | — | LINE Messaging API delivery |
| `REMINDER_LEAD_HOURS` | `24` | How far ahead of a deadline to remind |
| `CRON_SECRET` | — | Bearer token for `/api/notifications/process` |
| `DATA_RETENTION_DAYS` | `30` | Log retention window, also shown on `/privacy` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Server-side privileged reads (demo sessions, cron) |

## Project layout

```
app/                     Next.js routes (portals, chat, docs, API handlers)
components/              UI: knowledge console, portals, chat, docs shell
content/docs/            Documentation pages (Markdown)
lib/                     Session, academic helpers, demo auth, docs config
services/api/            FastAPI service
  app/routers/           chat, documents, search, health
  app/rag/               ingest, chunking, retrieval, fusion, citations, pipeline
  app/academic.py        people / courses / enrollments + access checks
  migrations/            Alembic
  scripts/               seed_academic.py, seed_documents.py
  tests/                 87 tests
scripts/                 dev.sh, smoke checks, latency baseline
docs/                    assets, archive
```

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/chat` | SSE answer (`sources → start → delta → done`); requires course access |
| `GET` | `/v1/me` , `/v1/me/courses` | Caller identity and visible courses |
| `GET` | `/v1/courses/{id}` | Course detail, access checked |
| `GET` | `/v1/documents?course_id=` | Course documents, scoped to the caller |
| `POST` | `/v1/documents` | Teacher-only upload into a course they teach, 25 MB PDF |
| `DELETE` | `/v1/documents/{id}` | Teacher of that course only; removes document and chunks |
| `POST` | `/v1/search` | Hybrid search inside the caller's course scope |
| `GET` | `/v1/stats` | Platform counters |
| `GET` | `/health`, `/ready` | Liveness, readiness |

## Evaluation

A 25-question set (answerable, borderline, unanswerable) runs against three
retrieval settings and reports recall, refusal accuracy, citation validity,
citation support, and latency.

Latest run on a laptop with `qwen2.5:7b`:

| Metric | Result |
| --- | --- |
| Answer accuracy | 100% (5/5, target ≥ 85%) |
| Refusal accuracy | 100% (3/3) |
| Citation validity | 100% (5/5 answered) |
| Latency | p50 ≈ 0.7 s, p95 ≈ 2.1 s |

Answer accuracy is measured by `npm run eval:answers`, which checks the facts a
correct answer must contain rather than scoring the prose. It is a small set (8
cases on one course), so treat it as a regression guard rather than a claim about
the system in general: recall, refusal and citation validity were the metrics
that caught real bugs, and they are reported separately so a failure names the
part that broke.

Citation support (whether the cited passage actually supports the claim, as
opposed to whether the marker is well-formed) sits around 80% after repair; the
remaining cases are claims spread across two passages that one citation cannot
represent. Prompt variants (quote-first, two-step) were tried and did **not** beat
the baseline, so the default stays `top_k=5` + citation repair.

## Testing

```bash
npm run type-check          # tsc --noEmit
npm run test:roadmap        # structural smoke checks
npm run eval:answers        # answer accuracy against the live pipeline
npm run reindex             # rebuild chunk embeddings (idempotent)

cd services/api && .venv/bin/python -m pytest -q   # reference pipeline, 87 tests
```

The access-control behaviour is verified through the API: a student not enrolled
in a course receives `403` for chat and for assignments, and a student asking
about a course they are enrolled in receives a cited answer.

## Documentation

The app ships its own documentation at `/docs` (sources in `content/docs/`):

- Platform architecture
- How answers are grounded
- Local AI models
- Roles and access
- Document RAG workspace (teacher and student views)

![Documentation — how answers are grounded](docs/assets/grounded-answers.png)

## Known limitations

- **Citations are text, not links.** They carry filename and section, but do not
  open the PDF at that page yet.
- **No OCR.** Scanned PDFs produce no extractable text; `.docx` and `.pptx` are
  parsed as XML, so text in embedded images is not seen.
- **Email and LINE delivery need credentials.** Without `RESEND_API_KEY` (or
  `NOTIFICATIONS_DRY_RUN=true`) queued email jobs fail with an explicit error
  rather than pretending to send. LINE needs `LINE_CHANNEL_ACCESS_TOKEN` and a
  linked LINE user id.
- **Single-node ingestion.** Good for a course, not for a faculty.
- **No LMS sync, SAML, or AES-256 at rest.** `/api/lms` is a stub; SSO is Google
  OIDC only; encryption at rest is whatever the host provides.
- Demo auth is intentionally insecure and must stay behind
  `ALLOW_INSECURE_DEV_AUTH`.

## Roadmap

- [x] Persist questions and answers with feedback
- [x] Instructor analytics on unanswered questions
- [x] Deadline-driven assignment reminders
- [x] Consent capture and a published privacy notice
- [ ] Clickable citations that open the source page
- [ ] Per-course unique constraints on document titles
- [ ] OCR fallback for scanned material and image-only slides
- [ ] LMS (Moodle/Canvas) roster and assignment sync

## Credits

Coursework project for the AI for Delivery portfolio; the original prototype was
a TypeScript/Supabase app, and this repository replaces its backend with the
Python service described above.

## License

MIT — see [LICENSE](LICENSE).
