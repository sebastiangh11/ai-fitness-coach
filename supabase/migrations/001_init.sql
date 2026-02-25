-- ============================================================
-- 001_init.sql  –  AI Fitness Coach initial schema
-- ============================================================

-- Extensions
create extension if not exists pgcrypto;

-- ============================================================
-- Helper: updated_at auto-stamp trigger function
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- weeks
-- One row per user × training week (Mon-anchored ISO date).
-- Owns the serialised PlanContext (context_json) and metadata
-- about which engine version produced the plan.
-- ============================================================
create table if not exists weeks (
  id             uuid        primary key default gen_random_uuid(),
  user_key       text        not null default 'local',
  week_start     date        not null,
  engine_version text        not null default 'v1',
  context_json   jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint weeks_user_week_unique unique (user_key, week_start)
);

create index if not exists idx_weeks_user_key       on weeks (user_key);
create index if not exists idx_weeks_week_start     on weeks (week_start);

create trigger trg_weeks_updated_at
  before update on weeks
  for each row execute function set_updated_at();

-- ============================================================
-- plan_days
-- One row per calendar day within a week.
-- payload stores the full PlanDay object (primary + secondary
-- BaseSession, status, date) as returned by the engine.
-- ============================================================
create table if not exists plan_days (
  id         uuid        primary key default gen_random_uuid(),
  week_id    uuid        not null references weeks (id) on delete cascade,
  date       date        not null,
  status     text        not null default 'planned',
  payload    jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plan_days_week_date_unique unique (week_id, date)
);

create index if not exists idx_plan_days_week_id on plan_days (week_id);
create index if not exists idx_plan_days_date    on plan_days (date);
create index if not exists idx_plan_days_status  on plan_days (status)
  where status in ('planned', 'missed');

create trigger trg_plan_days_updated_at
  before update on plan_days
  for each row execute function set_updated_at();

-- ============================================================
-- completed_sessions
-- Append-only log of sessions the athlete actually finished.
-- payload stores a CompletedSession object (type, duration,
-- rpe, load, notes, etc.).
-- ============================================================
create table if not exists completed_sessions (
  id         uuid        primary key default gen_random_uuid(),
  week_id    uuid        not null references weeks (id) on delete cascade,
  date       date        not null,
  payload    jsonb       not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_completed_sessions_week_id on completed_sessions (week_id);
create index if not exists idx_completed_sessions_date    on completed_sessions (date);

-- ============================================================
-- decision_logs
-- Append-only audit trail of engine decisions for a week.
-- entries stores an array of DecisionLog objects
-- ({ rule, message, severity }).
-- source identifies which engine sub-system produced the log
-- (e.g. 'planGenerator', 'missAdjuster').
-- ============================================================
create table if not exists decision_logs (
  id         uuid        primary key default gen_random_uuid(),
  week_id    uuid        not null references weeks (id) on delete cascade,
  source     text        not null,
  entries    jsonb       not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_decision_logs_week_id on decision_logs (week_id);
