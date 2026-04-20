import { NextResponse } from 'next/server';

// Vercel serverless-safe caching — no module-level state
export const revalidate = 120; // 2 min

const HL_API = 'https://api.hyperliquid.xyz/info';

// ─── News + Polymarket types ──────────────────────────────────────────────────
interface NewsItem {
  title: string;
  source: string;
  url: string;
  published?: string;
}

interface PolymarketMarket {
  question: string;
  yes_prob: number;
  volume: number;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FactorAsset {
  coin: string;
  composite_z: number;
  momentum_z?: number;
  breakout_z?: number;
  carry_z?: number;
  reversion_z?: number;
}

interface TickerSignal {
  direction: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  mentions: number;
  avg_sentiment: number;
  bull: number;
  bear: number;
  neutral: number;
}

interface MarketIntel {
  dominant_sentiment: string;
  narratives: string[];
  session_notes: string;
  avg_sentiment_score: number;
  ticker_signals: Record<string, TickerSignal>;
}

interface MegaIndexEntity {
  coin: string;
  factor_score: number;
  sentiment: string;
  mentions: number;
  signal: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
}

interface MegaIndexResponse {
  updated_at: string;
  regime: string;
  dominant_sentiment: string;
  narratives: string[];
  session_notes: string;
  entities: MegaIndexEntity[];
  top_long: string[];
  top_short: string[];
  news: NewsItem[];
  polymarket: PolymarketMarket[];
}

// ─── Regime detection from factor distribution ────────────────────────────────
function detectRegime(assets: FactorAsset[], dominant_sentiment: string): string {
  if (!assets.length) return 'choppy';

  const scores = assets.map(a => a.composite_z);
  const avgAbs = scores.reduce((s, v) => s + Math.abs(v), 0) / scores.length;
  const avgMom = assets.reduce((s, a) => s + (a.momentum_z ?? 0), 0) / assets.length;
  const avgBreak = assets.reduce((s, a) => s + (a.breakout_z ?? 0), 0) / assets.length;
  const avgCarry = assets.reduce((s, a) => s + Math.abs(a.carry_z ?? 0), 0) / assets.length;

  if (avgCarry > 1.5) return 'carry';
  if (avgBreak > 0.8 && avgMom > 0.3) return 'breakout';
  if (avgAbs > 0.6 && Math.abs(avgMom) > 0.4) return 'trending';
  if (avgAbs < 0.3) return 'mean-reversion';
  return 'choppy';
}

// ─── Signal logic ─────────────────────────────────────────────────────────────
function computeSignal(
  factorScore: number,
  sentiment: string
): { signal: 'LONG' | 'SHORT' | 'NEUTRAL'; confidence: number } {
  const sentWeight = sentiment === 'bullish' ? 0.3 : sentiment === 'bearish' ? -0.3 : 0;
  const absScore = Math.abs(factorScore);
  const confidence = Math.min(1, (absScore + Math.abs(sentWeight)) / 2);

  if (factorScore > 0.3 && sentiment === 'bullish') return { signal: 'LONG', confidence };
  if (factorScore < -0.3 && sentiment === 'bearish') return { signal: 'SHORT', confidence };
  return { signal: 'NEUTRAL', confidence };
}

// ─── Z-score helper ───────────────────────────────────────────────────────────
function zScore(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values.map(() => 0);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  if (std === 0) return values.map(() => 0);
  return values.map(v => (v - mean) / std);
}

// ─── HL public API: fetch factor scores ───────────────────────────────────────
async function fetchHLFactorScores(): Promise<FactorAsset[]> {
  try {
    const [metaRes, _midsRes] = await Promise.all([
      fetch(HL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
        next: { revalidate: 120 },
      }),
      fetch(HL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
        next: { revalidate: 120 },
      }),
    ]);

    if (!metaRes.ok) return [];
    const [universe, ctxs]: [{ name: string }[], Record<string, string>[]] = await metaRes.json();

