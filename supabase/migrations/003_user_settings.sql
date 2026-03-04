-- ============================================================
-- 003_user_settings.sql  –  Per-user persistent settings
-- ============================================================
-- Stores focus, weekly time budget, and equipment flags.
-- One row per user; upserted on save.
-- ============================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users DEFAULT auth.uid(),
  focus        text        NOT NULL DEFAULT 'triathlon',
  weekly_minutes int       NOT NULL DEFAULT 600,
  equipment    jsonb       NOT NULL DEFAULT '{"gym":true,"trainer":true,"pool":true,"outdoorRun":true}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Auto-update updated_at ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_delete" ON public.user_settings;

CREATE POLICY "user_settings_select" ON public.user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user_settings_insert" ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_settings_update" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_settings_delete" ON public.user_settings
  FOR DELETE TO authenticated USING (user_id = auth.uid());
