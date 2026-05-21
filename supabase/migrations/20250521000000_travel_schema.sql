-- Travel Agent Platform schema
-- Run: supabase db push (or apply in Supabase SQL editor)

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  trips_count int not null default 0,
  countries_visited int not null default 0,
  ai_plans_generated int not null default 0,
  push_notifications_enabled boolean not null default true,
  offline_sync_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trips
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  destination text not null,
  origin_city text,
  destination_lat double precision,
  destination_lon double precision,
  country text,
  start_date date,
  end_date date,
  travelers int not null default 1,
  budget_usd numeric(12, 2),
  status text not null default 'draft'
    check (status in ('draft', 'upcoming', 'saved', 'completed')),
  image_url text,
  weather_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);
create index if not exists trips_status_idx on public.trips (user_id, status);

-- Chat
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  title text not null default 'Trip planning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);

-- Itinerary
create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_number int not null,
  title text,
  unique (trip_id, day_number)
);

create table if not exists public.itinerary_activities (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  activity_time text,
  name text not null,
  cost_usd numeric(12, 2),
  transport text,
  notes text,
  latitude double precision,
  longitude double precision,
  sort_order int not null default 0
);

-- Budget
create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null,
  amount_usd numeric(12, 2) not null default 0,
  color text,
  sort_order int not null default 0
);

-- Travel search cache
create table if not exists public.trip_hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  external_id text,
  name text not null,
  rating numeric(3, 1),
  price_per_night_usd numeric(12, 2),
  image_url text,
  raw jsonb,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  airline text,
  route text,
  depart_time text,
  arrive_time text,
  price_usd numeric(12, 2),
  stops text,
  raw jsonb,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

-- Packing
create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null,
  packed boolean not null default false,
  sort_order int not null default 0
);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  type text not null check (type in ('flight', 'packing', 'itinerary', 'booking', 'general')),
  title text not null,
  body text not null,
  read boolean not null default false,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- RLS
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_activities enable row level security;
alter table public.budget_categories enable row level security;
alter table public.trip_hotels enable row level security;
alter table public.trip_flights enable row level security;
alter table public.packing_items enable row level security;
alter table public.notifications enable row level security;

-- Profiles policies
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Trips policies
create policy "trips_select_own" on public.trips for select using (auth.uid() = user_id);
create policy "trips_insert_own" on public.trips for insert with check (auth.uid() = user_id);
create policy "trips_update_own" on public.trips for update using (auth.uid() = user_id);
create policy "trips_delete_own" on public.trips for delete using (auth.uid() = user_id);

-- Chat policies
create policy "conversations_select_own" on public.chat_conversations
  for select using (auth.uid() = user_id);
create policy "conversations_insert_own" on public.chat_conversations
  for insert with check (auth.uid() = user_id);
create policy "conversations_update_own" on public.chat_conversations
  for update using (auth.uid() = user_id);
create policy "conversations_delete_own" on public.chat_conversations
  for delete using (auth.uid() = user_id);

create policy "messages_select_via_conversation" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
create policy "messages_insert_via_conversation" on public.chat_messages
  for insert with check (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Child tables via trip ownership
create policy "itinerary_days_all" on public.itinerary_days for all using (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
);
create policy "itinerary_activities_all" on public.itinerary_activities for all using (
  exists (
    select 1 from public.itinerary_days d
    join public.trips t on t.id = d.trip_id
    where d.id = day_id and t.user_id = auth.uid()
  )
);
create policy "budget_categories_all" on public.budget_categories for all using (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
);
create policy "trip_hotels_all" on public.trip_hotels for all using (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
);
create policy "trip_flights_all" on public.trip_flights for all using (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
);
create policy "packing_items_all" on public.packing_items for all using (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
);
create policy "notifications_all" on public.notifications for all using (
  auth.uid() = user_id
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for chat attachments
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

create policy "chat_attachments_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "chat_attachments_read" on storage.objects
  for select using (bucket_id = 'chat-attachments');

create policy "chat_attachments_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