    // Build raw arrays, filter by liquidity
    type RawAsset = { coin: string; funding: number; oi: number; vol: number };
    const raw: RawAsset[] = [];

    for (let i = 0; i < universe.length; i++) {
      const name = universe[i]?.name;
      const ctx = ctxs[i];
      if (!name || !ctx) continue;

      const funding = parseFloat(ctx.funding ?? '0');
      const oi = parseFloat(ctx.openInterest ?? '0') * parseFloat(ctx.markPx ?? '0');
      const vol = parseFloat(ctx.dayNtlVlm ?? '0');

      if (oi < 500_000 || vol < 500_000) continue;
      raw.push({ coin: name, funding, oi, vol });
    }

    if (!raw.length) return [];

    // Compute z-scores
    const carryRaw = raw.map(a => a.funding);
    const breakoutRaw = raw.map(a => (a.oi > 0 ? a.vol / a.oi : 0));

    const carryZ = zScore(carryRaw);
    const breakoutZ = zScore(breakoutRaw);

    return raw.map((a, i) => {
      const carry_z = carryZ[i];
      const breakout_z = breakoutZ[i];
      const momentum_z = 0;
      const composite_z = 0.5 * carry_z + 0.5 * breakout_z;
      return { coin: a.coin, composite_z, momentum_z, breakout_z, carry_z };
    });
  } catch {
    return [];
  }
}

// ─── Supabase: fetch latest market_intel snapshot ─────────────────────────────
async function fetchMarketIntelFromSupabase(): Promise<MarketIntel | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const endpoint = `${url}/rest/v1/market_intel_snapshots?select=data&order=created_at.desc&limit=1`;
    const res = await fetch(endpoint, {
      headers: { apikey: key },
      next: { revalidate: 120 },
    });

    if (!res.ok) return null;
    const rows: { data: MarketIntel }[] = await res.json();
    if (!rows.length) return null;
    return rows[0].data ?? null;
  } catch {
    return null;
  }
}

// ─── RSS: fetch crypto news from public feeds ─────────────────────────────────
async function fetchCryptoNews(): Promise<NewsItem[]> {
  const feeds = [
    { url: 'https://cointelegraph.com/rss', source: 'CT' },
    { url: 'https://decrypt.co/feed', source: 'DECRYPT' },
    { url: 'https://www.theblock.co/rss.xml', source: 'THEBLOCK' },
  ];

  const results: NewsItem[] = [];

  await Promise.allSettled(
    feeds.map(async ({ url, source }) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; kataBased/1.0)' },
          next: { revalidate: 300 }, // 5 min
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const text = await res.text();

        // Parse <item> blocks — simple regex, no DOM
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
        let itemMatch: RegExpExecArray | null;
        let count = 0;
        while (count < 2 && (itemMatch = itemRegex.exec(text)) !== null) {
          const block = itemMatch[1];
          const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
          const linkMatch = block.match(/<link[^>]*>(?:<!\[CDATA\[)?(https?:\/\/[^\s<\]]+)(?:\]\]>)?<\/link>/i)
            ?? block.match(/<guid[^>]*>(?:<!\[CDATA\[)?(https?:\/\/[^\s<\]]+)(?:\]\]>)?<\/guid>/i);
          const pubMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
          const title = titleMatch?.[1]?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
          const link = linkMatch?.[1]?.trim();
          const pub = pubMatch?.[1]?.trim();
          if (title && link) {
            results.push({ title, source, url: link, published: pub });
            count++;
          }
        }
      } catch {
        // feed unreachable — skip silently
      }
    })
  );

  // Sort by published date desc, return top 5
  results.sort((a, b) => {
    const da = a.published ? new Date(a.published).getTime() : 0;
    const db = b.published ? new Date(b.published).getTime() : 0;
    return db - da;
  });

  return results.slice(0, 5);
}

// ─── Polymarket Gamma API: macro/geo/crypto prediction markets ───────────────

