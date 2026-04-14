import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron: runs at 09:00 UTC daily (configured in vercel.json)
// Neynar API: https://docs.neynar.com/reference/publish-cast

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://katabased.io';
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const CRON_SECRET = process.env.CRON_SECRET;

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

async function getUncastPost() {
  const supabase = serviceSupabase();
  // Get posts that haven't been cast yet (no cast_at timestamp)
  const { data } = await supabase
    .from('posts')
    .select('id, company_name, title, content')
    .is('cast_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return null;
  // Pick the most recent uncast post
  return data[0];
}

async function markAsCast(postId: string) {
  const supabase = serviceSupabase();
  await supabase
    .from('posts')
    .update({ cast_at: new Date().toISOString() })
    .eq('id', postId);
}

const TRANSMISSION_TEMPLATES = [
  (company: string, title: string) =>
    `INTERCEPTED: ${company} insider on what it actually looks like inside.\n\n"${title}"\n\nAnonymous. Verified. Another descent logged. ↓`,
  (company: string, title: string) =>
    `New signal from inside ${company}. Someone finally wrote it down.\n\n"${title}"\n\nReview filed anonymously. ↓`,
  (company: string, title: string) =>
    `${company}, from the inside. An anonymous transmission.\n\n"${title}"\n\nFull context below.`,
  (company: string, title: string) =>
    `Someone at ${company} put it in writing.\n\n"${title}"\n\nToday's descent. →`,
  (company: string, title: string) =>
    `${company}. ${title}.\n\nAnonymous insider. On-chain identity. kataBased. ↓`,
];

function buildCastText(company: string, title: string): string {
  const template = TRANSMISSION_TEMPLATES[Math.floor(Math.random() * TRANSMISSION_TEMPLATES.length)];
  const text = template(company, title);
  // Farcaster cast limit: 320 chars
  return text.slice(0, 316);
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets Authorization: Bearer <CRON_SECRET>)
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
    return NextResponse.json({ error: 'NEYNAR_API_KEY and NEYNAR_SIGNER_UUID required' }, { status: 500 });
  }

  const post = await getUncastPost();
  if (!post) {
    return NextResponse.json({ ok: false, reason: 'no uncast posts' });
  }

  const castText = buildCastText(post.company_name, post.title);
  const frameUrl = `${BASE_URL}/api/frame/daily`;

  // Post cast via Neynar
  const neynarRes = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_key': NEYNAR_API_KEY,
    },
    body: JSON.stringify({
      signer_uuid: NEYNAR_SIGNER_UUID,
      text: castText,
      embeds: [{ url: frameUrl }],
    }),
  });

  if (!neynarRes.ok) {
    const err = await neynarRes.text();
    return NextResponse.json({ error: 'neynar cast failed', detail: err }, { status: 500 });
  }

  const cast = await neynarRes.json();
  await markAsCast(post.id);

  return NextResponse.json({
    ok: true,
    cast_hash: cast?.cast?.hash,
    post_id: post.id,
    company: post.company_name,
  });
}
