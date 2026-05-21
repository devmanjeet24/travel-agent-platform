-- Fix storage policies (safe to re-run)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'audio/mpeg', 'audio/webm', 'audio/mp4']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

drop policy if exists "chat_attachments_upload" on storage.objects;
drop policy if exists "chat_attachments_read" on storage.objects;
drop policy if exists "chat_attachments_update_own" on storage.objects;
drop policy if exists "chat_attachments_delete_own" on storage.objects;

create policy "chat_attachments_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chat_attachments_read" on storage.objects
  for select using (bucket_id = 'chat-attachments');

create policy "chat_attachments_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chat_attachments_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
