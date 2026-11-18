-- Let a teacher read the profiles of students enrolled in their courses.
--
-- `profiles_select_own_or_admin` allows only `auth.uid() = id or is_admin()`.
-- That is correct for browsing the whole directory, but it also blocked the one
-- legitimate case: a teacher opening their own course roster. The enrolment row
-- was visible, the embedded `profiles` join came back null, so every course
-- showed "0 students" even when students were enrolled.
--
-- The new policy is narrow: a teacher may see a profile only when that person is
-- enrolled in a course the teacher owns. It does not let a teacher enumerate the
-- directory, and it does not reveal students in other teachers' courses.

drop policy if exists "profiles_read_enrolled_in_own_course" on public.profiles;
create policy "profiles_read_enrolled_in_own_course"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.course_enrollments e
      join public.courses c on c.id = e.course_id
      where e.student_id = profiles.id
        and c.teacher_id = auth.uid()
    )
  );

comment on policy "profiles_read_enrolled_in_own_course" on public.profiles is
  'A teacher may read the profile of a student enrolled in a course they own.';
