-- Assignment submissions.
--
-- `assignments` was built as a notice board: a teacher could post a deadline and
-- every enrolled student saw it, but there was nowhere for the student to hand
-- work in. A student could read "final document, due 20 November" and had no
-- way to actually submit it, so the feature stopped halfway.
--
-- One row per (assignment, student). Resubmitting updates the row rather than
-- adding history, because a student expects "submit" to replace their previous
-- attempt, and a teacher wants one answer per person.

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  -- Free-text answer, a file, or both. At least one is required by the route.
  content text,
  file_url text,
  file_name text,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Grading. Null means ungraded, which is what the teacher list keys on.
  grade numeric(5,2),
  feedback text,
  graded_at timestamp with time zone,
  graded_by uuid references public.profiles(id) on delete set null,
  unique (assignment_id, student_id)
);

create index if not exists idx_assignment_submissions_assignment
  on public.assignment_submissions(assignment_id, submitted_at desc);

create index if not exists idx_assignment_submissions_student
  on public.assignment_submissions(student_id, submitted_at desc);

alter table public.assignment_submissions enable row level security;

-- A student sees and writes only their own submission.
drop policy if exists "submissions_student_own" on public.assignment_submissions;
create policy "submissions_student_own"
  on public.assignment_submissions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- A teacher sees every submission for assignments in a course they own, and may
-- grade it. Grading is a separate policy so a teacher cannot rewrite a
-- student's answer.
drop policy if exists "submissions_teacher_read" on public.assignment_submissions;
create policy "submissions_teacher_read"
  on public.assignment_submissions for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.assignments a
      join public.courses c on c.id = a.course_id
      where a.id = assignment_submissions.assignment_id
        and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "submissions_teacher_grade" on public.assignment_submissions;
create policy "submissions_teacher_grade"
  on public.assignment_submissions for update
  using (
    public.is_admin()
    or exists (
      select 1
      from public.assignments a
      join public.courses c on c.id = a.course_id
      where a.id = assignment_submissions.assignment_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.assignments a
      join public.courses c on c.id = a.course_id
      where a.id = assignment_submissions.assignment_id
        and c.teacher_id = auth.uid()
    )
  );

-- Submission files. Private bucket: a submission is not public the way a course
-- handout is, so reads go through the API rather than a public URL.
insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', true, 26214400) -- 25 MiB
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "submissions_bucket_read" on storage.objects;
create policy "submissions_bucket_read"
  on storage.objects for select
  using (bucket_id = 'submissions');

-- Writes are namespaced by the student's own id, so one student cannot write
-- into another's folder.
drop policy if exists "submissions_bucket_owner_write" on storage.objects;
create policy "submissions_bucket_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
