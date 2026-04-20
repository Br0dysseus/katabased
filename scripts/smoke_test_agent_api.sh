#!/usr/bin/env bash
# kataBased agent API smoke test
# Run AFTER supabase_migration_onchain.sql has been applied.
#
# Usage:
#   bash scripts/smoke_test_agent_api.sh [base_url]
#   base_url defaults to http://localhost:3001

set -euo pipefail

BASE="${1:-http://localhost:3001}"
SB_URL="https://shhodgzbgwzbatqgncab.supabase.co"
SB_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)}"

echo "────────────────────────────────────────────"
echo " kataBased agent API smoke test"
echo " Target: $BASE"
echo "────────────────────────────────────────────"

# ── 1. Seed a test key via JS client (supports sb_secret key format) ──────────
echo ""
echo "1. Creating test API key in Supabase..."
SEED_OUT=$(node scripts/seed_test_key.mjs 2>&1)
if echo "$SEED_OUT" | grep -q "^RAW_KEY="; then
  RAW_KEY=$(echo "$SEED_OUT" | grep "^RAW_KEY=" | cut -d= -f2)
  KEY_HASH=$(echo "$SEED_OUT" | grep "^KEY_HASH=" | cut -d= -f2)
  echo "   ✓ Key created (hash: ${KEY_HASH:0:12}...)"
else
  echo "   ✗ Seed failed: $SEED_OUT"
  echo "   → Run supabase_migration_onchain.sql first, then retry."
  exit 1
fi

# ── 2. Missing key → 401 ──────────────────────────────────────────────────────
echo ""
echo "2. No key → expect 401..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/agent/post" \
  -H "Content-Type: application/json" \
  -d '{"company":"ACME","title":"Test","content":"Content"}')
[[ "$STATUS" == "401" ]] && echo "   ✓ 401 as expected" || echo "   ✗ Got $STATUS (expected 401)"

# ── 3. Bad key → 401 ──────────────────────────────────────────────────────────
echo ""
echo "3. Wrong key → expect 401..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/agent/post" \
  -H "Content-Type: application/json" \
  -H "X-KB-Key: kb_bad_key_000" \
  -d '{"company":"ACME","title":"Test","content":"Content"}')
[[ "$STATUS" == "401" ]] && echo "   ✓ 401 as expected" || echo "   ✗ Got $STATUS (expected 401)"

# ── 4. Valid key, missing fields → 400 ───────────────────────────────────────
echo ""
echo "4. Valid key, missing content → expect 400..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/agent/post" \
  -H "Content-Type: application/json" \
  -H "X-KB-Key: $RAW_KEY" \
  -d '{"company":"ACME","title":"Test"}')
[[ "$STATUS" == "400" ]] && echo "   ✓ 400 as expected" || echo "   ✗ Got $STATUS (expected 400)"

# ── 5. XSS payload → stripped or 400 ─────────────────────────────────────────
echo ""
echo "5. XSS in company field → expect 400 (invalid chars)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/agent/post" \
  -H "Content-Type: application/json" \
  -H "X-KB-Key: $RAW_KEY" \
  -d '{"company":"<script>alert(1)</script>","title":"T","content":"C"}')
[[ "$STATUS" == "400" ]] && echo "   ✓ 400 as expected" || echo "   ✗ Got $STATUS (expected 400)"

# ── 6. Valid post → 200 ───────────────────────────────────────────────────────
echo ""
echo "6. Valid post → expect 200 with post_id..."
BODY=$(curl -s -X POST "$BASE/api/agent/post" \
  -H "Content-Type: application/json" \
  -H "X-KB-Key: $RAW_KEY" \
  -d '{"company":"Smoke Corp","title":"Internal systems are broken","content":"Multiple outages this quarter, leadership unresponsive. Morale is at floor level.","category":"company_review"}')
STATUS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('200' if d.get('ok') else 'FAIL')" 2>/dev/null || echo "FAIL")
POST_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('post_id','?'))" 2>/dev/null || echo "?")
[[ "$STATUS" == "200" ]] && echo "   ✓ Post created: $POST_ID" || echo "   ✗ Response: $BODY"

# ── 7. Rate limit: exhaust agent tier (20/day) ────────────────────────────────
echo ""
echo "7. Rate limit enforcement — skipped in smoke test (would consume quota)"
echo "   To test: send 21 requests, verify 20th succeeds and 21st returns 429."

# ── Cleanup: delete test key via JS ──────────────────────────────────────────
echo ""
echo "Cleaning up test key..."
node -e "
import('@supabase/supabase-js').then(({createClient}) => {
  const fs = await import('fs');
  const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const[k,...v]=l.split('=');return[k.trim(),v.join('=').trim()]}));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return sb.from('api_keys').delete().eq('key_hash','$KEY_HASH');
}).then(()=>console.log('   Done.')).catch(e=>console.log('   Cleanup error:',e.message));
" 2>/dev/null || echo "   Done (cleanup skipped)."

echo ""
echo "────────────────────────────────────────────"
echo " Smoke test complete."
echo "────────────────────────────────────────────"
