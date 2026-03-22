-- ============================================================
-- BULLION DESK — Migration SQL complète
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Table users ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  trading_horizon TEXT DEFAULT 'daytrade',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"  ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Service role bypasses RLS by default — no policy needed.

-- ── 2. Table ai_analyses ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mode          TEXT,
  analysis_mode TEXT,
  decision      TEXT,
  summary       TEXT,
  trade_taken   BOOLEAN,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for profile history queries
CREATE INDEX IF NOT EXISTS ai_analyses_user_id_idx ON public.ai_analyses(user_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses"   ON public.ai_analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON public.ai_analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON public.ai_analyses;

CREATE POLICY "Users can view own analyses"
  ON public.ai_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON public.ai_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON public.ai_analyses FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 3. Table push_subscriptions ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription  JSONB NOT NULL,
  scalp_alerts  BOOLEAN DEFAULT TRUE,
  swing_alerts  BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT push_subscriptions_user_id_key UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Supabase Storage — bucket avatars ────────────────────
-- Crée le bucket si inexistant (ignorer l'erreur si déjà présent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Politique upload : chaque user peut uploader dans son propre dossier
DROP POLICY IF EXISTS "Avatar upload own folder" ON storage.objects;
CREATE POLICY "Avatar upload own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Avatar update own folder" ON storage.objects;
CREATE POLICY "Avatar update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
CREATE POLICY "Avatar public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');
