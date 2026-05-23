-- Profile avatar storage bucket (public read, user-scoped write/delete)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "profile_avatars_upload" on storage.objects;
drop policy if exists "profile_avatars_read" on storage.objects;
drop policy if exists "profile_avatars_update_own" on storage.objects;
drop policy if exists "profile_avatars_delete_own" on storage.objects;

create policy "profile_avatars_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "profile_avatars_read" on storage.objects
  for select using (bucket_id = 'profile-avatars');

create policy "profile_avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "profile_avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
