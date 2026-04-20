import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const RATE_LIMIT_GENERATE = 50; // generates per day per key (no DB write, so higher)

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

// POST /api/agent/generate
// Body: { company: string, focus?: string, style?: 'neutral' | 'positive' | 'negative' | 'mixed' }
// Returns: { title, content, category, company }
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

  // ── Rate limit ────────────────────────────────────────────────────────────
  // Generate counts against the same daily budget as posting
  const TIER_LIMITS: Record<string, number> = { free: 5, agent: 20, agent_pro: 100 };
  const tier: string = keyRow.tier ?? 'free';
  const dailyLimit = (TIER_LIMITS[tier] ?? 5) + RATE_LIMIT_GENERATE;
  if ((keyRow.requests_today ?? 0) >= dailyLimit) {
    return NextResponse.json({ error: 'daily limit reached', tier }, { status: 429 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { company?: string; focus?: string; style?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { company, focus, style = 'mixed' } = body;

  if (!company || typeof company !== 'string' || company.trim().length === 0) {
    return NextResponse.json({ error: 'company is required' }, { status: 400 });
  }
  if (company.length > 100) {
    return NextResponse.json({ error: 'company max 100 chars' }, { status: 400 });
  }

  const validStyles = ['neutral', 'positive', 'negative', 'mixed'];
  const safeStyle = validStyles.includes(style) ? style : 'mixed';

  // ── Generate ──────────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'generation unavailable' }, { status: 503 });
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `Anonymous insider venting — a leak, not a review. You worked there. You saw something. Now you're typing it out.

Tone: burnt-out, specific, maybe bitter, maybe darkly funny. NOT balanced. NOT professional. A person, not a report.

Hard rules:
- No opener like "As a [role]..." or "I've been working at..." — dead giveaway of AI. Drop straight into the thing.
- One incident, one decision, one moment — specific. Not "leadership was chaotic." Instead: "the CTO announced the pivot in a Zoom call with 4 hours notice. token holders found out via an airdrop that wasn't in any doc."
- Crypto vocabulary where natural: multisig drama, sequencer downtime, Sybil filters, token unlock cliff, DAO quorum fail, audit delay, points meta, grant farming, ve-lock, LBP, devrel theater.
- Pick ONE emotional register and commit: exhausted cynicism, genuine anger, dark humor, quiet disillusionment. Don't blend them into neutrality.
- Specific beats vague every time. Real numbers, real timelines, real roles (unnamed), real decisions.
- Short. 80–200 words. Fragments fine. Paragraphs can be 1–2 sentences.
- Title: 3–8 words. Lowercase. Reads like a Telegram message subject, not a headline. Avoid: "honest review", "my experience", "mixed bag", "pros and cons".
- Category: one of 'company_review', 'role_review', 'general'
- Output valid JSON only: {"title": "...", "content": "...", "category": "..."}`

  const userPrompt = `Write a ${safeStyle} anonymous insider review for ${company.trim()}${focus ? `. Focus on: ${focus}` : ''}.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

  let parsed: { title?: string; content?: string; category?: string };
  try {
    // Extract JSON even if Claude wraps it in markdown
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? rawText);
  } catch {
    return NextResponse.json({ error: 'generation failed — bad model output' }, { status: 500 });
  }

  if (!parsed.title || !parsed.content) {
    return NextResponse.json({ error: 'generation failed — incomplete output' }, { status: 500 });
  }

  return NextResponse.json({
    company: company.trim(),
    title: parsed.title,
    content: parsed.content,
    category: parsed.category ?? 'company_review',
  });
}
