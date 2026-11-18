-- Storage for uploaded course materials.
--
-- `course_materials.file_url` existed but was always null: the upload route read
-- each PDF for text extraction, then discarded the file. A teacher could upload
-- a 20-page handout and neither they nor their students could ever open it again
-- — the card showed extracted text with no way back to the source.
--
-- `app/api/uploads` also referenced a `knowledge` bucket that was never created,
-- so that endpoint failed on every call.

insert into storage.buckets (id, name, public, file_size_limit)
values ('knowledge', 'knowledge', true, 52428800) -- 50 MiB, matching the PDF guidance
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Course materials are shown to enrolled students and the owning teacher, so the
-- objects are public-read. Uploads are written by the server after it has checked
-- course ownership, and namespaced by course id so a path cannot be guessed into
-- another course.
drop policy if exists "knowledge_public_read" on storage.objects;
create policy "knowledge_public_read"
  on storage.objects for select
  using (bucket_id = 'knowledge');

drop policy if exists "knowledge_course_owner_write" on storage.objects;
create policy "knowledge_course_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'knowledge'
    and (
      public.is_admin()
      or exists (
        select 1 from public.courses c
        where c.teacher_id = auth.uid()
          and (storage.foldername(name))[1] = c.id::text
      )
    )
  );
