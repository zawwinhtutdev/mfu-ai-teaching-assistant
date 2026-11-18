-- Announcement policies still keyed on courses.teacher_id, so co-teachers hit RLS
-- on insert even when assertCourseAccess allowed the API call.

drop policy if exists "Teachers can manage announcements for own courses" on public.announcements;

create policy "Teachers can manage announcements for own courses"
  on public.announcements
  for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));

drop policy if exists "Teachers can manage announcement files for own courses" on public.announcement_files;

create policy "Teachers can manage announcement files for own courses"
  on public.announcement_files
  for all
  using (
    public.is_admin()
    or exists (
      select 1
      from public.announcements a
      where a.id = announcement_files.announcement_id
        and public.owns_course(a.course_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.announcements a
      where a.id = announcement_files.announcement_id
        and public.owns_course(a.course_id)
    )
  );