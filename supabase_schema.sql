-- kataBased — full schema
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste + run

-- ─── Users table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_hash  TEXT        NOT NULL UNIQUE,
  username     TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_wallet_hash_idx ON public.users (wallet_hash);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Public can read usernames (needed for leaderboard/post attribution)
CREATE POLICY "users_select_public" ON public.users
  FOR SELECT USING (true);

-- Service role only for insert/update (auth.ts uses service role key)
CREATE POLICY "users_insert_service" ON public.users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_service" ON public.users
  FOR UPDATE USING (true) WITH CHECK (true);

-- ─── Posts table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL CHECK (length(trim(title)) > 0),
  content      TEXT        NOT NULL CHECK (length(trim(content)) > 0),
  category     TEXT        NOT NULL DEFAULT 'company_review'
                           CHECK (category IN ('general', 'company_review', 'role_review')),
  company_name TEXT,
  confirms     INTEGER     NOT NULL DEFAULT 0,
  disputes     INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_company_name_idx ON public.posts (company_name);
CREATE INDEX IF NOT EXISTS posts_created_at_idx   ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_id_idx      ON public.posts (user_id);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_public" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_open" ON public.posts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "posts_update_votes" ON public.posts
  FOR UPDATE USING (true) WITH CHECK (true);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