const POLY_EXCLUDE = [
  // Sports
  'nba','nfl','nhl','mlb','nascar','soccer','football','basketball','baseball',
  'hockey','tennis','golf','boxing','ufc','mma','wrestling','super bowl',
  'world cup','champions league','lebron','curry','mahomes','messi','ronaldo',
  'world series','stanley cup','wimbledon','masters',
  // Entertainment / celebrity
  'taylor swift','beyonce','kanye','drake','oscar','grammy','emmy',
  'academy award','movie','album','song','artist of the year','rapper','singer',
  'miss universe','miss america','reality tv','survivor','bachelor','american idol','got talent',
  // Religious / fringe
  'jesus','christ','god','allah','rapture','second coming','apocalypse',
  'antichrist','pope','flat earth',
  // Social media noise
  'tiktok views','viral','followers','subscribers','will elon','will trump tweet',
  // Gaming / streaming
  'gta','grand theft','video game','game release','game launch',
  'fortnite','minecraft','call of duty','playstation','xbox','nintendo',
  'streaming','netflix','spotify','youtube',
  // TradFi M&A noise (low crypto signal)
  'acquisition','merger','ipo','spinoff',
  // Low-velocity geo terms
  'nato','sanctions',
  // Commodities (HL perps don't list crude/gold — cut entirely)
  'oil price','crude','brent','wti','opec','barrel',
];

// Bucket-aligned boost terms — maps to the 7 whitelisted categories
const POLY_BOOST = [
  // FED / MACRO
  'fed','fomc','rate cut','rate hike','inflation','cpi','gdp','unemployment','recession','treasury','yield',
  // CRYPTO
  'bitcoin','btc','ethereum','eth','crypto','altcoin','defi',
  // STABLECOIN / REGULATION (highest-volatility catalyst)
  'tether','usdc','stablecoin','sec','gensler','etf approval','stablecoin bill','crypto regulation',
  // TRUMP / US POLICY
  'trump','tariff','executive order','trade war','trade deal',
  // GEOPOLITICS
  'china','taiwan','russia','export controls','chip ban','war','conflict',
  // IRAN / MIDDLE EAST
  'iran','israel','middle east',
  // AI / TECH (moves TAO, VIRTUAL, RENDER etc.)
  'artificial intelligence','compute','training run','model release','deepseek','openai','nvidia','gpu',
];

function parsePolyMarket(m: Record<string, unknown>): PolymarketMarket {
  let yes_prob = 0;
  try {
    const prices = typeof m.outcomePrices === 'string'
      ? JSON.parse(m.outcomePrices as string)
      : m.outcomePrices;
    yes_prob = Math.round(parseFloat((prices as string[])?.[0] ?? '0') * 100);
  } catch { yes_prob = 0; }
  const volume = Math.round(parseFloat(String(m.volumeNum ?? m.volume ?? '0')));
  return { question: m.question as string, yes_prob, volume };
}

