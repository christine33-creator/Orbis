-- Photo storage for hidden gems. Files live under "<user id>/<file>" so people can only
-- write and delete inside their own folder. Photos are re-encoded in the browser before
-- upload, which strips EXIF metadata (including GPS) from the original file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gem-photos', 'gem-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "gem photos are public" on storage.objects for select
  using (bucket_id = 'gem-photos');

create policy "upload gem photos to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'gem-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own gem photos" on storage.objects for delete to authenticated
  using (bucket_id = 'gem-photos' and (storage.foldername(name))[1] = auth.uid()::text);
