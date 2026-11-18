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
| Kanya Wong | `6531503078@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Niran Chai | `6531503085@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Pim Srisuk | `6531503092@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Thanakorn Roj | `6531503101@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Araya Kitt | `6531503118@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |
| Krit Phan | `6531503125@lamduan.mfu.ac.th` | `demo1234` | `/studentportal/mycourses` |


## Design Concept class (1001143)

A second seeded class, mirrored from the Google Classroom course
`[2/2568] 1001143 Design Concept`. It exists so the teacher, student and admin
portals all have a realistic class to exercise.

- **Course:** `1001143` Design Concept — semester `2/2568`, academic year `2568`,
  3 credits, School of Information Technology
- **Section:** 2 (Lecture) — Wed 13:00–16:00, room E4-201, capacity 40
- **Teachers:** Dr. Anan Suwan (primary), Dr. Malee Chaiyaporn (co-teacher)
- **Enrolled:** these 30 students plus the six demo students above (36 total)

Shared password: `demo1234`

| Name | Email |
| --- | --- |
| Somsak Chaiyaporn | `6531503126@lamduan.mfu.ac.th` |
| Nattapong Srisuk | `6531503127@lamduan.mfu.ac.th` |
| Pimchanok Rattanaphan | `6531503128@lamduan.mfu.ac.th` |
| Chanakan Thongkam | `6531503129@lamduan.mfu.ac.th` |
| Natthawut Sricharoen | `6531503130@lamduan.mfu.ac.th` |
| Kodchakorn Jaidee | `6531503131@lamduan.mfu.ac.th` |
| Thanida Wongkham | `6531503132@lamduan.mfu.ac.th` |
| Peerapat Inthasorn | `6531503133@lamduan.mfu.ac.th` |
| Suphitcha Maneerat | `6531503134@lamduan.mfu.ac.th` |
| Anucha Boonmee | `6531503135@lamduan.mfu.ac.th` |
| Chalisa Phromma | `6531503136@lamduan.mfu.ac.th` |
| Thanawat Khamkaew | `6531503137@lamduan.mfu.ac.th` |
| Waranya Sae-Lim | `6531503138@lamduan.mfu.ac.th` |
| Kritsada Panyawai | `6531503139@lamduan.mfu.ac.th` |
| Nalinee Chuenjai | `6531503140@lamduan.mfu.ac.th` |
| Siriporn Thongdee | `6531503141@lamduan.mfu.ac.th` |
| Adisak Ruenrom | `6531503142@lamduan.mfu.ac.th` |
| Benjaporn Kaewmanee | `6531503143@lamduan.mfu.ac.th` |
| Chaiwat Sathit | `6531503144@lamduan.mfu.ac.th` |
| Duangjai Phuttharak | `6531503145@lamduan.mfu.ac.th` |
| Ekkachai Boonsong | `6531503146@lamduan.mfu.ac.th` |
| Fah Chaiyasit | `6531503147@lamduan.mfu.ac.th` |
| Gunn Chaiyapruek | `6531503148@lamduan.mfu.ac.th` |
| Hataichanok Prasertsri | `6531503149@lamduan.mfu.ac.th` |
| Itthipon Srisuwan | `6531503150@lamduan.mfu.ac.th` |
| Jarupan Meechai | `6531503151@lamduan.mfu.ac.th` |
| Kanokporn Saelim | `6531503152@lamduan.mfu.ac.th` |
| Lertpong Wattana | `6531503153@lamduan.mfu.ac.th` |
| Manatsanan Sriwong | `6531503154@lamduan.mfu.ac.th` |
| Naphat Chaiyasit | `6531503155@lamduan.mfu.ac.th` |

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