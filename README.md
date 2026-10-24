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
| **Teacher** | See only their courses, upload PDFs into them, ask questions grounded in their material, manage course assistant settings |
| **Student** | See only enrolled courses, read uploaded material, ask grounded questions with citations |
| **Admin** | Platform overview: people, courses, enrollments, documents, indexed chunks |

Behaviour worth highlighting:

- **Course selector drives everything.** The document list, the chat, and the
  citations all follow the selected course; switching clears the conversation.
- **Enrollment is a database row, not a UI filter.** Requesting another course's
  documents or chat returns `403` even if the URL is edited by hand.
- **Refusal over guessing.** If retrieval finds nothing relevant, the assistant
  replies *"The course materials do not cover this."*
- **Citations are repaired.** When a small local model attaches a claim to the
  wrong source number, the marker is rewritten to the passage that actually
  supports it, and the change is reported.
- **Per-course dedupe.** The same PDF in two courses is two documents, so each
  course owns its copy.

## Architecture

```mermaid
flowchart LR
    subgraph Browser
      UI[Next.js App Router<br/>teacher / student / admin]
    end

    subgraph Web["Next.js server"]
      R[Route handlers<br/>/api/chat/stream<br/>/api/rag/documents]
    end

    subgraph API["FastAPI service :8000"]
      A[Auth + access checks]
      P[RAG pipeline<br/>chunk → embed → retrieve → fuse → generate → repair]
      D[Documents + ingestion]
    end

    subgraph Data
      PG[(PostgreSQL 16<br/>+ pgvector<br/>people · courses · enrollments<br/>documents · chunks)]
      O[Ollama<br/>qwen2.5:7b<br/>nomic-embed-text]
    end

    UI -->|fetch / SSE| R
    R -->|identity header| A
    A --> P
    A --> D
    P --> PG
    D --> PG
    P --> O
```

The browser never talks to the database and never decides what it may read.

## Tech stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/Radix |
| API | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async), asyncpg, Alembic |
| Data | PostgreSQL 16 + pgvector (HNSW + GIN on a generated `tsv`) |
| Models | Ollama: `qwen2.5:7b` (chat) and `nomic-embed-text` (768-dim embeddings); Gemini optional |
| Streaming | Server-sent events: `sources → start → delta → done → [DONE]` |
| Packaging | Docker Compose (web, api, db, redis) or local processes |

## How an answer is produced

1. **Extract** — PDF text page by page; control characters are stripped so the
   text can be stored safely (`0x00` in a pypdf dump is a real failure mode).
2. **Chunk** — ~1,200 characters with 200 overlap, keeping page numbers and the
   nearest section heading.
3. **Embed** — one 768-dim vector per chunk.
4. **Index** — the same chunk is also indexed for keyword search.
5. **Retrieve** — cosine similarity and lexical match, scoped to one course.
6. **Fuse** — reciprocal rank fusion (k=60) so exact terms and paraphrases both
   survive.
7. **Generate** — top passages go into the prompt with a strict grounding rule
   and a fixed refusal sentence.
8. **Check** — every cited sentence is compared against the supplied passages;
   a better-matching source replaces a wrong marker.

The context budget is 6,000 characters. It was 2,400 until an evaluation run
showed ordinary questions refusing because only two chunks ever reached the
model — the single highest-impact fix in the project.

## Quickstart

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
| `anan.suwan@mfu.ac.th` | `teacher1234` | Teacher | CSB321, CSD323 |
| `malee.chaiyaporn@mfu.ac.th` | `teacher1234` | Teacher | CSD322, CSA411 |
| `somchai.prasert@mfu.ac.th` | `teacher1234` | Teacher | CSM324, GEN311, AI-EDU |
| `kanya.wong@mfu.ac.th` | `student1234` | Student | CSB321, CSD322, CSM324 |
| `pim.srisuk@mfu.ac.th` | `student1234` | Student | CSD323, GEN311 |
| `admin@mfu.ac.th` | `admin1234` | Admin | all |

Sign in from the login page with the demo buttons.

## Configuration

