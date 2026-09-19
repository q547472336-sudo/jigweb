-- 拼图时光 M2 core schema
-- 仅使用 IF NOT EXISTS / CREATE OR REPLACE，支持在本地重复执行。

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '本地玩家',
  avatar_path text,
  bio text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_format check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 30),
  constraint profiles_bio_length check (char_length(bio) <= 200)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  status text not null default 'published' check (status in ('published', 'unpublished')),
  category_id uuid not null references public.categories(id),
  rows integer not null,
  columns integer not null,
  shape text not null default 'classic' check (shape in ('classic', 'rectangular')),
  version integer not null default 1 check (version > 0),
  play_count bigint not null default 0 check (play_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint puzzles_title_length check (char_length(title) between 1 and 60),
  constraint puzzles_description_length check (char_length(description) <= 500),
  constraint puzzles_rows_range check (rows between 3 and 25),
  constraint puzzles_columns_range check (columns between 3 and 25),
  constraint puzzles_piece_count_range check (rows * columns between 9 and 500)
);

create table if not exists public.puzzle_assets (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('original', 'cropped', 'game', 'thumbnail')),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  width integer not null check (width >= 1),
  height integer not null check (height >= 1),
  bytes bigint not null check (bytes between 1 and 10485760),
  puzzle_version integer not null default 1 check (puzzle_version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (puzzle_id, puzzle_version, kind),
  unique (storage_path)
);

create table if not exists public.puzzle_curation (
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  collection text not null check (collection in ('popular', 'featured', 'new')),
  position integer not null check (position >= 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (puzzle_id, collection),
  unique (collection, position)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, puzzle_id)
);

create table if not exists public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  puzzle_version integer not null default 1 check (puzzle_version > 0),
  mode text not null default 'normal' check (mode in ('normal', 'practice')),
  status text not null default 'ready' check (status in ('ready', 'active', 'paused', 'completed')),
  snapshot jsonb not null,
  state_version bigint not null default 1 check (state_version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint play_sessions_one_identity check ((user_id is not null) <> (guest_id is not null)),
  constraint play_sessions_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

create unique index if not exists play_sessions_user_active_unique on public.play_sessions(user_id, puzzle_id) where user_id is not null and status <> 'completed';
create unique index if not exists play_sessions_guest_active_unique on public.play_sessions(guest_id, puzzle_id) where guest_id is not null and status <> 'completed';

create table if not exists public.completion_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  first_completed_at timestamptz not null default timezone('utc', now()),
  last_completed_at timestamptz not null default timezone('utc', now()),
  source text not null default 'normal' check (source in ('normal', 'challenge', 'room')),
  primary key (user_id, puzzle_id)
);

create table if not exists public.recent_plays (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  last_played_at timestamptz not null default timezone('utc', now()),
  last_mode text not null default 'normal' check (last_mode in ('normal', 'challenge', 'room')),
  session_id uuid references public.play_sessions(id) on delete set null,
  primary key (user_id, puzzle_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('room_completed', 'feedback_updated', 'puzzle_unpublished')),
  subject_id uuid,
  read_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug', 'suggestion', 'other')),
  description text not null check (char_length(description) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'processing', 'resolved', 'rejected')),
  ticket_no text not null unique,
  resolution text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  category text not null check (category in ('rights', 'inappropriate', 'other')),
  description text not null check (char_length(description) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'processing', 'resolved', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists reports_24h_dedupe on public.reports (reporter_id, puzzle_id, (date_bin('24 hours', created_at, '2000-01-01'::timestamptz)));

create table if not exists public.idempotency_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  operation text not null,
  request_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  primary key (user_id, operation, key)
);

create table if not exists public.otp_challenges (
  email text primary key,
  code_digest text not null,
  sent_at timestamptz[] not null default '{}',
  resend_at timestamptz not null,
  expires_at timestamptz not null,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  consumed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_change_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  old_email text not null,
  new_email text not null,
  expires_at timestamptz not null,
  old_verified_at timestamptz,
  new_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint email_change_distinct check (old_email <> new_email)
);

