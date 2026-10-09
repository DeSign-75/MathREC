-- MathREC auth migration: Supabase Auth -> Clerk.
-- User IDs are now Clerk IDs (text). Boards reset (local bests unaffected).

drop table if exists public.scores;
drop table if exists public.profiles;

create table public.profiles (
  id text primary key,
  tag text unique not null,
  created_at timestamptz not null default now()
);

create table public.scores (
  id bigint generated always as identity primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('classic','timeattack','hardcore','calculator','kabooom')),
  score integer not null check (score >= 0),
  accuracy integer not null default 0,
  max_combo integer not null default 0,
  avg_speed_ms integer not null default 0,
  questions integer not null default 0,
  created_at timestamptz not null default now()
);

create index scores_mode_score_idx
  on public.scores (mode, score desc);

alter table public.profiles enable row level security;
alter table public.scores enable row level security;

-- Public reads (leaderboard + tags). All writes go through the
-- server API with the service-role key, which bypasses RLS.
drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all"
  on public.profiles for select using (true);

drop policy if exists "scores readable by all" on public.scores;
create policy "scores readable by all"
  on public.scores for select using (true);
