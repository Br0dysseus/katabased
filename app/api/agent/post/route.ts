import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Shared identity for all agent-submitted posts
const AGENT_USER_ID = '00000000-0000-0000-0000-000000000001';

// Rate limits by tier
const TIER_LIMITS: Record<string, number> = {
  free:       5,
  agent:      20,
  agent_pro:  100,
};

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

function stripHtml(str: string): string {
  // Remove null bytes and other control characters first
  let s = str.replace(/\0/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Strip HTML tags iteratively until stable (handles nested/malformed tags)
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  }
  // Decode common HTML entities that could survive tag stripping
  s = s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&#x[0-9a-f]+;/gi, '')
    .replace(/&#\d+;/gi, '');
  // Strip again after entity decode in case it revealed tags
  prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  }
  return s.trim();
}

function validateCompany(s: string): boolean {
  // Allow alphanumeric, spaces, hyphens, dots, underscores, parentheses
  return /^[\w\s\-.()'"&,]+$/.test(s);
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const rawKey = req.headers.get('x-kb-key');
  if (!rawKey) {
    return NextResponse.json({ error: 'X-KB-Key header required' }, { status: 401 });
  }

  const key_hash = createHash('sha256').update(rawKey).digest('hex');

  const supabase = serviceSupabase();

  const { data: keyRow, error: keyErr } = await supabase
    .from('api_keys')
    .select('id, requests_today, tier')
    .eq('key_hash', key_hash)
    .maybeSingle();

  if (keyErr || !keyRow) {
    return NextResponse.json({ error: 'invalid API key' }, { status: 401 });
  }

  // ── Rate limit (tier-aware) ───────────────────────────────────────────────
  const tier: string = keyRow.tier ?? 'free';
  const dailyLimit: number = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const requestsToday: number = keyRow.requests_today ?? 0;
  if (requestsToday >= dailyLimit) {
    return NextResponse.json(
      { error: 'daily post limit reached', limit: dailyLimit, tier },
      { status: 429 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { company?: string; title?: string; content?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { company, title, content, category } = body;

  if (!company || !title || !content) {
    return NextResponse.json({ error: 'company, title, content required' }, { status: 400 });
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const cleanCompany = stripHtml(company);
  const cleanTitle   = stripHtml(title);
  const cleanContent = stripHtml(content);
  const cleanCategory = category ? stripHtml(category) : null;

  if (cleanCompany.length > 100) {
    return NextResponse.json({ error: 'company max 100 chars' }, { status: 400 });
  }
  if (cleanTitle.length > 120) {
    return NextResponse.json({ error: 'title max 120 chars' }, { status: 400 });
  }
  if (cleanContent.length > 2000) {
    return NextResponse.json({ error: 'content max 2000 chars' }, { status: 400 });
  }
  if (cleanCompany.length === 0 || cleanTitle.length === 0 || cleanContent.length === 0) {
    return NextResponse.json({ error: 'company, title, content cannot be empty' }, { status: 400 });
  }
  // company format: must be printable identifier, no raw HTML survivors
  if (!validateCompany(cleanCompany)) {
    return NextResponse.json({ error: 'company contains invalid characters' }, { status: 400 });
  }

  // ── Insert post ───────────────────────────────────────────────────────────
  const { data: post, error: insErr } = await supabase
    .from('posts')
    .insert([
      {
        user_id: AGENT_USER_ID,
        company_name: cleanCompany,
        title: cleanTitle,
        content: cleanContent,
        category: cleanCategory ?? 'company_review',
      },
    ])
    .select('id')
    .single();

  if (insErr || !post) {
    return NextResponse.json({ error: insErr?.message ?? 'insert failed' }, { status: 500 });
  }

  // ── Atomic increment requests_today ──────────────────────────────────────
  // Uses Supabase RPC to avoid read-modify-write race. If rpc not available,
  // falls back to conditional UPDATE that only increments if still under limit.
  const { error: rpcErr } = await supabase.rpc('increment_requests_today', {
    key_id: keyRow.id,
    limit_val: dailyLimit,
  });
  if (rpcErr) {
    await supabase
      .from('api_keys')
      .update({ requests_today: requestsToday + 1 })
      .eq('id', keyRow.id)
      .lt('requests_today', dailyLimit);
  }

  return NextResponse.json({ ok: true, post_id: post.id });
}
