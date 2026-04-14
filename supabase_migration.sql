-- kataBased — posts table migration
-- Run this in the Supabase SQL editor:
-- Dashboard → SQL Editor → New query → paste + run

-- ─── Posts table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL CHECK (length(trim(title)) > 0),
  content      TEXT        NOT NULL CHECK (length(trim(content)) > 0),
  category     TEXT        NOT NULL DEFAULT 'company_review'
                           CHECK (category IN ('general', 'company_review', 'role_review')),
  company_name TEXT,
  upvotes      INTEGER     NOT NULL DEFAULT 0,
  downvotes    INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS posts_company_name_idx ON public.posts (company_name);
CREATE INDEX IF NOT EXISTS posts_created_at_idx   ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_id_idx      ON public.posts (user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read posts (public feed)
CREATE POLICY "posts_select_public" ON public.posts
  FOR SELECT USING (true);

-- Anyone can insert posts (MVP — tighten with proper auth later)
CREATE POLICY "posts_insert_open" ON public.posts
  FOR INSERT WITH CHECK (true);

-- Anyone can update vote counts (for upvote/downvote)
CREATE POLICY "posts_update_votes" ON public.posts
  FOR UPDATE USING (true) WITH CHECK (true);

-- ─── Week 1-2 additions ──────────────────────────────────────────────────────
-- Run these if upgrading an existing deployment:

-- Seed key auditing (api_keys table)
-- ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS source text;
-- ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Farcaster cron tracking (posts table)
-- ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS cast_at TIMESTAMPTZ;

-- Batch-revoke seed keys after seeding:
-- UPDATE api_keys SET active = false WHERE source = 'seed_endpoint';

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
