# Deploying to the VPS

Target: Ubuntu 24.04, 2 vCPU / 2 GB, DigitalOcean `178.128.121.247`.

The server is already prepared — Docker, `deploy` user, ufw, 2 GB swap, and
`/var/www/ata/{app,data,logs,backups,secrets}` all exist. This document covers
getting the application onto it.

## What runs where

```
VPS (this server)                 Supabase Cloud
├── caddy   :443  ← public        ├── Postgres + pgvector  (all tables)
├── web     :3000 ← loopback      ├── Auth                 (login, Google SSO)
│                                 └── Storage              (avatars, PDFs)
└── outbound: Gemini API (AI)
```

**There is no database on the VPS.** The app never opens a direct Postgres
connection — every query goes through the Supabase client, and the migrations
reference `auth.users` / `storage.objects`, which only exist inside Supabase.
A local container cannot serve the app. See the comment block at the top of
`docker-compose.prod.yml`.

## Prerequisites

| Item | Where to get it |
|---|---|
| Supabase project (paid) | supabase.com — free tier pauses when idle |
| Gemini API key | aistudio.google.com/apikey |
| A domain | e.g. `ata.mfu.ac.th` |
| DNS A record | `ata.mfu.ac.th` → `178.128.121.247` |

Caddy cannot issue a certificate until DNS resolves. Verify with:

```bash
dig +short ata.mfu.ac.th    # must print 178.128.121.247
```

## 1. Apply the schema to Supabase

The VPS never runs migrations — they belong to the Supabase project.

```bash
# on your laptop, in this repo
supabase link --project-ref <your-project-ref>
supabase db push                 # applies all 27 migrations
psql "<your-db-connection-string>" -f supabase/seed.sql   # demo data
```

Verify before moving on:

```sql
select count(*) from public.courses;    -- expect 7+
select count(*) from public.profiles;   -- expect 10
```

## 2. Put the code on the server

```bash
ssh deploy@178.128.121.247
cd /var/www/ata/app
git clone https://github.com/zawwinhtutdev/mfu-ai-teaching-assistant.git .
git checkout main
```

## 3. Configure the environment

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Fill in, at minimum:

```bash
ENVIRONMENT=production
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
GOOGLE_GENERATIVE_AI_API_KEY=<gemini key>
SITE_ADDRESS=ata.mfu.ac.th
ADMIN_EMAILS=you@mfu.ac.th
CRON_SECRET=$(openssl rand -hex 32)
```

Leave `ALLOW_INSECURE_DEV_AUTH` **unset**. `deploy.sh` refuses to run if it is
`true`, because it grants a passwordless admin session.

`ENVIRONMENT=production` is required, not cosmetic: `/api/health` only applies
its strict checks (rejecting a loopback Supabase URL and insecure dev auth) when
it is set, and `deploy.sh` refuses to deploy without it.

Before the first deploy, verify the credentials actually work:

```bash
./scripts/preflight.sh
```

It contacts Supabase and Google and reports one line per check. Unlike a
presence check, it catches the mistakes that look fine until the app is live:

- an anon key pasted into the service-role slot (reported when the two are
  identical, since server-side writes would then be blocked by RLS)
- a service key that cannot read `public.profiles`, which usually means the
  schema was never applied
- a Gemini key from a project where the Generative Language API is not enabled
- a `GEMINI_MODEL` the key cannot use

A missing Gemini key is a warning, not a failure, because the app can run on a
local model. Pass `--require-ai` to make it fatal. `deploy.sh` runs preflight
automatically; set `SKIP_PREFLIGHT=1` only if the services are unreachable from
the build host.

### Google sign-in on the hosted project

Google credentials are configured per Supabase project, not in this repo's
env. Exporting `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` on a laptop only tells local
Supabase about them; the hosted project has its own copy, so a deploy can be
healthy while `/login` shows a disabled "Google SSO" button.

1. **Google Cloud Console → APIs & Services → Credentials** → the "Web
   application" OAuth client → *Authorized redirect URIs* → add
   `https://<project-ref>.supabase.co/auth/v1/callback` (keep the local
   `http://127.0.0.1:54321/auth/v1/callback` entry).
2. **Supabase Dashboard → Authentication → Providers → Google** → enable the
   provider and paste the same client ID and client secret.
3. **Authentication → URL Configuration**:
   - Site URL: `https://ata.mfu.ac.th`
   - Redirect URLs: add `https://ata.mfu.ac.th/auth/callback`; while
     testing over plain HTTP also add `http://178.128.121.247/auth/callback`.
4. If the OAuth consent screen is still in **Testing** mode, add every Google
   account that must sign in under *Test users* (or publish the app at
   **Publishing status**), otherwise Google answers "Access blocked".

Verify without a browser:

```bash
curl -s https://ata.mfu.ac.th/api/auth/google/status
{"enabled":true,"reason":"ok"}
```

- `reason:provider_not_configured` — step 1 or 2 is incomplete.
- `reason:policy_disabled` — an administrator switched off `allow_google_sso`
  in the Admin Console.

The login page disables the button and shows a short note instead of letting
the click fail; reload it after the status endpoint reports `enabled:true`.

## 4. Deploy

```bash
cd /var/www/ata/app
./scripts/deploy.sh
```

The script builds, starts, then polls `/api/health` for up to 40 seconds. On
failure it prints the last 40 log lines and exits non-zero.

Expected output:

```
==> building
==> starting
==> waiting for health
    healthy after 12s

deployed: a1b2c3d
NAME        STATUS
ata-web     Up (healthy)
ata-caddy   Up
```

