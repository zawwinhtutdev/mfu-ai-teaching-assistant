-- Profile pictures for students and teachers.
--
-- `profiles.avatar_url` has existed since the baseline schema but nothing could
-- ever populate it: there was no storage bucket, no upload endpoint, and no UI.
-- Settings only edited the display name.
--
-- The bucket is public-read because avatars are shown next to names in course
-- rosters and announcements, where a signed URL per row would be wasteful. Writes
-- are not public: the upload endpoint uses the service role after verifying the
-- caller, and the object path is namespaced by user id so one account cannot
-- overwrite another's picture.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MiB: ample for a headshot, small enough to keep pages fast
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read an avatar (it is rendered in shared course views).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A user may only write inside a folder named after their own id.
drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
