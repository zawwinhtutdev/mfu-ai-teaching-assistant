-- Course detail fields and class sections.
--
-- The admin creates courses, and a real university course carries more than a
-- code and a title: academic year, credits (with the lecture/lab/self-study
-- split), owning school, and one or more taught sections with a timetable and
-- room. None of that had anywhere to live.
--
-- Two additions:
--   1. detail columns on `courses`
--   2. a `course_sections` child table
--
-- Enrolment stays course-level, but `course_enrollments.section_id` lets an
-- admin place a student in a specific section so a section's registered count is
-- real rather than a copy of the course total.

-- ─────────────────────────────────────────────────────────────
-- 1. Course details
-- ─────────────────────────────────────────────────────────────
alter table public.courses
  add column if not exists academic_year text,
  add column if not exists school text,
  add column if not exists credit_total numeric(4,1),
  add column if not exists credit_lecture numeric(4,1),
  add column if not exists credit_lab numeric(4,1),
  add column if not exists credit_self_study numeric(4,1),
  add column if not exists grading_type text,
  add column if not exists further_information text;

comment on column public.courses.academic_year is
  'Buddhist or Gregorian academic year as entered by the admin, e.g. 2569.';
comment on column public.courses.credit_lecture is
  'Lecture hours per week. Together with lab and self-study this renders as "3 (3-0-6)".';
comment on column public.courses.further_information is
  'Free-text notes shown in the collapsible "Further information" area of the course info view.';

-- ─────────────────────────────────────────────────────────────
-- 2. Sections
--
-- `capacity` is the seats the section offers. There is deliberately no
-- `registered` column: that is derived from course_enrollments, because a
-- stored counter drifts the moment a student is added or dropped by any path.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  section_no text not null,
  section_type text not null default 'Lecture',
  timetable text,
  room text,
  capacity integer not null default 30 check (capacity >= 0),
  requested integer not null default 0 check (requested >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (course_id, section_no)
);

create index if not exists idx_course_sections_course
  on public.course_sections(course_id, section_no);

alter table public.course_sections enable row level security;

-- Anyone who can read the course can read its sections; only the owning teacher
-- or an admin may change them.
drop policy if exists "course_sections_read" on public.course_sections;
create policy "course_sections_read"
  on public.course_sections for select
  using (
    public.is_admin()
    or public.owns_course(course_id)
    or public.is_enrolled(course_id)
  );

drop policy if exists "course_sections_write" on public.course_sections;
create policy "course_sections_write"
  on public.course_sections for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));

-- ─────────────────────────────────────────────────────────────
-- 3. Enrolment may target a section
-- ─────────────────────────────────────────────────────────────
alter table public.course_enrollments
  add column if not exists section_id uuid references public.course_sections(id) on delete set null;

create index if not exists idx_course_enrollments_section
  on public.course_enrollments(section_id);

comment on column public.course_enrollments.section_id is
  'Optional section placement. NULL means enrolled in the course without a section assignment.';
