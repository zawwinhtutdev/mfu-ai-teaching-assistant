-- Spec §4 completion: material approval state + assignments.
--
-- Two gaps closed here:
--
-- 1. `course_materials.approval_status` is already read and written by
--    app/api/courses/[courseId]/materials/route.ts (insert defaults to 'draft';
--    the PATCH route validates 'draft' | 'approved' | 'published'), but no
--    migration ever created the column — so PostgREST rejected every insert
--    with PGRST204 and teacher uploads failed outright. The default is
--    'published' so existing rows and the current single-teacher workflow keep
--    behaving as they do today; the approval gate becomes opt-in.
--
-- 2. Spec §4 lists an `assignments` table (id, course_id, title, due_date,
--    instructions) and DoD #4 wants reminders driven by real deadlines. Today
--    `study_reminders` only holds free-text rows a student types by hand, with
--    nothing to derive them from.

-- ─────────────────────────────────────────────────────────────
-- 1. Material approval state
-- ─────────────────────────────────────────────────────────────
alter table public.course_materials
  add column if not exists approval_status text not null default 'published';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'course_materials_approval_status_check'
  ) then
    alter table public.course_materials
      add constraint course_materials_approval_status_check
      check (approval_status in ('draft', 'approved', 'published'));
  end if;
end $$;

create index if not exists idx_course_materials_approval
  on public.course_materials(course_id, approval_status);

comment on column public.course_materials.approval_status is
  'draft = teacher-only, approved = queued for release, published = visible to enrolled students.';

-- ─────────────────────────────────────────────────────────────
-- 2. Assignments
--
-- `visible_to_students` mirrors the material approval gate: a teacher can draft
-- an assignment before releasing it. `due_at` is the single source of truth for
-- deadline reminders, replacing hand-typed reminder text.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  instructions text,
  due_at timestamp with time zone,
  points integer check (points is null or points >= 0),
  visible_to_students boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_assignments_course_due
  on public.assignments(course_id, due_at);

alter table public.assignments enable row level security;

-- Teachers manage assignments for courses they own; admins may manage any.
drop policy if exists "assignments_teacher_write" on public.assignments;
create policy "assignments_teacher_write"
  on public.assignments for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));

-- Students see released assignments for courses they are enrolled in.
drop policy if exists "assignments_read_enrolled" on public.assignments;
create policy "assignments_read_enrolled"
  on public.assignments for select
  using (visible_to_students and public.is_enrolled(course_id));

-- ─────────────────────────────────────────────────────────────
-- 3. Link reminders to the assignment that scheduled them.
--
-- Nullable: hand-created reminders stay valid. ON DELETE CASCADE means
-- deleting an assignment also clears the reminders derived from it.
-- ─────────────────────────────────────────────────────────────
alter table public.study_reminders
  add column if not exists assignment_id uuid references public.assignments(id) on delete cascade;

create index if not exists idx_study_reminders_assignment
  on public.study_reminders(assignment_id)
  where assignment_id is not null;

-- One reminder per student per assignment: re-running the scheduler must not
-- create duplicates.
create unique index if not exists idx_study_reminders_student_assignment
  on public.study_reminders(student_id, assignment_id)
  where assignment_id is not null;
