-- Teacher-authored flashcards belong to the course, not to one student. The
-- existing `flashcards` table is owner-scoped (student_id = auth.uid()), so a
-- course deck needs its own table and read access for enrolled students.

create table if not exists public.course_flashcards (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  question text not null,
  answer text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_course_flashcards_course
  on public.course_flashcards(course_id, created_at desc);

alter table public.course_flashcards enable row level security;

drop policy if exists "course_flashcards_read" on public.course_flashcards;
create policy "course_flashcards_read"
  on public.course_flashcards for select
  using (
    exists (
      select 1 from public.course_enrollments e
      where e.course_id = course_flashcards.course_id and e.student_id = auth.uid()
    )
    or exists (
      select 1 from public.courses c
      where c.id = course_flashcards.course_id and c.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "course_flashcards_write_insert" on public.course_flashcards;
create policy "course_flashcards_write_insert"
  on public.course_flashcards for insert
  with check (
    exists (select 1 from public.courses c where c.id = course_flashcards.course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "course_flashcards_write_update" on public.course_flashcards;
create policy "course_flashcards_write_update"
  on public.course_flashcards for update
  using (
    exists (select 1 from public.courses c where c.id = course_flashcards.course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.courses c where c.id = course_flashcards.course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "course_flashcards_write_delete" on public.course_flashcards;
create policy "course_flashcards_write_delete"
  on public.course_flashcards for delete
  using (
    exists (select 1 from public.courses c where c.id = course_flashcards.course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
