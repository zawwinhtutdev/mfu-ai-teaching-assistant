-- Admin owns course creation and enrolment.
--
-- The original model assumed a teacher creates their own course, so
-- `courses.teacher_id` was NOT NULL and `courses_teacher_write` required
-- `teacher_id = auth.uid()`. That makes an admin-run setup impossible in two
-- ways: a course cannot exist before a teacher is assigned, and an admin
-- creating a course would have to impersonate one first.
--
-- New model:
--   * an admin creates the course, optionally assigning a teacher immediately
--   * the teacher is assigned (or changed) afterwards
--   * an admin enrols students
--
-- `teacher_id` therefore becomes nullable. Every existing row has a teacher, so
-- nothing changes for them.

-- ─────────────────────────────────────────────────────────────
-- 1. A course may be unassigned
-- ─────────────────────────────────────────────────────────────
alter table public.courses
  alter column teacher_id drop not null;

comment on column public.courses.teacher_id is
  'Owning teacher. NULL while an administrator has created the course but not yet assigned one.';

-- Courses without a teacher still need to appear in the admin list, and admins
-- filter by teacher often enough to warrant an index on the nullable column.
create index if not exists idx_courses_teacher
  on public.courses(teacher_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Admins create and manage courses; teachers manage only their own
--
-- The existing policy already allows `public.is_admin()` on write, so course
-- creation works once the column is nullable. What is missing is a way for an
-- admin to change `teacher_id` on a course they do not teach — that is covered
-- by the same policy's `school_admin` branch, kept explicit here for clarity.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "courses_teacher_write" on public.courses;
create policy "courses_teacher_write"
  on public.courses for all
  using (
    public.is_admin()
    or (teacher_id is not null and teacher_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (teacher_id is not null and teacher_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 3. Only an admin may change `teacher_id`
--
-- RLS cannot compare OLD to NEW, so without a trigger a teacher could reassign
-- their own course to a colleague (or to themselves from an unassigned course).
-- ─────────────────────────────────────────────────────────────
create or replace function public.guard_course_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  if new.teacher_id is not distinct from old.teacher_id then
    return new;
  end if;

  -- Seeds and migrations run as the service role and must not be blocked.
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  if jwt_role = 'service_role' then
    return new;
  end if;

  if not public.is_admin() then
    raise exception 'Only an administrator may assign a teacher to a course'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists on_course_teacher_changed on public.courses;
create trigger on_course_teacher_changed
  before update on public.courses
  for each row
  execute function public.guard_course_teacher_assignment();

comment on function public.guard_course_teacher_assignment() is
  'Blocks a non-admin from reassigning courses.teacher_id.';