create index if not exists puzzles_public_category_created_idx on public.puzzles(category_id, created_at desc) where status = 'published' and visibility = 'public';
create index if not exists puzzles_public_play_count_idx on public.puzzles(play_count desc, created_at desc, id) where status = 'published' and visibility = 'public';
create index if not exists puzzles_owner_created_idx on public.puzzles(owner_id, created_at desc);
create index if not exists puzzle_assets_puzzle_idx on public.puzzle_assets(puzzle_id, puzzle_version);
create index if not exists recent_plays_user_time_idx on public.recent_plays(user_id, last_played_at desc);
create index if not exists notifications_user_time_idx on public.notifications(user_id, created_at desc);
create index if not exists feedback_user_time_idx on public.feedback(user_id, created_at desc);
create index if not exists reports_puzzle_time_idx on public.reports(puzzle_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','categories','puzzles','puzzle_assets','puzzle_curation','play_sessions','notifications','feedback','reports','email_change_requests'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('puzzle-assets', 'puzzle-assets', false)
on conflict (id) do update set public = false;

-- 版本写入和完成结算必须在数据库内完成，避免两个设备同时写入时发生丢更新。
create or replace function public.save_play_session(
  p_session_id uuid,
  p_expected_state_version bigint,
  p_snapshot jsonb,
  p_status text
)
returns public.play_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare saved public.play_sessions;
begin
  if p_status not in ('ready', 'active', 'paused') or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'invalid_session_payload' using errcode = '22023';
  end if;
  update public.play_sessions
     set snapshot = p_snapshot,
         status = p_status,
         state_version = state_version + 1,
         updated_at = timezone('utc', now())
   where id = p_session_id
     and user_id = auth.uid()
     and status <> 'completed'
     and state_version = p_expected_state_version
   returning * into saved;
  if saved.id is null then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
  return saved;
end;
$$;

create or replace function public.complete_play_session(p_session_id uuid)
returns table (session_id uuid, state_version bigint, replay boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare current_session public.play_sessions;
begin
  select * into current_session from public.play_sessions where id = p_session_id and user_id = auth.uid();
  if current_session.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if current_session.status = 'completed' then
    return query select current_session.id, current_session.state_version, true;
    return;
  end if;
  if not exists (select 1 from jsonb_array_elements(current_session.snapshot->'pieces') piece where coalesce((piece->>'fixed')::boolean, false) = false)
     or jsonb_typeof(current_session.snapshot->'pieces') <> 'array'
     or jsonb_array_length(current_session.snapshot->'pieces') = 0 then
    raise exception 'incomplete_session' using errcode = '22023';
  end if;
  update public.play_sessions
     set status = 'completed', state_version = state_version + 1, updated_at = timezone('utc', now())
   where id = current_session.id and user_id = auth.uid() and state_version = current_session.state_version;
  return query select current_session.id, current_session.state_version + 1, false;
end;
$$;

create or replace function public.upsert_completion(p_puzzle_id uuid, p_source text default 'normal')
returns public.completion_records
language sql
security invoker
set search_path = public
as $$
  insert into public.completion_records(user_id, puzzle_id, source)
  values (auth.uid(), p_puzzle_id, p_source)
  on conflict (user_id, puzzle_id) do update
    set last_completed_at = timezone('utc', now()), source = excluded.source
  returning *;
$$;

create or replace function public.touch_recent_play(p_puzzle_id uuid, p_mode text, p_session_id uuid default null)
returns public.recent_plays
language sql
security invoker
set search_path = public
as $$
  insert into public.recent_plays(user_id, puzzle_id, last_mode, session_id)
  values (auth.uid(), p_puzzle_id, p_mode, p_session_id)
  on conflict (user_id, puzzle_id) do update
    set last_played_at = timezone('utc', now()), last_mode = excluded.last_mode, session_id = excluded.session_id
  returning *;
$$;
