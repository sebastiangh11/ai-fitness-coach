-- ============================================================
-- 002_auth_rls.sql  –  Add per-user ownership + Row Level Security
-- ============================================================
-- Assumes tables from 001_init.sql exist.
-- Safe to run on an empty (dev) database.
-- Production: backfill user_id before the SET NOT NULL step.
-- ============================================================

-- ── 1. Add user_id columns ─────────────────────────────────────────────────

ALTER TABLE public.weeks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users;
ALTER TABLE public.weeks
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.plan_days
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users;
ALTER TABLE public.plan_days
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.completed_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users;
ALTER TABLE public.completed_sessions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.decision_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users;
ALTER TABLE public.decision_logs
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ── 2. NOT NULL constraint (safe on empty / freshly migrated tables) ────────
-- If existing rows have NULL user_id, delete or backfill them first.

ALTER TABLE public.weeks            ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.plan_days        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.completed_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.decision_logs    ALTER COLUMN user_id SET NOT NULL;

-- ── 3. Replace old user_key-based unique constraint on weeks ────────────────

ALTER TABLE public.weeks
  DROP CONSTRAINT IF EXISTS weeks_user_week_unique;

ALTER TABLE public.weeks
  ADD CONSTRAINT weeks_user_week_unique UNIQUE (user_id, week_start);

-- ── 4. Performance indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_weeks_user_id
  ON public.weeks (user_id);

CREATE INDEX IF NOT EXISTS idx_weeks_user_id_week_start
  ON public.weeks (user_id, week_start);

CREATE INDEX IF NOT EXISTS idx_plan_days_user_id
  ON public.plan_days (user_id);

CREATE INDEX IF NOT EXISTS idx_plan_days_user_id_week_id
  ON public.plan_days (user_id, week_id);

CREATE INDEX IF NOT EXISTS idx_completed_sessions_user_id
  ON public.completed_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_completed_sessions_user_id_week_id
  ON public.completed_sessions (user_id, week_id);

CREATE INDEX IF NOT EXISTS idx_decision_logs_user_id
  ON public.decision_logs (user_id);

-- ── 5. Enable Row Level Security ────────────────────────────────────────────

ALTER TABLE public.weeks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_days          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_logs      ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS policies ─────────────────────────────────────────────────────────
-- Drop first in case migration is re-run.

DROP POLICY IF EXISTS "weeks_select" ON public.weeks;
DROP POLICY IF EXISTS "weeks_insert" ON public.weeks;
DROP POLICY IF EXISTS "weeks_update" ON public.weeks;
DROP POLICY IF EXISTS "weeks_delete" ON public.weeks;

DROP POLICY IF EXISTS "plan_days_select" ON public.plan_days;
DROP POLICY IF EXISTS "plan_days_insert" ON public.plan_days;
DROP POLICY IF EXISTS "plan_days_update" ON public.plan_days;
DROP POLICY IF EXISTS "plan_days_delete" ON public.plan_days;

DROP POLICY IF EXISTS "completed_sessions_select" ON public.completed_sessions;
DROP POLICY IF EXISTS "completed_sessions_insert" ON public.completed_sessions;
DROP POLICY IF EXISTS "completed_sessions_delete" ON public.completed_sessions;

DROP POLICY IF EXISTS "decision_logs_select" ON public.decision_logs;
DROP POLICY IF EXISTS "decision_logs_insert" ON public.decision_logs;

-- weeks
CREATE POLICY "weeks_select" ON public.weeks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "weeks_insert" ON public.weeks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "weeks_update" ON public.weeks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "weeks_delete" ON public.weeks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- plan_days
CREATE POLICY "plan_days_select" ON public.plan_days
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "plan_days_insert" ON public.plan_days
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "plan_days_update" ON public.plan_days
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "plan_days_delete" ON public.plan_days
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- completed_sessions (append-only: no UPDATE policy)
CREATE POLICY "completed_sessions_select" ON public.completed_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "completed_sessions_insert" ON public.completed_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "completed_sessions_delete" ON public.completed_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- decision_logs (append-only: no UPDATE policy)
CREATE POLICY "decision_logs_select" ON public.decision_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "decision_logs_insert" ON public.decision_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
