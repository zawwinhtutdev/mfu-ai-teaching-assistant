-- The chunk policy still checked courses.teacher_id, so a co-teacher could
-- create the material row but the indexing step failed while inserting chunks.

drop policy if exists "Teachers can manage chunks for own courses" on public.course_material_chunks;

create policy "Teachers can manage chunks for own courses"
  on public.course_material_chunks
  for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));
