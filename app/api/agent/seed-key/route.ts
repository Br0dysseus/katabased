import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// ── Kill switch ────────────────────────────────────────────────────────────
// Set SEED_ENDPOINT_ENABLED=true in Vercel env only during seeding window.
// Remove/set false after. Returns 404 — doesn't reveal endpoint exists.
if (process.env.SEED_ENDPOINT_ENABLED !== 'true') {
  // Module-level check: any request to this route returns 404 when disabled.
  // Next.js evaluates this at runtime per request in edge/serverless.
}

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

// Constant-time comparison — prevents timing oracle on SEED_SECRET
function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a.padEnd(128).slice(0, 128), 'utf8');
  const bBuf = Buffer.from(b.padEnd(128).slice(0, 128), 'utf8');
  return timingSafeEqual(aBuf, bBuf) && a.length === b.length;
}

export async function POST(req: NextRequest) {
  // ── Kill switch ─────────────────────────────────────────────────────────
  if (process.env.SEED_ENDPOINT_ENABLED !== 'true') {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const incoming = req.headers.get('x-seed-secret') ?? '';
  const expected = process.env.SEED_SECRET ?? '';

  if (!expected || !safeCompare(incoming, expected)) {
    // Fixed-delay to further blunt timing attacks
    await new Promise(r => setTimeout(r, 100));
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ── Generate key ─────────────────────────────────────────────────────────
  const rawKey = `kb_seed_${randomBytes(24).toString('hex')}`;
  const key_hash = createHash('sha256').update(rawKey).digest('hex');

  const supabase = serviceSupabase();

  const { error } = await supabase.from('api_keys').insert([{
    key_hash,
    tier: 'seed',
    owner_wallet_hash: 'internal:seed',
    source: 'seed_endpoint',
    requests_today: 0,
  }]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Raw key returned once — only the hash is stored.
  // Rotate SEED_SECRET after seeding is complete.
  return NextResponse.json({ key: rawKey, tier: 'seed' });
}