Set in `.env.local` (web) or the environment (api). The API reads these through
`pydantic-settings`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `auto` | `ollama`, `gemini`, `stub`, or `auto` (Gemini when a key exists) |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Chat model |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model (must stay 768-dim for the schema) |
| `DATABASE_URL` | — | `postgresql+asyncpg://…` |
| `ALLOW_INSECURE_DEV_AUTH` | `false` | Enables the demo cookie/header principal |
| `CHUNK_CHARS` / `CHUNK_OVERLAP` | `1200` / `200` | Chunking |
| `TOP_K` | `5` | Passages per answer |
| `CONTEXT_CHARS` | `6000` | Character budget sent to the model |
| `REFUSAL_THRESHOLD` | `0.55` | Minimum relevance before answering |
| `GEMINI_API_KEY` | — | Only for `AI_PROVIDER=gemini` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_JWT_SECRET` | — | Optional hosted auth |

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
  scripts/               seed_academic.py
  tests/                 78 tests
scripts/                 dev.sh, smoke checks, latency baseline
docs/                    assets, archive
```

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/chat` | SSE answer (`sources → start → delta → done`); requires course access |
| `GET` | `/v1/me` , `/v1/me/courses` | Caller identity and visible courses |
| `GET` | `/v1/courses/{id}` | Course detail, access checked |
| `GET` | `/v1/documents?course_id=` | Course documents |
| `POST` | `/v1/documents` | Teacher-only upload, 25 MB PDF |
| `DELETE` | `/v1/documents/{id}` | Remove a document and its chunks |
| `POST` | `/v1/search` | Hybrid search over one course |
| `GET` | `/v1/stats` | Platform counters |
| `GET` | `/health`, `/ready` | Liveness, readiness |

## Evaluation

A 25-question set (answerable, borderline, unanswerable) runs against three
retrieval settings and reports recall, refusal accuracy, citation validity,
citation support, and latency.

Latest run on a laptop with `qwen2.5:7b`:

| Metric | Result |
| --- | --- |
| Recall@5 | 100% |
| Refusal accuracy | 96–100% |
| Citation validity | 100% |
| Citation support | 81% after repair (76% raw) |
| Latency | p50 ≈ 2.4 s, p95 ≈ 6.2 s |

Citation support is not 100% and is not reported as such: the remaining cases are
claims spread across two passages that one citation cannot represent. Prompt
variants (quote-first, two-step) were tried and did **not** beat the baseline,
so the default stays `top_k=5` + citation repair.

## Testing

```bash
cd services/api && .venv/bin/python -m pytest -q     # 78 tests
cd services/api && .venv/bin/ruff check . && .venv/bin/mypy app
npm run type-check && npm run lint
```

The access-control tests are the important ones: they assert that a student not
enrolled in a course gets `403` for both documents and chat.

## Documentation

The app ships its own documentation at `/docs` (sources in `content/docs/`):

- Platform architecture
- How answers are grounded
- Local AI models
- Roles and access
- Document RAG workspace (teacher and student views)

![Documentation — how answers are grounded](docs/assets/grounded-answers.png)

## Known limitations

- **Conversation history is not persisted** in this build; the admin counters for
  conversations/audit/consents were removed rather than shown as zeros.
- **Citations are text, not links.** They carry filename, page, and section, but
  do not open the PDF at that page yet.
- **No per-request membership check** on `/v1/me/courses` beyond the database
  role; course-level checks happen on document and chat endpoints.
- **Scanned PDFs are rejected** (no OCR).
- **Single-node ingestion.** Good for a course, not for a faculty.
- Demo auth is intentionally insecure and must stay behind
  `ALLOW_INSECURE_DEV_AUTH`.

## Roadmap

- [ ] Persist conversations and answers with feedback
- [ ] Clickable citations that open the source page
- [ ] Per-course unique constraints on document titles
- [ ] OCR fallback for scanned material
- [ ] Instructor analytics on unanswered questions

## Credits

Coursework project for the AI for Delivery portfolio; the original prototype was
a TypeScript/Supabase app, and this repository replaces its backend with the
Python service described above.

## License

MIT — see [LICENSE](LICENSE).
