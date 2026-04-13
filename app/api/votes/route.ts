// PREREQ: Create votes table in Supabase:
// CREATE TABLE votes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, post_id uuid REFERENCES posts(id), wallet_hash text NOT NULL, vote_type text CHECK (vote_type IN ('up','down')), created_at timestamptz DEFAULT now(), UNIQUE(post_id, wallet_hash));

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  let body: { post_id?: string; vote_type?: string; session_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { post_id, vote_type, session_token } = body;

  if (!post_id || !vote_type || !session_token) {
    return NextResponse.json({ error: 'post_id, vote_type, session_token required' }, { status: 400 });
  }
  if (vote_type !== 'up' && vote_type !== 'down') {
    return NextResponse.json({ error: 'vote_type must be up or down' }, { status: 400 });
  }

  // Verify session — get user_id
  let userId: string;
  try {
    userId = verifySession(session_token);
  } catch {
    return NextResponse.json({ error: 'invalid or expired session' }, { status: 401 });
  }

  const supabase = serverSupabase();

  // Look up user's wallet_hash from users table
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('wallet_hash')
    .eq('id', userId)
    .single();

  if (userErr || !userRow) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 });
  }
  const wallet_hash = userRow.wallet_hash as string;

  // Check existing vote on this post
  const { data: existing, error: fetchErr } = await supabase
    .from('votes')
    .select('id, vote_type')
    .eq('post_id', post_id)
    .eq('wallet_hash', wallet_hash)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const voteCol = vote_type === 'up' ? 'confirms' : 'disputes';

  // Same direction — toggle off (remove vote)
  if (existing && existing.vote_type === vote_type) {
    const { error: delErr } = await supabase
      .from('votes')
      .delete()
      .eq('id', existing.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    // Decrement count
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select(`${voteCol}`)
      .eq('id', post_id)
      .single();
    if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });

    const newVal = Math.max(0, ((post as Record<string, number>)[voteCol] ?? 1) - 1);
    await supabase.from('posts').update({ [voteCol]: newVal }).eq('id', post_id);

    return NextResponse.json({ ok: true, new_count: newVal, user_vote: null });
  }

  // Opposite direction — reject with 409
  if (existing && existing.vote_type !== vote_type) {
    return NextResponse.json({ error: 'already voted opposite direction', user_vote: existing.vote_type }, { status: 409 });
  }

  // New vote — insert and increment
  const { error: insErr } = await supabase
    .from('votes')
    .insert([{ post_id, wallet_hash, vote_type }]);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select(`${voteCol}`)
    .eq('id', post_id)
    .single();
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });

  const newVal = ((post as Record<string, number>)[voteCol] ?? 0) + 1;
  await supabase.from('posts').update({ [voteCol]: newVal }).eq('id', post_id);

  return NextResponse.json({ ok: true, new_count: newVal, user_vote: vote_type });
}
