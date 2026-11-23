# Commit conventions

This repository uses [Conventional Commits](https://www.conventionalcommits.org/)
and a **batched, low-noise history**. The goal is a log that reads like a
changelog, not a list of file saves.

## Why

Agent-assisted development makes it easy to commit every small edit. That leaves
a history where a one-line revert is impossible to find and a reviewer cannot see
the shape of the work. We instead:

- group one logical change per commit,
- keep the subject imperative and scoped,
- and aim for **4–8 commits per active day**, not dozens.

## Format

```text
<type>(<scope>): <subject>

<body — what changed and why, wrapped at 72 chars>

<footer — refs, breaking changes, co-authors>
```

Rules:

- **Subject** is imperative, lowercase after the colon, no trailing period, **≤ 72 characters**.
- **Scope** is optional but strongly preferred; it names the area, not the file.
- **Body** explains *why*, not just *what*. Mention user-visible behaviour and any migration/security impact.
- **Breaking changes** use `BREAKING CHANGE:` in the footer.
- Reference issues in the footer, e.g. `Refs: #42`.

## Types

| Type | Use for |
| --- | --- |
| `feat` | A user-visible feature |
| `fix` | A bug fix |
| `refactor` | Behaviour-preserving code change |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `test` | Tests only |
| `build` | Build system or dependencies |
| `ci` | CI/CD configuration |
| `chore` | Maintenance that changes no app behaviour |
| `revert` | Reverting a previous commit |

## Scopes

Use one of these when it applies:

`auth` · `db` · `rls` · `ai` · `rag` · `chat` · `courses` · `portal` · `admin` ·
`ui` · `docs` · `ci` · `deps` · `demo` · `config` · `deploy` · `repo`

## Examples

```text
feat(rag): cite the exact page after retrieval
fix(auth): explain disabled Google SSO instead of failing silently
feat(courses): allow several teachers on one course
refactor(admin): collapse the sidebar on desktop
docs(deploy): document the hosted Supabase redirect allow-list
chore(deps): upgrade Next.js to 16.4.6
```

## Cadence: 4–8 commits per active day

A day usually contains several related changes. Batch them:

1. Make the change.
2. Test it.
3. **Squash exploration and fixups locally** until the commit is one coherent story:
   - `git commit --amend` for the previous local commit,
   - `git rebase -i HEAD~n` to squash/reorder before pushing,
   - `git add -p` to keep unrelated edits out.
4. Push once the branch is coherent.

If a day genuinely produced more than 8 separate *logical* changes, prefer a
feature branch with one commit per logical change and squash-merge the PR.

## What not to commit

- Generated files (build output, caches, logs)
- Secrets, API keys, or `.env` files
- Formatting-only churn mixed with a behavioural change
- WIP commits such as `wip`, `fixup`, `tmp`, or `asdf`

## Local enforcement

A lightweight `commit-msg` hook lives in [`.githooks/commit-msg`](../.githooks/commit-msg).
It is installed automatically by `npm install` through the `prepare` script, and can
be installed manually:

```bash
npm run hooks:install     # sets core.hooksPath=.githooks
```

The hook rejects unknown types/scopes, over-long subjects, trailing periods and
non-lowercase subjects before the commit is created. Do not bypass it with
`--no-verify`; fix the message instead.

CI re-checks the same rules for pull requests via `commitlint`,
and a PR title must also be a valid Conventional Commit because PRs are
squash-merged.

## Pull requests

`main` is merged by **squash**. A pull request therefore becomes exactly one
commit on `main`, and the **PR title must be a valid Conventional Commit** — the
commit-message CI job checks both the PR commits and the title.

Before opening a PR:

```bash
npm run type-check
npm run lint
npm run test:roadmap
```