## 5. Verify

```bash
curl -s https://ata.mfu.ac.th/api/health | jq
```

```json
{
  "status": "ok",
  "service": "ata-web",
  "environment": "production",
  "checks": {
    "supabaseUrl":    { "ok": true },
    "serviceRoleKey": { "ok": true },
    "secureAuth":     { "ok": true },
    "database":       { "ok": true }
  }
}
```

A `503` means at least one check failed — the response names which. The most
common causes:

| Failed check | Meaning |
|---|---|
| `supabaseUrl` | not set, or still points at `localhost` |
| `database` | project paused, wrong URL, or bad anon key |
| `secureAuth` | `ALLOW_INSECURE_DEV_AUTH=true` is set — fix immediately |

Then confirm login works end to end in a browser:

1. Open `https://ata.mfu.ac.th/login`
2. Sign in with a seeded account (`docs/TEST_ACCOUNTS.md`, password `demo1234`)
3. Ask one question in chat — this proves the Gemini key works
4. Upload a PDF from the teacher course page — this proves storage + embedding

## 6. Backups

```bash
# once, to verify it runs
./scripts/backup.sh

# then nightly at 03:15
crontab -e
15 3 * * * /var/www/ata/app/scripts/backup.sh >> /var/www/ata/logs/backup.log 2>&1
```

Snapshots land in `/var/www/ata/backups` (mode 700), kept 14 days. This is an
*independent* export: Supabase Pro already does daily backups with
point-in-time recovery, but a Supabase-side deletion would take those with it.

**Copy them off the server.** A backup on the same disk is not a backup:

```bash
# run from your laptop, weekly
rsync -avz deploy@178.128.121.247:/var/www/ata/backups/ ./ata-backups/
```

## Updating a running deployment

```bash
cd /var/www/ata/app
./scripts/deploy.sh --pull
```

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time —
changing them needs a rebuild, which `deploy.sh` always does. A plain restart
will not pick them up.

## Rollback

```bash
cd /var/www/ata/app
git log --oneline -5
git checkout <previous-commit>
./scripts/deploy.sh
```

Images are built locally, so the previous commit rebuilds to its prior state.
Migrations are not rolled back — if a deploy included a schema change, revert
it with a new migration rather than `supabase db reset` against production.

## Rate limiting

The AI routes (`/api/chat`, `/api/summarize`, `/api/generate-quiz`,
`/api/generate-flashcards`, and AI plan generation in `/api/study-planner`) are
limited per signed-in account, so one heavy user cannot exhaust the Gemini quota
or starve a shared local model:

| Route | Limit |
|---|---|
| `/api/chat` | 30 requests / minute |
| Summarize, quiz, flashcards | 12 requests / minute (each) |
| Study planner (AI generation) | 20 requests / minute |

Limits are keyed on the authenticated user id rather than IP, because students
behind the campus NAT share one address — an IP-keyed limit would let one person
lock out a whole classroom. A refused request returns `429` with `Retry-After`
and `X-RateLimit-*` headers.

The counters live in the web process's memory. Two consequences:

- **They reset on every deploy and restart.** That is acceptable for abuse
  control (the window is one minute) but it is not an accounting system.
- **They are per container.** Do not raise the `web` service above one replica
  without moving the counter to Redis; two replicas would each grant the full
  quota.

To tune the numbers, edit `RATE_LIMITS` in `lib/server/rate-limit.ts` and
rebuild.

## Gemini model availability (free tier)

A free-tier Gemini key answers `503 UNAVAILABLE` or `429 RESOURCE_EXHAUSTED` for
whole models, not just under load. Measured with the project key:

| Model | Result |
|---|---|
| `gemini-2.5-flash` | works |
| `gemini-3.1-flash-lite` | works |
| `gemini-3.8-flash` | 503 on every attempt |
| `gemini-3.5-flash` | 503 |
| `gemini-3.1-pro-preview` | 429 (quota) |

Chat therefore walks `geminiModelCandidates()` — the requested model first, then
`GEMINI_MODEL`, then the two that work — and retries on a 503/429, since those
mean "try something else", not "the request is bad". A 404 or 401 is not retried.

If AI answers stall or every model returns 503, the free tier is the limit and
the fix is enabling billing, not code. Set `GEMINI_MODEL` to pin a specific
model.

Embeddings use `gemini-embedding-001` (`text-embedding-004` is retired and
returns 404). **Changing the embedding model requires re-indexing**, because
vectors from different models are not comparable:

```bash
node scripts/reindex-materials.mjs
```

That script follows `AI_PROVIDER`, so it writes the same kind of vectors the app
queries.

## Troubleshooting

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f caddy
```

**Certificate not issued.** DNS has not propagated, or 80/443 are blocked:

```bash
dig +short ata.mfu.ac.th
sudo ufw status
docker logs ata-caddy 2>&1 | grep -i acme
```

**Container exits immediately.** Almost always a missing env var. The compose
file uses `:?` on required values, so `docker compose config` names the
culprit:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config
```

**Out of memory.** 2 GB is enough for web + Caddy (~1.1 GB measured), but a
build is heavier than the running app. If `npm run build` is OOM-killed during
`docker compose build`, the 2 GB swap file should absorb it. Confirm it is on:

```bash
swapon --show
free -h
```

**Chat times out after 120s.** `/api/chat` sets `maxDuration = 120`. With a
cloud API that is ample; a local model on CPU would not be, which is why this
deployment uses `AI_PROVIDER=gemini`.
