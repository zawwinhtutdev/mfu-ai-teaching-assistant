# Contributing

Thanks for taking the time to improve **MFU AI Teaching Assistant**! This guide
covers the development workflow, testing expectations, commit style and the
conventions used in this repository.

## Getting started

1. Read [README.md](README.md#-quick-start) for local setup.
2. Use Node.js 22+ and the Supabase CLI (Docker required for the local stack).
3. Copy `.env.example` to `.env.local` and fill in the local Supabase URL/keys.
4. Run the app with `npm run dev` and sign in with a demo account.
5. `npm install` installs the commit-message hook automatically. If it was skipped,
   run `npm run hooks:install`.

## Workflow

1. **Fork** the repository and create a branch from `main`:
   `git checkout -b feat/short-description`
2. Make a focused change — one concern per pull request.
3. Run the checks before pushing:

   ```bash
   npm run type-check
   npm run lint
   npm run test:roadmap
   ```

4. Open a pull request and describe the problem, the change and how you verified it.
   Link the issue it closes. PRs are **squash-merged**, so the PR title becomes the
   commit on `main` and must follow the commit convention.

## Commit style

This project uses [Conventional Commits](https://www.conventionalcommits.org/)
and a batched history. See **[docs/COMMIT_CONVENTIONS.md](docs/COMMIT_CONVENTIONS.md)**
for the full guide, scopes and examples.

Quick version:

```text
feat(courses): allow several teachers on one course
fix(auth): explain disabled Google SSO instead of failing silently
docs(deploy): document the hosted Supabase redirect allow-list
chore(deps): upgrade Next.js to 16.4.6
```

- Imperative subject, ≤ 72 characters, scope where it applies.
- One logical change per commit; **aim for 4–8 commits per active day**.
- Squash WIP/fixup commits locally before pushing.
- Do not commit secrets, generated files or formatting-only churn.

The commit-message CI job checks pull-request commits and titles.

## Database and RLS changes

Access control is enforced by Postgres Row Level Security, so database changes
need extra care:

- Add a **new** timestamped migration in [`supabase/migrations`](supabase/migrations). Never edit a migration that has already been applied.
- Write policies in terms of the existing helpers (e.g. `owns_course()`, `is_enrolled()`, `is_admin()`) rather than duplicating access logic.
- Test with `supabase db reset` and verify the behaviour in each role (student, teacher, admin).
- Document any policy change in the pull request — RLS bugs are security bugs.

## Code conventions

- TypeScript strict mode; prefer explicit types over `any` in new code.
- Server components by default; only add `'use client'` where interactivity requires it.
- Authorization is always checked on the server. The UI is not a security boundary.
- Keep user-facing copy clear and free of internal jargon.
- Update the README or `docs/` when behaviour, configuration or deployment changes.

## Reporting bugs and requesting features

Use the issue templates:

- [Bug report](https://github.com/zawwinhtutdev/mfu-ai-teaching-assistant/issues/new?template=bug_report.yml)
- [Feature request](https://github.com/zawwinhtutdev/mfu-ai-teaching-assistant/issues/new?template=feature_request.yml)

For security vulnerabilities, **do not open a public issue** — see
[SECURITY.md](SECURITY.md).

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
