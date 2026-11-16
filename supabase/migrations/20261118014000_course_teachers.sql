-- Multiple teachers per course.
--
-- A course had exactly one `courses.teacher_id`. Real courses are taught by a
-- team, and an administrator had no way to give a second teacher access without
-- taking the course away from the first.
--
-- Rather than replace `teacher_id`, this adds `course_teachers` and redefines
-- `owns_course()` to accept either the legacy owner column or a row in the new
-- table. `owns_course()` backs 18 RLS policies across materials, assignments,
-- quizzes, submissions, announcements, FAQs, schedules, and documents, so
-- teaching that one function means every policy learns about co-teachers at
-- once — and the existing single-teacher rows keep working untouched.

create table if not exists public.course_teachers (
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  -- Distinguishes the original owner from an invited co-teacher, which matters
  -- for anything that should stay with a single person (transfer, deletion).
  is_primary boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (course_id, teacher_id)
);

create index if not exists idx_course_teachers_teacher
  on public.course_teachers(teacher_id);

alter table public.course_teachers enable row level security;

-- A teacher sees their own memberships. Administrators see all.
--
-- This must not query `course_teachers` inside its own USING clause: a policy
-- that selects from the table it guards makes Postgres re-evaluate the policy
-- for every row, and it fails with "infinite recursion detected in policy".
-- The self-row check below is the whole rule; a teacher reads their own rows and
-- nothing else, which is all any caller here needs.
drop policy if exists "course_teachers_read" on public.course_teachers;
create policy "course_teachers_read"
  on public.course_teachers for select
  using (
    public.is_admin()
    or teacher_id = auth.uid()
  );

-- Membership is administrative: only an admin may change who teaches a course,
-- so a co-teacher cannot silently add or remove colleagues.
drop policy if exists "course_teachers_admin_write" on public.course_teachers;
create policy "course_teachers_admin_write"
  on public.course_teachers for all
  using (public.is_admin())
  with check (public.is_admin());

-- Backfill. Every existing owner becomes a primary member, so a course that had
-- one teacher keeps behaving exactly as before.
insert into public.course_teachers (course_id, teacher_id, is_primary)
select id, teacher_id, true
from public.courses
where teacher_id is not null
on conflict (course_id, teacher_id) do nothing;

-- The single source of truth for "may this teacher edit this course". Every RLS
-- policy already calls this, so updating it here is what makes multiple teachers
-- work everywhere without touching 18 policies individually.
create or replace function public.owns_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses
    where id = target_course_id
      and teacher_id = auth.uid()
  )
  or exists (
    select 1 from public.course_teachers
    where course_id = target_course_id
      and teacher_id = auth.uid()
  );
$$;

-- The `courses` policies also keyed on `teacher_id`. Without this a co-teacher
-- could not even read the course row, so every downstream policy and every
-- `assertCourseAccess` check failed before it ran.
drop policy if exists "courses_read_own_or_enrolled" on public.courses;
create policy "courses_read_own_or_enrolled"
  on public.courses for select
  using (
    teacher_id = auth.uid()
    or public.is_admin()
    or public.is_enrolled(id)
    or public.owns_course(id)
  );

drop policy if exists "courses_teacher_write" on public.courses;
create policy "courses_teacher_write"
  on public.courses for all
  using (public.is_admin() or public.owns_course(id))
  with check (public.is_admin() or public.owns_course(id));
