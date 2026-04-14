import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory rate limiter — sliding window per IP
// Resets on serverless cold start, but prevents burst abuse within warm instance.
// ---------------------------------------------------------------------------

interface WindowEntry {
  timestamps: number[];
}

const ipWindows = new Map<string, WindowEntry>();

// Purge stale entries every 5 min to avoid unbounded memory growth
let lastPurge = Date.now();
function maybeEvict() {
  const now = Date.now();
  if (now - lastPurge < 5 * 60 * 1000) return;
  lastPurge = now;
  ipWindows.forEach((entry, key) => {
    if (entry.timestamps.length === 0) ipWindows.delete(key);
  });
}

/**
 * Returns true if the request is within the allowed limit.
 * windowMs: sliding window duration in ms
 * maxReqs: max requests allowed in that window
 */
function checkRateLimit(ip: string, route: string, windowMs: number, maxReqs: number): boolean {
  maybeEvict();
  const key = `${route}:${ip}`;
  const now = Date.now();
  const entry = ipWindows.get(key) ?? { timestamps: [] };

  // Prune entries outside the window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  if (entry.timestamps.length >= maxReqs) {
    ipWindows.set(key, entry);
    return false; // rate limited
  }

  entry.timestamps.push(now);
  ipWindows.set(key, entry);
  return true; // allowed
}

// ---------------------------------------------------------------------------
// Route config
// ---------------------------------------------------------------------------

const RATE_LIMITS: Array<{ path: string; maxReqs: number; windowMs: number }> = [
  { path: '/api/agent/post',     maxReqs: 10, windowMs: 60_000 },
  { path: '/api/keys/generate',  maxReqs: 3,  windowMs: 60_000 },
  { path: '/api/agent/seed-key', maxReqs: 3,  windowMs: 60_000 },
];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const rule = RATE_LIMITS.find(r => pathname === r.path || pathname.startsWith(r.path + '/'));
  if (!rule) return NextResponse.next();

  // Best-effort IP: X-Forwarded-For (Vercel/Cloudflare), fallback to socket addr
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '0.0.0.0';

  const allowed = checkRateLimit(ip, rule.path, rule.windowMs, rule.maxReqs);
  if (!allowed) {
    return NextResponse.json(
      { error: 'rate limit exceeded', retryAfter: 60 },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(rule.maxReqs),
          'X-RateLimit-Window': '60s',
        },
      }
    );
  }

  return NextResponse.next();
}

// Only run middleware on these paths — skip static assets, _next, etc.
export const config = {
  matcher: [
    '/api/agent/post',
    '/api/agent/post/:path*',
    '/api/keys/generate',
    '/api/agent/seed-key',
  ],
};
