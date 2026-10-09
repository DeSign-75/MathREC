-- MathREC leaderboards (run once in Supabase SQL Editor)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tag text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('classic','timeattack','hardcore','calculator','kabooom')),
  score integer not null check (score >= 0),
  accuracy integer not null default 0,
  max_combo integer not null default 0,
  avg_speed_ms integer not null default 0,
  questions integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists scores_mode_score_idx
  on public.scores (mode, score desc);

alter table public.profiles enable row level security;
alter table public.scores enable row level security;

drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all"
  on public.profiles for select using (true);

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile"
  on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "scores readable by all" on public.scores;
create policy "scores readable by all"
  on public.scores for select using (true);

drop policy if exists "users insert own scores" on public.scores;
create policy "users insert own scores"
  on public.scores for insert with check (auth.uid() = user_id);
