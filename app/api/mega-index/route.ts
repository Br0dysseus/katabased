import { NextResponse } from 'next/server';

// Vercel serverless-safe caching — no module-level state
export const revalidate = 120; // 2 min

const HL_API = 'https://api.hyperliquid.xyz/info';

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

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET() {
  const [factors, intel] = await Promise.all([
    fetchHLFactorScores(),
    fetchMarketIntelFromSupabase(),
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
  };

  return NextResponse.json(response);
}
