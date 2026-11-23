<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commit discipline (required for agents)

Follow [docs/COMMIT_CONVENTIONS.md](docs/COMMIT_CONVENTIONS.md).

- **Use Conventional Commits:** `<type>(<scope>): <subject>` — imperative, ≤ 72 characters, body explaining *why*.
- **One logical change per commit.** Do not commit every file edit or every small fix separately.
- **Batch the day's work into 4–8 commits.** Squash WIP and fixup commits locally with `git commit --amend` or `git rebase -i` before pushing.
- **Allowed scopes:** `auth`, `db`, `rls`, `ai`, `rag`, `chat`, `courses`, `portal`, `admin`, `ui`, `docs`, `ci`, `deps`, `demo`, `config`, `deploy`, `repo`.
- **Never commit:** secrets, `.env` files, build output, caches, or unrelated formatting churn.
- **Check before pushing:** `npm run type-check`, `npm run lint`, `npm run test:roadmap`.
- Pull requests are squash-merged; the PR title is the commit message, so it must be a valid Conventional Commit.
