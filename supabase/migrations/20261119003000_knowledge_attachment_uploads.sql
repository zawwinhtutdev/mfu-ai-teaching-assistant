-- Generic attachments uploaded through /api/uploads (announcements, chat
-- attachments, agent builder) are written under the caller's user-id prefix.
-- The course-prefix policy deliberately rejects that shape, so every attachment
-- upload failed with a storage RLS error before the announcement was created.
--
-- Allow an authenticated user to write only inside their own prefix. Course
-- materials keep their stricter course-id policy; this is the per-user fallback.

drop policy if exists "knowledge_user_uploads" on storage.objects;

create policy "knowledge_user_uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'knowledge'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
