'use server';

import { createHmac, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { buildSignMessage } from '@/lib/siwe';
import { signSession, verifySession as _verifySession } from '@/lib/session';

// ─── Server-only Supabase client ───────────────────────────────────────────────
function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

// ─── Wallet ownership proof ────────────────────────────────────────────────────
async function verifyWalletSignature(address: string, signature: string): Promise<void> {
  // Accept current window OR previous window (handles clock skew at boundary).
  // Window is 2 minutes (120_000ms) — matches siwe.ts buildSignMessage.
  const now = Math.floor(Date.now() / 120_000);
  for (const w of [now, now - 1]) {
    const message = buildSignMessage(address, w);
    try {
      const valid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      if (valid) return; // signature checks out
    } catch {
      // verifyMessage throws on malformed sig — continue to next window
    }
  }

  throw new Error('Signature verification failed — sign the message with your wallet');
}

// ─── HMAC wallet hash ──────────────────────────────────────────────────────────
// One-way: cannot recover address from hash, even with the full users table.
function hashWallet(address: string): string {
  const secret = process.env.WALLET_HASH_SECRET;
  if (!secret) throw new Error('WALLET_HASH_SECRET env var is not set');
  return createHmac('sha256', secret).update(address.toLowerCase()).digest('hex');
}

function generateUsername(): string {
  return `anon_${randomBytes(4).toString('hex')}`;
}

// ─── Auth actions ──────────────────────────────────────────────────────────────
export async function getOrCreateUser(walletAddress: string, signature: string): Promise<{ user: ReturnType<typeof Object.assign>; sessionToken: string }> {
  await verifyWalletSignature(walletAddress, signature);

  const supabase = serverSupabase();
  const walletHash = hashWallet(walletAddress);

  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_hash', walletHash)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const user = existing ?? await (async () => {
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ wallet_hash: walletHash, username: generateUsername() }])
      .select()
      .single();
    if (insertError) throw insertError;
    return newUser;
  })();

  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const sessionToken = signSession(user.id, exp);
  return { user, sessionToken };
}

export async function updateUsername(sessionToken: string, newUsername: string) {
  const userId = _verifySession(sessionToken);

  // Strip HTML before validation — defence-in-depth even though the regex below
  // already blocks tag characters. Username max 50 chars per security policy.
  const trimmed = newUsername.replace(/<[^>]*>/g, '').trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 50) {
    throw new Error('Username must be 3–50 characters');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('Username may only contain letters, numbers, _ and -');
  }

  const supabase = serverSupabase();

  const { data, error } = await supabase
    .from('users')
    .update({ username: trimmed })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Username already taken');
    throw error;
  }
  return data;
}
