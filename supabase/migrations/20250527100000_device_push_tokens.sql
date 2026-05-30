-- Device push tokens for Expo push notifications
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

create policy "device_push_tokens_select_own" on public.device_push_tokens
  for select using (auth.uid() = user_id);

create policy "device_push_tokens_insert_own" on public.device_push_tokens
  for insert with check (auth.uid() = user_id);

create policy "device_push_tokens_update_own" on public.device_push_tokens
  for update using (auth.uid() = user_id);

create policy "device_push_tokens_delete_own" on public.device_push_tokens
  for delete using (auth.uid() = user_id);
