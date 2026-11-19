-- Co-teachers need the same student-profile visibility as the primary owner.
--
-- `profiles_read_enrolled_in_own_course` only checked `courses.teacher_id`, so a
-- co-teacher added through `course_teachers` saw the enrolment rows but every
-- embedded profile resolved to NULL — the course roster rendered empty. Reuse
-- `owns_course()`, which already understands both the legacy owner column and
-- `course_teachers`, so every teacher on a course sees its roster.

drop policy if exists "profiles_read_enrolled_in_own_course" on public.profiles;
create policy "profiles_read_enrolled_in_own_course"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.course_enrollments e
      where e.student_id = profiles.id
        and public.owns_course(e.course_id)
    )
  );

comment on policy "profiles_read_enrolled_in_own_course" on public.profiles is
  'A teacher (primary owner or co-teacher) may read the profile of a student enrolled in a course they teach.';
