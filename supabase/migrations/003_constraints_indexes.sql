-- MathREC hardening: CHECK constraints + hot-path indexes.
-- Idempotent (safe to re-run). Requires migration 002 applied first.

-- Defense in depth: the API validates these too, but the DB enforces them
-- even if a future code path forgets.
alter table public.scores
  drop constraint if exists scores_accuracy_range,
  drop constraint if exists scores_nonneg,
  add constraint scores_accuracy_range check (accuracy between 0 and 100),
  add constraint scores_nonneg check (max_combo >= 0 and avg_speed_ms >= 0 and questions >= 0);

alter table public.profiles
  drop constraint if exists profiles_tag_format,
  add constraint profiles_tag_format check (tag ~ '^[A-Z0-9_-]{3,16}$');

-- Hot paths: rate-limit lookup + per-user best/rank queries.
create index if not exists scores_user_created_idx
  on public.scores (user_id, created_at desc);
create index if not exists scores_mode_user_score_idx
  on public.scores (mode, user_id, score desc);
