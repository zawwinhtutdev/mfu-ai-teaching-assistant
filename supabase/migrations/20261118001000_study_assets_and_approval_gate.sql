-- Spec §2.1/§2.2/§4 completion: generated study assets are stored, and the
-- material approval gate is actually enforced.
--
-- Before this migration the generation endpoints (`/api/summarize`,
-- `/api/generate-flashcards`, `/api/generate-quiz`) returned JSON and dropped
-- it. `flashcards` and `quizzes` therefore stayed empty for every real user,
-- and `components/student/material-card.tsx` told students to "check the
-- Flashcards tab" where nothing could ever appear.
--
-- The approval gate is the other half: `approval_status` existed as a column
-- with a comment describing a student-visible gate, but no RLS policy read it,
-- so a `draft` material was readable by every enrolled student.

-- ─────────────────────────────────────────────────────────────
-- 1. Summaries live on the material
--
-- Spec §4 models this as `lectures.summary_text`. `course_materials` is the
-- equivalent table here, so the summary belongs on the row rather than in a
-- side table that could drift out of sync with the source text.
-- ─────────────────────────────────────────────────────────────
alter table public.course_materials
  add column if not exists summary_text text;

comment on column public.course_materials.summary_text is
  'AI-generated summary of `content`. Released to students only when approval_status is published.';

-- A student asking "summarise this" produces a private study aid, not course
-- content. It is scoped to that student exactly like a flashcard, so it lives
-- in its own table instead of writing to a row the student does not own.
create table if not exists public.material_summaries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid not null references public.course_materials(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  summary_text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (student_id, material_id)
);

create index if not exists idx_material_summaries_student
  on public.material_summaries(student_id, material_id);

alter table public.material_summaries enable row level security;

drop policy if exists "material_summaries_owner" on public.material_summaries;
create policy "material_summaries_owner"
  on public.material_summaries for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. Quizzes need provenance, an owner, and a release flag
--
-- Without `material_id` a generated quiz could not be traced back to the
-- material it came from, and without `is_published` a teacher had no way to
-- review a generated quiz before students saw it.
--
-- `student_id` separates the two kinds of quiz that share this table:
--   null      -> course-wide quiz authored by the teacher, released when published
--   not null  -> personal practice quiz for one student (spec §2.1 Study Guidance)
-- ─────────────────────────────────────────────────────────────
alter table public.quizzes
  add column if not exists material_id uuid references public.course_materials(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists student_id uuid references public.profiles(id) on delete cascade,
  add column if not exists is_published boolean not null default true;

create index if not exists idx_quizzes_course_published
  on public.quizzes(course_id, is_published);

create index if not exists idx_quizzes_student
  on public.quizzes(student_id, course_id);

comment on column public.quizzes.is_published is
  'false = teacher-only draft. Default true so pre-existing rows keep behaving as they did.';

comment on column public.quizzes.student_id is
  'null = course-wide quiz; set = personal practice quiz visible only to that student.';

-- ─────────────────────────────────────────────────────────────
-- 3. Flashcards are per-student study state
--
-- `flashcards_owner` already scopes rows to their owner. Regeneration replaces
-- the previous set for a material (see /api/generate-flashcards), so a lookup
-- index on the replace predicate is what is needed here rather than a unique
-- constraint that would turn a re-run into a 23505.
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_flashcards_student_material
  on public.flashcards(student_id, material_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Enforce the material approval gate
--
-- Students may read: published materials, plus their own course materials when
-- they are the owner. Teachers and admins still see drafts so they can review
-- them. `approval_status` defaults to 'published', so existing rows and the
-- single-teacher workflow are unchanged.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "materials_read_enrolled" on public.course_materials;
create policy "materials_read_enrolled"
  on public.course_materials for select
  using (
    public.is_admin()
    or public.owns_course(course_id)
    or (
      public.is_enrolled(course_id)
      and approval_status = 'published'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Quizzes: published course quizzes are readable by the class, personal
--    practice quizzes only by their owner, drafts stay with the teacher.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "quizzes_read_enrolled" on public.quizzes;
create policy "quizzes_read_enrolled"
  on public.quizzes for select
  using (
    public.is_admin()
    or public.owns_course(course_id)
    or student_id = auth.uid()
    or (
      student_id is null
      and is_published = true
      and public.is_enrolled(course_id)
    )
  );

drop policy if exists "quizzes_teacher_write" on public.quizzes;
create policy "quizzes_teacher_write"
  on public.quizzes for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));

-- Students generate their own practice quizzes and must be able to store them.
-- The write is pinned to their own id so a student cannot publish a course-wide
-- quiz (student_id null) into someone else's class.
drop policy if exists "quizzes_student_write_own" on public.quizzes;
create policy "quizzes_student_write_own"
  on public.quizzes for insert
  with check (
    student_id = auth.uid()
    and public.is_enrolled(course_id)
  );

drop policy if exists "quizzes_student_delete_own" on public.quizzes;
create policy "quizzes_student_delete_own"
  on public.quizzes for delete
  using (student_id = auth.uid());
