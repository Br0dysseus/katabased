import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { verifySession } from '@/lib/session';

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  let body: { session_token?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { session_token, name } = body;

  if (!session_token) {
    return NextResponse.json({ error: 'session_token required' }, { status: 400 });
  }

  // Verify session
  let userId: string;
  try {
    userId = verifySession(session_token);
  } catch {
    return NextResponse.json({ error: 'invalid or expired session' }, { status: 401 });
  }

  const supabase = serviceSupabase();

  // Look up wallet_hash
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('wallet_hash')
    .eq('id', userId)
    .single();

  if (userErr || !userRow) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 });
  }
  const wallet_hash = userRow.wallet_hash as string;

  // Generate key: kb_ + 32 random bytes as hex = kb_ + 64 hex chars
  const rawBytes = randomBytes(32);
  const rawKey = 'kb_' + rawBytes.toString('hex');

  // Hash for storage — never store rawKey
  const key_hash = createHash('sha256').update(rawKey).digest('hex');

  const { error: insErr } = await supabase.from('api_keys').insert([
    {
      key_hash,
      name: name ?? null,
      owner_wallet_hash: wallet_hash,
      tier: 'free',
    },
  ]);

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Return raw key exactly once — user must save it
  return NextResponse.json({
    ok: true,
    key: rawKey,
    message: 'Save this key — it will not be shown again.',
  });
}
