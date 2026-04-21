'use server';

import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';
import { timeAgo } from '@/lib/posts';
import type { FeedPost } from '@/lib/posts';

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

// ─── Input sanitization ────────────────────────────────────────────────────────
// Strip HTML tags and trim whitespace. Prevents stored-XSS if content ever
// renders in a non-React context (emails, mobile apps, third-party integrations).
function sanitizeContent(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

// biome-ignore lint: supabase returns untyped rows
function normalizePost(p: Record<string, unknown> & { users?: { username?: string } }): FeedPost {
  return {
    id: String(p.id),
    author: p.users?.username ?? 'anon_unknown',
    entity: (p.company_name as string) ?? '—',
    title: p.title as string,
    content: p.content as string,
    confirms: (p.confirms as number) ?? 0,
    disputes: (p.disputes as number) ?? 0,
    replies: 0,
    time: timeAgo(p.created_at as string),
  };
}

export async function createVote(
  sessionToken: string,
  post_id: string,
  vote_type: 'up' | 'down',
): Promise<{ ok: boolean; new_count: number; user_vote: string | null }> {
  const userId = verifySession(sessionToken);
  const supabase = serverSupabase();

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('wallet_hash')
    .eq('id', userId)
    .single();

  if (userErr || !userRow) throw new Error('user not found');
  const wallet_hash = (userRow as { wallet_hash: string }).wallet_hash;

  const { data: existing, error: fetchErr } = await supabase
    .from('votes')
    .select('id, vote_type')
    .eq('post_id', post_id)
    .eq('wallet_hash', wallet_hash)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  const voteCol = vote_type === 'up' ? 'confirms' : 'disputes';

  // Toggle off (same direction)
  if (existing && (existing as { vote_type: string }).vote_type === vote_type) {
    const { error: delErr } = await supabase.from('votes').delete().eq('id', (existing as { id: string }).id);
    if (delErr) throw delErr;
    const { data: post } = await supabase.from('posts').select(voteCol).eq('id', post_id).single();
    const newVal = Math.max(0, ((post as Record<string, number>)[voteCol] ?? 1) - 1);
    await supabase.from('posts').update({ [voteCol]: newVal }).eq('id', post_id);
    return { ok: true, new_count: newVal, user_vote: null };
  }

  // Opposite direction — reject
  if (existing && (existing as { vote_type: string }).vote_type !== vote_type) {
    throw new Error('already voted opposite direction');
  }

  // New vote — insert and increment
  const { error: insErr } = await supabase.from('votes').insert([{ post_id, wallet_hash, vote_type }]);
  if (insErr) throw insErr;
  const { data: post } = await supabase.from('posts').select(voteCol).eq('id', post_id).single();
  const newVal = ((post as Record<string, number>)[voteCol] ?? 0) + 1;
  await supabase.from('posts').update({ [voteCol]: newVal }).eq('id', post_id);
  return { ok: true, new_count: newVal, user_vote: vote_type };
}

export async function createPost(
  sessionToken: string,
  title: string,
  content: string,
  entityName: string,
): Promise<{ post?: FeedPost; error?: string }> {
  // Server actions obscure raw error messages in prod (Next.js digest wrapping).
  // Return errors as data so the client sees the actual blocker.
  try {
    const userId = verifySession(sessionToken);

    const trimmedTitle = sanitizeContent(title);
    const trimmedContent = sanitizeContent(content);
    const trimmedEntity = sanitizeContent(entityName);

    if (!trimmedTitle || trimmedTitle.length > 120) return { error: 'Title must be 1–120 characters' };
    if (!trimmedContent || trimmedContent.length > 2000) return { error: 'Content must be 1–2000 characters' };
    if (trimmedEntity.length > 100) return { error: 'Entity name must be ≤ 100 characters' };

    const supabase = serverSupabase();

    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error: countError } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);

    if (countError) return { error: `Rate-check failed: ${countError.message} (code ${countError.code})` };
    if ((count ?? 0) >= 5) return { error: 'Rate limit: max 5 transmissions per hour' };

    // Note: omit `category` so Supabase uses the column default — the
    // posts_category_check constraint rejected our prior 'transmission' literal.
    const { data, error } = await supabase
      .from('posts')
      .insert([{
        user_id: userId,
        title: trimmedTitle,
        content: trimmedContent,
        company_name: trimmedEntity || null,
        confirms: 0,
        disputes: 0,
      }])
      .select('*, users(username)')
      .single();

    if (error) return { error: `DB insert failed: ${error.message} (code ${error.code})` };
    return { post: normalizePost(data) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
