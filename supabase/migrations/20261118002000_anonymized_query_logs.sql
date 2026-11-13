-- Spec §2.3 / §6: "Only store anonymized logs unless explicit consent is given."
--
-- Precedence rule, applied in `lib/server/query-logging.ts`:
--   is_granted = false  -> store nothing
--   is_granted = true   -> store the query with the student id, so analytics
--                          can attribute it and the student can see their own
--   no row / unknown    -> store the query with NO student id. Analytics still
--                          count it, but it cannot be traced to a person.
--
-- Before this the only options were "log with the id" or "log nothing", which
-- forced a choice between the privacy requirement and having any analytics at
-- all for students who never answered the consent prompt.

-- ─────────────────────────────────────────────────────────────
-- 1. Allow an unattributed row
--
-- `student_id` was NOT NULL, so an anonymized log had nowhere to go. The RLS
-- read policy is unchanged: teachers read by course ownership, students see
-- their own rows, and a null student_id simply matches none of the
-- `student_id = auth.uid()` branches — only teachers and admins can see it.
-- ─────────────────────────────────────────────────────────────
alter table public.student_queries
  alter column student_id drop not null;

alter table public.student_queries
  add column if not exists is_anonymized boolean not null default false;

comment on column public.student_queries.is_anonymized is
  'true = stored without a student id because AI-processing consent was not granted. Counts toward analytics, attributable to no one.';

create index if not exists idx_student_queries_course_created
  on public.student_queries(course_id, created_at desc);

-- Retention cleanup deletes anonymized rows by age; without the id it cannot
-- match on student_id, so the cutoff needs its own index.
create index if not exists idx_student_queries_anonymized_created
  on public.student_queries(created_at)
  where is_anonymized = true;

-- ─────────────────────────────────────────────────────────────
-- 2. Insert policy must still forbid spoofing another student
--
-- `with check (student_id = auth.uid())` is NULL-unsafe in the way we want:
-- a null student_id fails the comparison, so an anonymized insert would be
-- rejected. The policy is rewritten to allow either the caller's own id or an
-- explicitly anonymized row, and nothing else.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "queries_student_insert" on public.student_queries;
create policy "queries_student_insert"
  on public.student_queries for insert
  with check (
    student_id = auth.uid()
    or (student_id is null and is_anonymized = true)
  );
