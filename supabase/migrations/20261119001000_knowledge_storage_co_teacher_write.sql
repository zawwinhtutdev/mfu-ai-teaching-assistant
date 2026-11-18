-- Co-teachers could index materials through the API (owns_course) but browser
-- uploads to the `knowledge` bucket only allowed the primary `teacher_id`, so
-- large files failed at storage RLS before the route handler ran.

drop policy if exists "knowledge_course_owner_write" on storage.objects;

create policy "knowledge_course_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'knowledge'
    and (
      public.is_admin()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.owns_course(((storage.foldername(name))[1])::uuid)
      )
    )
  );