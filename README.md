# 🎓 AI Teaching Assistant

An intelligent teaching assistant platform built with Next.js, Supabase, and Gemini, designed to enhance learning experiences for students and streamline course management for teachers.

![Next.js](https://img.shields.io/badge/Next.js-15.5.6-black)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Latest-green)
![Gemini](https://img.shields.io/badge/Gemini-2.5--flash-orange)

---

## ✨ Features

### 👨‍🎓 For Students
- 🤖 **AI-Powered Chat Assistant** - Get instant answers to your questions
- 📚 **Course Materials** - Access study materials and resources
- 📝 **Interactive Quizzes** - Test your knowledge
- 🎴 **Flashcards** - AI-generated flashcards for better retention
- ⏰ **Study Reminders** - Never miss important deadlines
- 🌓 **Dark Mode** - Comfortable studying day or night

### 👨‍🏫 For Teachers
- 📊 **Course Management** - Create and manage courses easily
- 📤 **Material Upload** - Share resources with students
- 📈 **Analytics Dashboard** - Track student engagement
- ⚙️ **AI Configuration** - Customize chatbot behavior
- 👥 **Student Insights** - Monitor learning progress

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **npm** or **pnpm**
- **Supabase Account** ([Sign up free](https://supabase.com))
- **Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ai-teaching-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Gemini Configuration
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

   # DigitalOcean Spaces (Documents feature)
   DO_SPACES_REGION=your_spaces_region
   DO_SPACES_BUCKET=your_documents_bucket_name
   DO_SPACES_KEY=your_spaces_access_key
   DO_SPACES_SECRET=your_spaces_secret_key
   DO_SPACES_PUBLIC=false
   # Optional CDN base URL (without trailing slash)
   # DO_SPACES_CDN_URL=https://your-cdn-domain
   ```

4. **Set up Supabase Database**

   Preferred (migration-first):
   ```bash
   npm run db:bootstrap
   ```

   Use linked cloud project instead of local:
   ```bash
   npm run db:bootstrap -- linked
   ```

   Legacy/manual SQL setup (only if you are not using Supabase CLI):

   Go to your Supabase project → SQL Editor, and run these scripts in order:

   **a) Create profiles table:**
   ```sql
   CREATE TABLE IF NOT EXISTS profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     email TEXT UNIQUE NOT NULL,
     full_name TEXT,
     role TEXT NOT NULL CHECK (role IN ('student', 'teacher')) DEFAULT 'student',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
   CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
   CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
   ```

   **b) Create auto-profile trigger:**
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO public.profiles (id, email, full_name, role)
     VALUES (
       NEW.id,
       NEW.email,
       COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
       COALESCE(NEW.raw_user_meta_data->>'role', 'student')
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

   **c) Create conversations and messages tables:**
   ```sql
   CREATE TABLE IF NOT EXISTS conversations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS messages (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
     content TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
   CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
   CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
   CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

   ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view their own conversations"
     ON conversations FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can create their own conversations"
     ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update their own conversations"
     ON conversations FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete their own conversations"
     ON conversations FOR DELETE USING (auth.uid() = user_id);

   CREATE POLICY "Users can view messages in their conversations"
     ON messages FOR SELECT
     USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
   CREATE POLICY "Users can create messages in their conversations"
     ON messages FOR INSERT
     WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
   ```

   **d) Create user documents metadata table (for DigitalOcean Spaces):**
   ```sql
   -- Run scripts/005_create_user_documents.sql
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) (or the port shown in terminal)

---

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Project Structure

```
ai-teaching-assistant/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (chat, quiz, etc.)
│   ├── auth/              # Authentication pages
│   ├── chat/              # Chat interface
│   └── dashboard/         # Student/Teacher dashboards
├── components/            # React components
│   ├── chat/             # Chat UI components
│   ├── student/          # Student features
│   ├── teacher/          # Teacher features
│   └── ui/               # Reusable UI components
├── lib/                  # Utilities & configurations
│   ├── supabase/         # Supabase client setup
│   └── types.ts          # TypeScript types
├── scripts/              # Database migration scripts
└── public/               # Static assets
```

---

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ Yes |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key for AI features | ✅ Yes |
| `DO_SPACES_REGION` | DigitalOcean Spaces region (e.g. `sgp1`) | ✅ Yes (Documents) |
| `DO_SPACES_BUCKET` | Spaces bucket name for user documents | ✅ Yes (Documents) |
| `DO_SPACES_KEY` | Spaces access key | ✅ Yes (Documents) |
| `DO_SPACES_SECRET` | Spaces secret key | ✅ Yes (Documents) |
| `DO_SPACES_PUBLIC` | `true` for public bucket, `false` for signed URLs | ✅ Yes (Documents) |
| `DO_SPACES_CDN_URL` | Optional CDN base URL for public links | ❌ Optional |

---

## 📚 Tech Stack

- **Framework:** Next.js 15.5.6 with App Router
- **Frontend:** React 19.2.0, TypeScript
- **Styling:** Tailwind CSS 4.1.9, Radix UI
- **Backend:** Supabase (PostgreSQL + Auth)
- **AI:** Vercel AI SDK + Gemini 2.5 Flash
- **State Management:** React Hook Form + Zod
- **UI Components:** Shadcn/ui

For detailed tech stack information, see [TECH_STACK.md](./TECH_STACK.md)

---

## 🚢 Deployment

Self-hosted: the app ships as a container image. No Vercel dependency.

### Docker (recommended)

```bash
# build + run (pass --env-file so NEXT_PUBLIC_* are baked in correctly)
docker compose --env-file .env.local up --build

# or build the image directly
docker build -t ai-teaching-assistant .
docker run -p 3000:3000 --env-file .env.local ai-teaching-assistant
```

The image uses Next.js `output: "standalone"`, runs as a non-root user, and
includes a container `HEALTHCHECK` against `/`.

To bring up the future data layer (Postgres + pgvector, Redis):

```bash
docker compose --env-file .env.local --profile platform up --build
```

### Any container host

Build once, run anywhere: Fly.io, Railway, a Hetzner VPS with Coolify, or
Kubernetes. The only requirement is a host that can run a container and reach
your Supabase project (auth) and AI provider.

### Environment Variables in Production

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `CRON_SECRET` — bearer token for the scheduled jobs (see below)

**Never** commit these. In containers pass them with `--env-file` or your
host's secret store.

### Scheduled jobs

The two former Vercel crons now run from GitHub Actions
(`.github/workflows/scheduled-jobs.yml`). Add two repository secrets:

| Secret | Value |
|---|---|
| `APP_BASE_URL` | public URL of the deployed app, no trailing slash |
| `CRON_SECRET` | must equal the app's `CRON_SECRET` |

The workflow calls `POST /api/notifications/process` daily and
`GET /api/keep-alive` weekly, both authenticated with `Authorization: Bearer`.

### CI

`.github/workflows/ci.yml` runs three jobs:

| Job | Checks |
|---|---|
| `checks` | `tsc --noEmit`, `eslint`, `next build` |
| `api` | `ruff`, `mypy`, `pytest` for the FastAPI service |
| `docker` | builds the image and smoke-tests the container against `/` |

---

## ⚙️ Services

The platform is split into two deployable services.

### `web` — Next.js 16

UI, session handling, and the existing route handlers. Runs on port `3000`.

### `api` — FastAPI (Python 3.12)

Owns AI orchestration and (from phase 3) the database. Runs on port `8000`.

```bash
cd services/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload      # http://localhost:8000/docs
```

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /ready` | readiness + config checks |
| `GET /v1/me` | verified caller (requires a Supabase access token) |
| `POST /v1/chat` | streaming chat over SSE |
| `POST /v1/documents` | upload a PDF (async ingestion) |
| `GET /v1/documents` | list documents + ingestion status |
| `POST /v1/search` | hybrid retrieval with citations |
| `GET /docs` | OpenAPI UI |

**Authentication.** The web app keeps Supabase Auth; this service never issues
tokens. It verifies the same access token:

- `SUPABASE_JWT_SECRET` set → legacy HS256 shared secret
- otherwise → asymmetric keys from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`

Both use audience `authenticated`. Add `require_role("teacher", "admin")` to a
route to restrict it.

### Chat flow

```
browser → POST /api/chat/stream (Next)  → resolves session, forwards Bearer
        → POST /v1/chat (FastAPI)       → provider.stream()
        → text/event-stream back        → UI consumes deltas
```

Events:

```
data: {"type":"sources","sources":[{"n":1,"citation":"standards.pdf, pp. 8–9, § 6.1 HTTP Errors"}],"grounded":true}

data: {"type":"start","provider":"gemini","model":"gemini-2.5-flash"}

data: {"type":"delta","text":"Invalid input returns 400 [1]…"}

data: {"type":"done","sources_used":[1],"invalid_citations":[]}

data: [DONE]
```

`sources` is emitted **before** the first token so the UI can render citation
chips immediately. `done.sources_used` lists the markers the answer actually
cited; `invalid_citations` lists any marker pointing at a source that was not
supplied.

**Grounded answering.** When retrieval is enabled:

1. the question is embedded and searched (hybrid by default)
2. if nothing is retrieved, or the best cosine similarity is below
   `REFUSAL_THRESHOLD`, the service answers *"The course materials do not cover
   this."* **without calling the model**
3. retrieved chunks are deduplicated, budgeted to `CONTEXT_CHARS`, numbered
   `[1]…[n]`, and injected as the system prompt
4. the answer is streamed, then its `[n]` markers are validated

The similarity gate is skipped when the offline hashing embedder is in use —
that embedder has no semantics, so gating on it would refuse valid questions.
Set `REFUSAL_THRESHOLD=0` to disable the gate entirely.

**Provider selection** is automatic: `GEMINI_API_KEY` (or
`GOOGLE_GENERATIVE_AI_API_KEY`) present → Gemini; absent → a deterministic
**stub** provider that streams a clearly-labelled placeholder. That keeps the
whole path testable offline; swapping in LiteLLM later means one new file
implementing `stream()`.

### Local demo without a Supabase project

Set `ALLOW_INSECURE_DEV_AUTH=true` and the proxy falls back to
`X-Dev-Principal` (from `DEV_PRINCIPAL`) instead of a real token. The API honours
that header **only** when `ENVIRONMENT` is not `production` — it refuses to
start if both are set.

### Documents & retrieval

PDFs are extracted, chunked, embedded and stored in Postgres + pgvector, then
retrieved with **hybrid search** (vector + BM25-style lexical, fused by
reciprocal rank).

```bash
# apply schema (documents, document_chunks, HNSW + GIN indexes)
cd services/api && alembic upgrade head

# upload
curl -X POST localhost:8000/v1/documents \
  -H "X-Dev-Principal: demo.teacher@mfu.ac.th" \
  -F "file=@reports/coding-standards.pdf"

# poll until status=ready, then search
curl -X POST localhost:8000/v1/search \
  -H "Content-Type: application/json" -H "X-Dev-Principal: demo.teacher@mfu.ac.th" \
  -d '{"query":"what are the rules for HTTP errors?","limit":3}'
```

Each hit carries a citation: filename, page range and nearest heading
(`§ 6.1 HTTP Errors`).

| Piece | Implementation |
|---|---|
| Extraction | `pypdf`, per page; scanned PDFs rejected with a clear error |
| Chunking | ~1200 chars, 200 overlap, paragraph→sentence boundaries, page + heading tracked |
| Embeddings | Gemini `text-embedding-004` (768d); hashing embedder when no key |
| Storage | `documents` + `document_chunks`, `vector(768)`, generated `tsv` column |
| Retrieval | HNSW cosine + `tsquery` lexical, RRF fusion (`k=60`) |

**Why hybrid:** vector-only search misses exact identifiers — course codes, HTTP
statuses, error strings. The lexical branch catches them; RRF merges the two
rankings without needing score calibration.

### Evaluation

`evals/dataset.yaml` holds 25 cases written against the bundled coding-standards
PDF: 12 single-section, 5 multi-section, 4 exact-token and 4 **not in the
document** (the refusal cases most projects skip).

```bash
cd services/api
python evals/run.py --dev-principal eval@mfu.ac.th
```

Latest run — **offline stub model + hashing embedder**, 25 cases × 3 configs:

| config | recall@5 | refusal acc. | citation rate | grounded | bad citations | p50 | p95 |
|---|---|---|---|---|---|---|---|
| no-retrieval | n/a | 84% | 100% | 0% | 0 | 2 ms | 34 ms |
| vector | 90% | 84% | 100% | 100% | 0 | 4 ms | 24 ms |
| **hybrid** | **90%** | 84% | 100% | 100% | 0 | **3 ms** | **4 ms** |

**How to read this honestly**

- Retrieval works: 90% recall@5, all citations valid, no broken markers.
- **Vector and hybrid tie here — because the stub embedder is itself lexical.**
  A hashing embedder has no semantics, so the vector branch is doing keyword
  matching and adds nothing beyond the lexical branch. The hybrid advantage
  appears only with a real embedding model.
- **Refusal accuracy is 84%, not 100%**: the 4 unanswerable questions are not
  refused, because the gate is deliberately disabled for the stub embedder and
  the stub never refuses. With a semantic embedder plus `REFUSAL_THRESHOLD`,
  this is the metric to watch.
- Latency is retrieval-only; with a real model, generation dominates
  (~1.5–3 s for Gemini, ~7–11 s for a local 7B).

So this run validates the *plumbing*, not the *model*. Add a Gemini key or an
Ollama model and the same command produces the numbers that matter.

**Checks.**

```bash
cd services/api
ruff check . && mypy app && pytest -q   # 50 tests; DB integration tests skip if Postgres is down
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🆘 Support

If you encounter any issues:

1. Check the [TECH_STACK.md](./TECH_STACK.md) documentation
2. Review the Supabase setup steps
3. Ensure all environment variables are set correctly
4. Check that your Gemini API key is valid

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Backend by [Supabase](https://supabase.com)
- AI powered by [Google Gemini](https://ai.google.dev/)
- UI components from [Shadcn/ui](https://ui.shadcn.com)
- Icons by [Lucide](https://lucide.dev)

---

**Made with ❤️ for Mae Fah Luang University (MFU)**
