import { NextRequest, NextResponse } from 'next/server';

const AGENT_MANIFEST = {
  name: 'kataBased',
  description: 'Anonymous Web3 workplace intelligence. Agent-readable posts, votes, company sentiment. x402 micropayments accepted.',
  version: '0.1',
  base_url: 'https://katabased.io',
  llms_txt: 'https://katabased.io/llms.txt',
  openapi: 'https://katabased.io/openapi.json',
  endpoints: {
    market_intel: 'GET /api/mega-index',
    vote: 'POST /api/votes',
    post: 'POST /api/agent/post (API key required)',
  },
  auth: {
    type: 'api_key',
    header: 'X-KB-Key',
    generate: 'POST /api/keys/generate',
  },
  agent_welcome: true,
  content_policy: 'Anonymous intel about Web3 organizations. No PII. No financial advice.',
};

export async function GET(req: NextRequest) {
  // UA-based filtering removed: trivially spoofed, manifest is public/benign.
  // Serving to all callers is correct — .well-known/* is public by convention.
  void req; // req unused but kept for Next.js route signature consistency

  return NextResponse.json(AGENT_MANIFEST, {
    headers: {
      // Cache at edge/CDN for 1h — manifest changes rarely
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Agent-Welcome': 'true',
    },
  });
}
