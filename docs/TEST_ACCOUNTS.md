# Test accounts

Every account below is a **real Supabase auth user**, created the same way the
sign-up page creates one: an `auth.users` row, a linked `auth.identities` row so
password sign-in resolves, and a `profiles` row written by the
`handle_new_user()` trigger. There is no demo-only code path — sign in at
`/login` with these credentials exactly as any other user would.

Shared password for all seeded accounts:

```
demo1234
```

## Teachers

| Name | Email | Password | Lands on |
| --- | --- | --- | --- |
| Dr. Anan Suwan | `anan.suwan@mfu.ac.th` | `demo1234` | `/teacherportal` |
| Dr. Malee Chaiyaporn | `malee.chaiyaporn@mfu.ac.th` | `demo1234` | `/teacherportal` |
| Ajarn Somchai Prasert | `somchai.prasert@mfu.ac.th` | `demo1234` | `/teacherportal` |

Courses they own (from the service seed):

| Teacher | Courses |
| --- | --- |
| Anan | CSB321, CSD323 |
| Malee | CSD322, CSA411 |
| Somchai | CSM324, GEN311, AI-EDU |

## Students

| Name | Email | Password | Lands on |
| --- | --- | --- | --- |
| Kanya Wong | `6631503078@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Niran Chai | `6631503085@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Pim Srisuk | `6631503092@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Thanakorn Roj | `6631503101@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Araya Kitt | `6631503118@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Krit Phan | `6631503125@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |

## Admin

| Name | Email | Password | Lands on |
| --- | --- | --- | --- |
| MFU Admin | `admin@mfu.ac.th` | `demo1234` | `/admin/dashboard` |

Sign in at `/admin/login`, or use `/login` — the redirect is by role either way.

## Why these addresses look the way they do

Role is derived from the email domain at signup, and enforced by
`public.role_for_email()` in `supabase/migrations/20261231000100_role_from_email.sql`:

- `@lamduan.mfu.ac.th` → **student**
- `@mfu.ac.th` → **teacher**
- `admin@mfu.ac.th` → **admin** (explicit allowlist, never self-selectable)

So a student account has to use a `@lamduan.mfu.ac.th` address. The earlier demo
students used invented `@mfu.ac.th` addresses (`kanya.wong@mfu.ac.th`) which,
now that sign-in is real, would have been created as *teachers* — and they did
not exist as auth users at all.

## Recreating or resetting these accounts

The accounts are created by `supabase/seed.sql`, which inserts the auth rows
directly with `crypt('demo1234', gen_salt('bf'))` and marks the email confirmed,
so no confirmation link is needed.

```bash
# Apply the seed to the local stack (idempotent; skips existing emails)
npx supabase db reset          # destructive: drops and re-seeds everything
```

To reset one password without wiping data:

```sql
update auth.users
   set encrypted_password = crypt('demo1234', gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now())
 where email = 'anan.suwan@mfu.ac.th';
```

To add a brand-new account the way a person would, open `/signup` and use a
`@lamduan.mfu.ac.th` (student) or `@mfu.ac.th` (teacher) address. With email
confirmation enabled locally, the link is delivered to the Inbucket UI at
<http://127.0.0.1:54324> rather than to a real mailbox.

## What was removed

The "Demo accounts" panel on `/login` and the cookie-based shortcut behind it
are gone. Previously those buttons authenticated against a hard-coded list in
`lib/demo-auth.ts` and set `mfu_demo_role` / `mfu_demo_email` cookies, which
bypassed Supabase entirely. That meant the demo identities had no `profiles`
row, so they could not own a reminder, a flashcard deck, or a study plan — and
several routes returned 401 for them. Sign-in now always goes through
`supabase.auth.signInWithPassword`, for every account.

The `/api/demo-auth/*` endpoints still exist and are still used by the logout
helper and the admin console's session probe. They are not a sign-in path.