async function fetchPolymarketCrypto(): Promise<PolymarketMarket[]> {
  // tag_slug doesn't reliably filter — Polymarket returns trending markets regardless.
  // Fetch a large batch then WHITELIST: only keep markets containing a POLY_BOOST term.
  const opts = {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 } as { revalidate: number },
    signal: AbortSignal.timeout(6000),
  };

  try {
    // Fetch top 200 markets by volume across a few broad tags for coverage
    const responses = await Promise.allSettled([
      fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=100&order=volume&ascending=false', opts).then(r => r.ok ? r.json() : []),
      fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=100&offset=100&order=volume&ascending=false', opts).then(r => r.ok ? r.json() : []),
    ]);

    // Collect, deduplicate
    const seen = new Set<string>();
    const all: Record<string, unknown>[] = [];

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      const arr = result.value as Record<string, unknown>[];
      if (!Array.isArray(arr)) continue;
      for (const m of arr) {
        const id = String(m.id ?? m.conditionId ?? m.question ?? '');
        if (!id || seen.has(id)) continue;
        if (!m.question || (!m.outcomePrices && !m.bestAsk)) continue;
        seen.add(id);
        all.push(m);
      }
    }

    // WHITELIST: must contain at least one boost term (our 7 buckets)
    // Then BLACKLIST: exclude anything in POLY_EXCLUDE
    const filtered = all.filter(m => {
      const q = String(m.question).toLowerCase();
      const hasBoost = POLY_BOOST.some(kw => q.includes(kw));
      const isExcluded = POLY_EXCLUDE.some(kw => q.includes(kw));
      return hasBoost && !isExcluded;
    });

    // Sort by boosted volume desc
    filtered.sort((a, b) => {
      const volA = parseFloat(String(a.volumeNum ?? a.volume ?? '0'));
      const volB = parseFloat(String(b.volumeNum ?? b.volume ?? '0'));
      const qA = String(a.question).toLowerCase();
      const qB = String(b.question).toLowerCase();
      const boostA = POLY_BOOST.some(kw => qA.includes(kw)) ? 2 : 1;
      const boostB = POLY_BOOST.some(kw => qB.includes(kw)) ? 2 : 1;
      return (volB * boostB) - (volA * boostA);
    });

    return filtered.slice(0, 5).map(parsePolyMarket);
  } catch {
    return [];
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET() {
  const [factors, intel, news, polymarket] = await Promise.all([
    fetchHLFactorScores(),
    fetchMarketIntelFromSupabase(),
    fetchCryptoNews(),
    fetchPolymarketCrypto(),
  ]);

  const dominant_sentiment = intel?.dominant_sentiment ?? 'neutral';
  const narratives = intel?.narratives ?? [];
  const session_notes = intel?.session_notes ?? '';
  const ticker_signals = intel?.ticker_signals ?? {};

  // Build entity list: HL factor assets as base, overlay sentiment from market_intel
  const entityMap = new Map<string, MegaIndexEntity>();

  for (const asset of factors) {
    const tickerSig = ticker_signals[asset.coin];
    const sentiment = tickerSig?.direction === 'mixed' ? 'neutral' : (tickerSig?.direction ?? 'neutral');
    const mentions = tickerSig?.mentions ?? 0;
    const { signal, confidence } = computeSignal(asset.composite_z, sentiment);

    entityMap.set(asset.coin, {
      coin: asset.coin,
      factor_score: Math.round(asset.composite_z * 1000) / 1000,
      sentiment,
      mentions,
      signal,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  // Also add ticker_signals coins not in factor scores (sentiment-only)
  for (const [coin, sig] of Object.entries(ticker_signals)) {
    if (!entityMap.has(coin)) {
      const sentiment = sig.direction === 'mixed' ? 'neutral' : sig.direction;
      entityMap.set(coin, {
        coin,
        factor_score: 0,
        sentiment,
        mentions: sig.mentions,
        signal: 'NEUTRAL',
        confidence: 0,
      });
    }
  }

  const entities = Array.from(entityMap.values()).sort(
    (a, b) => Math.abs(b.factor_score) - Math.abs(a.factor_score)
  );

  const top_long = entities
    .filter(e => e.signal === 'LONG')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(e => e.coin);

  const top_short = entities
    .filter(e => e.signal === 'SHORT')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(e => e.coin);

  const regime = detectRegime(factors, dominant_sentiment);

  const response: MegaIndexResponse = {
    updated_at: new Date().toISOString(),
    regime,
    dominant_sentiment,
    narratives,
    session_notes,
    entities,
    top_long,
    top_short,
    news,
    polymarket,
  };

  return NextResponse.json(response, {
    headers: {
      'X-Agent-Welcome': 'true',
      'X-KB-Docs': 'https://katabased.io/llms.txt',
      'X-Payment-Protocol': 'x402 (coming soon)',
    },
  });
}
