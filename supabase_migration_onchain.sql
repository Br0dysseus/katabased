-- kataBased — on-chain fields + agent API migration
-- Run in Supabase: Dashboard → SQL Editor → New query → paste + run
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS guards

-- ─── API keys table (agent POST endpoint auth) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash          TEXT        NOT NULL UNIQUE,       -- SHA-256 of raw key
  tier              TEXT        NOT NULL DEFAULT 'free'
                                CHECK (tier IN ('free','agent','agent_pro','seed')),
  owner_wallet_hash TEXT,                              -- wallet hash of key owner (NULL = internal)
  source            TEXT,                              -- 'seed_endpoint', 'dashboard', etc.
  active            BOOLEAN     NOT NULL DEFAULT true,
  requests_today    INTEGER     NOT NULL DEFAULT 0,
  last_reset_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys (key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write api_keys
CREATE POLICY "api_keys_service_only" ON public.api_keys
  FOR ALL USING (false) WITH CHECK (false);

-- ─── RPC: increment_requests_today (atomic, race-safe) ────────────────────────
CREATE OR REPLACE FUNCTION public.increment_requests_today(key_id UUID, limit_val INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.api_keys
  SET
    requests_today  = CASE
                        WHEN last_reset_date < CURRENT_DATE THEN 1
                        ELSE requests_today + 1
                      END,
    last_reset_date = CURRENT_DATE
  WHERE id = key_id
    AND (last_reset_date < CURRENT_DATE OR requests_today < limit_val);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Extend posts with on-chain fields ───────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS chain_post_id  TEXT,        -- bytes32 post ID on-chain (hex, 0x-prefixed)
  ADD COLUMN IF NOT EXISTS content_hash  TEXT,        -- keccak256 of content (hex, 0x-prefixed)
  ADD COLUMN IF NOT EXISTS chain_state   TEXT         -- mirrors PostState enum: Active|Challenged|Contested|Folded|Settled|Canon
    CHECK (chain_state IS NULL OR chain_state IN ('Active','Challenged','Contested','Folded','Settled','Canon'));

CREATE UNIQUE INDEX IF NOT EXISTS posts_chain_post_id_idx ON public.posts (chain_post_id)
  WHERE chain_post_id IS NOT NULL;

-- ─── Challenges table ─────────────────────────────────────────────────────────
-- One row per on-chain challenge event; updated as state transitions happen
CREATE TABLE IF NOT EXISTS public.challenges (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_post_id     TEXT        NOT NULL,              -- references posts.chain_post_id
  challenger        TEXT        NOT NULL,              -- challenger wallet address (lowercase)
  poster            TEXT        NOT NULL,              -- poster wallet address (lowercase)
  challenge_tx      TEXT,                              -- tx hash of challengePost()
  challenge_block   BIGINT,                            -- block number of challenge
  challenged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution        TEXT        CHECK (resolution IS NULL OR resolution IN ('PosterWon','ChallengerWon')),
  resolve_tx        TEXT,                              -- tx hash of resolution
  resolve_block     BIGINT,
  resolved_at       TIMESTAMPTZ,
  poster_claimed    BOOLEAN     NOT NULL DEFAULT false,
  challenger_claimed BOOLEAN   NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS challenges_chain_post_id_idx ON public.challenges (chain_post_id);
CREATE INDEX IF NOT EXISTS challenges_challenger_idx    ON public.challenges (challenger);
CREATE INDEX IF NOT EXISTS challenges_poster_idx        ON public.challenges (poster);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenges_select_public" ON public.challenges
  FOR SELECT USING (true);

CREATE POLICY "challenges_insert_service" ON public.challenges
  FOR INSERT WITH CHECK (true);

CREATE POLICY "challenges_update_service" ON public.challenges
  FOR UPDATE USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS challenges_set_updated_at ON public.challenges;
CREATE TRIGGER challenges_set_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Backings table ───────────────────────────────────────────────────────────
-- One row per BackingAdded event; records each backer + side + amount
CREATE TABLE IF NOT EXISTS public.backings (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_post_id TEXT        NOT NULL,              -- references posts.chain_post_id
  backer        TEXT        NOT NULL,              -- backer wallet address (lowercase)
  side          TEXT        NOT NULL CHECK (side IN ('poster','challenger')),
  amount_usdc   NUMERIC(18,6) NOT NULL,            -- USDC amount (6 decimals → store as decimal)
  tx_hash       TEXT        NOT NULL,
  block_number  BIGINT      NOT NULL,
  backed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backings_chain_post_id_idx ON public.backings (chain_post_id);
CREATE INDEX IF NOT EXISTS backings_backer_idx        ON public.backings (backer);
CREATE UNIQUE INDEX IF NOT EXISTS backings_tx_idx     ON public.backings (tx_hash); -- deduplicate event indexing

ALTER TABLE public.backings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backings_select_public" ON public.backings
  FOR SELECT USING (true);

CREATE POLICY "backings_insert_service" ON public.backings
  FOR INSERT WITH CHECK (true);
