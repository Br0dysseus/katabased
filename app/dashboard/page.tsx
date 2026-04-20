'use client';

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
const KataLogo3D = lazy(() => import('@/app/components/KataLogo3D'));
const KataLogoMarble = lazy(() => import('@/app/components/KataLogoMarble'));
const ChallengePanel = lazy(() => import('@/app/components/ChallengePanel'));
const BasinPage = lazy(() => import('@/app/components/BasinPage'));
import { useRouter } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { useUser } from '@/lib/UserContext';
import { getPosts, getEntities, getLeaderboard, getUserStats } from '@/lib/posts';
import { createPost, createVote } from '@/lib/actions';
import type { FeedPost, EntityRow, LeaderRow } from '@/lib/posts';

// ─── Design tokens — red-figure pottery ──────────────────────────────────────
const mono    = "'kataGlyph Stele',Georgia,serif";
const serif   = "'kataGlyph Stele',Georgia,serif";
const sans    = "'kataGlyph Stele',Georgia,serif";
const display = "'kataGlyph Stele',Georgia,serif";
const celadon = '#C8602A';    // terracotta copper — the figure colour
const sigRed  = '#D94030';    // dispute / risk
const sigBlue = '#7AABCC';    // confirm / data — muted blue-grey
const sigGold = '#C9A84C';    // caution / mid-tier
const text1   = '#D8C4A0';    // warm parchment
const text2   = 'rgba(216,196,160,0.70)';
const text3   = 'rgba(216,196,160,0.50)';
const bg      = '#0C0806';    // warm fired-clay black
const bg2     = '#130C07';
const bg3     = '#1C1108';
const border  = 'rgba(200,140,60,0.10)'; // amber-tinted rule
// legacy aliases so deep refs still compile
const inter   = sans;
const accent  = celadon;
const amber   = sigGold;
const blue    = sigBlue;
const terra   = sigRed;
const green   = celadon;
const surf1   = bg2;
const surf2   = bg3;

// ─── Error sanitization [L2] ──────────────────────────────────────────────────
const USER_ERRORS: Record<string, string> = {
  'invalid_signature': 'Wallet verification failed. Please try again.',
  'Signature verification failed — sign the message with your wallet': 'Wallet verification failed. Please try again.',
  'duplicate_post': 'Post already exists.',
  'rate_limited': 'Too many requests. Please wait.',
  'Rate limit: max 5 transmissions per hour': 'Too many posts. Please wait before sending another.',
  'Username already taken': 'That username is already taken.',
  'Session expired — reconnect wallet': 'Session expired. Please reconnect your wallet.',
  'Invalid session': 'Session invalid. Please reconnect your wallet.',
  'Title must be 1–120 characters': 'Title must be 1–120 characters.',
  'Content must be 1–2000 characters': 'Content must be 1–2000 characters.',
  'Entity name must be ≤ 100 characters': 'Entity name must be 100 characters or fewer.',
  'Username must be 3–50 characters': 'Username must be 3–50 characters.',
  'Username may only contain letters, numbers, _ and -': 'Username may only contain letters, numbers, _ and -',
};
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return USER_ERRORS[msg] ?? 'Something went wrong. Please try again.';
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const FEED = [
  { id: 1, author: 'anon_19283746', entity: 'Coinbase',      title: 'they let 900 people go over Slack. no call. no warning.',              content: "HR sent a calendar block at 7am. meeting link didn't work for 400 of them. that's how they found out. comms team called it 'operational efficiency' in the all-hands three days later.",    confirms: 312, disputes: 14, replies: 56,  time: '2h'  },
  { id: 2, author: 'anon_55839201', entity: 'Chainalysis',   title: 'promotion list decided in December. told in June. half get pulled.',    content: "My skip-level admitted the budget freezes every Q1. They tell you 'next cycle.' I've heard that for two years. There is no next cycle.",                                                  confirms: 167, disputes: 9,  replies: 28,  time: '5h'  },
  { id: 3, author: 'anon_77201938', entity: 'OpenSea',       title: 'Seaport team and product team stopped talking. two companies now.',      content: "Protocol engineers route around leadership entirely. Product gets Figma updates instead of engineers. They stopped inviting each other to standups months ago.",                          confirms: 244, disputes: 41, replies: 73,  time: '8h'  },
  { id: 4, author: 'anon_33018274', entity: 'Uniswap Labs',  title: 'turned down FAANG to stay here. still no regrets.',                     content: "Nobody asks permission to ship. If you're right, you're right. First place I've worked where the best engineers actually have power. The protocol doesn't lie.",                        confirms: 389, disputes: 7,  replies: 51,  time: '12h' },
  { id: 5, author: 'anon_99182736', entity: 'Alchemy',       title: 'biggest enterprise client had 12h downtime. we blamed them publicly.',  content: "I was on that incident call. It was our infra. RCA got quietly buried. Sales is still using their logo on the pitch deck.",                                                         confirms: 201, disputes: 62, replies: 104, time: '1d'  },
  { id: 6, author: 'anon_44102938', entity: 'Paradigm',      title: 'partner replied to my cold email in 6 minutes with actual code.',       content: "Not a form response. They'd read the paper. Pushed back on two assumptions. I've never felt more accurately seen by anyone in this industry.",                                         confirms: 571, disputes: 5,  replies: 130, time: '2d'  },
];

const COS = [
  { name: 'Coinbase',     count: 342, sent: 0.62 },
  { name: 'Uniswap Labs', count: 189, sent: 0.84 },
  { name: 'OpenSea',      count: 276, sent: 0.51 },
  { name: 'Alchemy',      count: 134, sent: 0.45 },
  { name: 'Chainalysis',  count: 98,  sent: 0.73 },
];

const LEADERS = [
  { rank: 1, user: 'anon_00128374', karma: 12840, posts: 156 },
  { rank: 2, user: 'anon_55291037', karma: 9720,  posts: 98  },
  { rank: 3, user: 'anon_33018274', karma: 8430,  posts: 87  },
  { rank: 4, user: 'anon_77201938', karma: 6210,  posts: 64  },
  { rank: 5, user: 'anon_95410276', karma: 3840,  posts: 23  },
];

// KataLogo3D loaded via lazy import above

// ─── Section heading — minimal line rule ─────────────────────────────────────
function SecHead({ label, mb = 20 }: { label: string; mb?: number }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(216,196,160,0.72)', marginBottom: mb, display: 'flex', alignItems: 'center', gap: 10 }}>
      {'// '}{label}
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${border} 0%, transparent 100%)` }} />
    </div>
  );
}

// ─── Feed entry — document style, no card ────────────────────────────────────
function FeedEntry({ p, votes, vote, index }: { p: FeedPost; votes: Record<string, string | null>; vote: (id: string, t: string) => void; index: number }) {
  // chain_post_id present when post has been staked on-chain
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const total = p.confirms + p.disputes;
  const confPct = total > 0 ? (p.confirms / total) * 100 : 50;
  const signalHigh = p.confirms > 300;
  const signalMed  = p.confirms > 100;

  const delay = 60 + index * 80;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const nx = (e.clientX - left) / width  - 0.5;
    const ny = (e.clientY - top)  / height - 0.5;
    setTilt({ rx: -ny * 5, ry: nx * 7 });
  };

  const baseTransform = visible ? 'translateY(0)' : 'translateY(14px)';
  const tiltTransform = hovered
    ? `perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(3px)`
    : 'perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0px)';

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ rx: 0, ry: 0 }); }}
      onMouseMove={handleMouseMove}
      style={{
        paddingLeft: 16,
        paddingTop: 20,
        paddingBottom: 20,
        marginBottom: 0,
        cursor: 'default',
        opacity: visible ? 1 : 0,
        transform: hovered ? tiltTransform : baseTransform,
        transition: hovered
          ? `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.12s ease, box-shadow 0.2s ease`
          : `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms, box-shadow 0.2s ease`,
        transformOrigin: 'center center',
        boxShadow: hovered ? '-2px 0 0 rgba(212,99,26,0.45), 0 0 10px rgba(212,99,26,0.08), 0 0 30px rgba(212,99,26,0.04)' : '-2px 0 0 rgba(212,99,26,0)',
      }}
    >
      {/* Entity + meta */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          style={{
            fontFamily: mono, fontSize: 13, fontWeight: 600,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: hovered ? celadon : 'rgba(212,99,26,0.58)',
            textShadow: hovered ? '0px 0px 1px #00E5A0, 0px 0px 5px rgba(212,99,26,0.6), 0px 5px 4px rgba(212,99,26,0.4)' : 'none',
            transition: 'color 0.18s, text-shadow 0.18s',
          }}
        >
          {p.entity && p.entity !== '—' ? p.entity : '—'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.28)', letterSpacing: '0.1em' }}>{p.time}</span>
          <span style={{
            fontFamily: mono, fontSize: 13, letterSpacing: '0.18em',
            color: signalHigh ? 'rgba(77,166,232,0.72)' : signalMed ? 'rgba(77,166,232,0.44)' : 'rgba(216,196,160,0.48)',
          }}>
            {signalHigh ? '◆ HIGH' : signalMed ? '◈ MED' : '◻ LOW'}
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: sans, fontSize: 19, fontWeight: 500,
        color: hovered ? text1 : 'rgba(216,196,160,0.92)',
        lineHeight: 1.45, marginBottom: 8,
        letterSpacing: '-0.015em',
        transition: 'color 0.18s',
      }}>
        {p.title}
      </div>

      {/* Body */}
      <div style={{
        fontFamily: sans, fontSize: 17, lineHeight: 1.82,
        color: hovered ? 'rgba(216,196,160,0.72)' : 'rgba(216,196,160,0.55)',
        fontWeight: 400, marginBottom: 14,
        transition: 'color 0.18s',
      }}>
        {p.content}
      </div>

      {/* Ratio bar + sign action */}
      <div
        style={{ opacity: hovered ? 1 : 0.4, transition: 'opacity 0.2s' }}
      >
        <div style={{ display: 'flex', height: 1.5, width: '100%', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${confPct}%`, background: 'rgba(77,166,232,0.52)', height: '100%', transition: 'width 0.4s' }} />
          <div style={{ flex: 1, background: 'rgba(229,90,0,0.28)', height: '100%' }} />
        </div>

        {/* Sign actions — appear on hover, feel like signing not liking */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}>
          <SignAction
            count={p.confirms + (votes[String(p.id)] === 'confirm' ? 1 : 0)}
            type="confirm"
            active={votes[String(p.id)] === 'confirm'}
            onClick={() => vote(String(p.id), 'confirm')}
          />
          <SignAction
            count={p.disputes + (votes[String(p.id)] === 'dispute' ? 1 : 0)}
            type="dispute"
            active={votes[String(p.id)] === 'dispute'}
            onClick={() => vote(String(p.id), 'dispute')}
          />
          {p.replies > 0 && (
            <span style={{ fontFamily: mono, fontSize: 13, color: 'rgba(224,210,185,0.2)', letterSpacing: '0.08em', marginLeft: 'auto' }}>
              {p.replies} replies
            </span>
          )}
        </div>
      </div>

      {/* On-chain challenge panel — only renders when post has chain_post_id */}
      {p.chain_post_id && (
        <Suspense fallback={null}>
          <ChallengePanel postId={p.chain_post_id} />
        </Suspense>
      )}

      {/* Rule */}
      <div style={{ height: 1, background: 'rgba(216,196,160,0.05)', marginTop: 20 }} />
    </div>
  );
}

// ─── Sign action (not a Reddit button) ───────────────────────────────────────
function SignAction({ count, type, active, onClick }: { count: number; type: 'confirm' | 'dispute'; active: boolean; onClick: () => void }) {
  const isConfirm = type === 'confirm';
  const col = isConfirm
    ? active ? sigBlue : 'rgba(77,166,232,0.42)'
    : active ? sigRed  : 'rgba(229,90,0,0.4)';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 0',
        fontFamily: mono, fontSize: 13, fontWeight: active ? 600 : 400,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: col,
        transition: 'color 0.14s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isConfirm ? sigBlue : sigRed; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = col; }}
    >
      <span style={{ fontSize: 14 }}>{isConfirm ? '◆' : '◈'}</span>
      {isConfirm ? 'confirm' : 'dispute'}
      <span style={{ opacity: 0.55, fontSize: 14 }}>{count}</span>
    </button>
  );
}

// ─── Feed page ────────────────────────────────────────────────────────────────
function FeedPage({ feed, votes, vote, onCompose, selectedEntity, onClearEntity, loading, error }: { feed: FeedPost[]; votes: Record<string, string | null>; vote: (id: string, t: string) => void; onCompose: () => void; selectedEntity: string | null; onClearEntity: () => void; loading?: boolean; error?: boolean }) {
  const displayFeed = selectedEntity ? feed.filter(p => p.entity === selectedEntity) : feed;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onCompose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCompose]);

  return (
    <div>
      {/* Header row */}
      <div className="fi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, animationDelay: '0.04s' }}>
        <SecHead label={selectedEntity ? `FEED_LOG // ${selectedEntity.toUpperCase().replace(/ /g, '_')}` : 'FEED_LOG'} mb={0} />
        {selectedEntity && (
          <button
            onClick={onClearEntity}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: mono, fontSize: 13, letterSpacing: '0.14em', color: 'rgba(232,168,124,0.5)', padding: 0, transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = amber; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(232,168,124,0.5)'; }}
          >
            ✕ clear filter
          </button>
        )}
      </div>

      {/* Composer trigger — secure channel feel */}
      <div
        className="fi"
        onClick={onCompose}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 0',
          marginBottom: 32,
          borderBottom: `1px solid rgba(212,99,26,0.1)`,
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          animationDelay: '0.08s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,99,26,0.3)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,99,26,0.1)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: celadon, boxShadow: `0 0 6px rgba(212,99,26,0.5)`, animation: 'pd 2s ease infinite', flexShrink: 0 }} />
          <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.52)', letterSpacing: '0.14em' }}>{'// open secure channel…'}</span>
        </div>
        <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.45)', letterSpacing: '0.14em', border: `1px solid ${border}`, padding: '2px 6px', borderRadius: 1 }}>⌘K</span>
      </div>

      {/* Feed */}
      <div>
        {loading && (
          <div style={{ fontFamily: mono, fontSize: 15, color: 'rgba(224,210,185,0.25)', padding: '32px 0', animation: 'pd 2s ease infinite', letterSpacing: '0.1em' }}>{'// loading transmissions…'}</div>
        )}
        {!loading && error && (
          <div style={{ fontFamily: mono, fontSize: 15, color: 'rgba(248,113,113,0.45)', padding: '32px 0', letterSpacing: '0.08em' }}>{'// signal lost — could not reach archive'}</div>
        )}
        {!loading && !error && displayFeed.length === 0 && (
          <div style={{ fontFamily: mono, fontSize: 15, color: 'rgba(224,210,185,0.2)', padding: '32px 0', letterSpacing: '0.08em' }}>{'// no transmissions found'}</div>
        )}
        {displayFeed.map((p, i) => (
          <FeedEntry key={p.id} p={p} votes={votes} vote={vote} index={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Mega Index ───────────────────────────────────────────────────────────────
interface MegaEntity { coin: string; factor_score: number; sentiment: string; mentions: number; signal: string; confidence: number; }
interface MegaNewsItem { title: string; source: string; url: string; published?: string; }
interface MegaPolyItem { question: string; yes_prob: number; volume: number; }
interface MegaData { updated_at: string; regime: string; dominant_sentiment: string; narratives: string[]; session_notes: string; entities: MegaEntity[]; top_long: string[]; top_short: string[]; news: MegaNewsItem[]; polymarket: MegaPolyItem[]; }

const REGIME_COLOR: Record<string, string> = { trending: '#4ade80', choppy: '#facc15', 'mean-reversion': '#a78bfa', carry: '#38bdf8', breakout: '#f472b6', neutral: 'rgba(210,188,152,0.3)' };
const SENT_COLOR: Record<string, string> = { bullish: '#4ade80', bearish: '#f87171', neutral: 'rgba(210,188,152,0.35)', mixed: '#facc15' };

function MegaIndex() {
  const [data, setData] = useState<MegaData | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/mega-index');
      if (!r.ok) { setErr(true); return; }
      setData(await r.json());
      setErr(false);
    } catch { setErr(true); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  if (err) return (
    <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(212,90,90,0.4)', letterSpacing: '0.08em', padding: '8px 0', marginBottom: 12 }}>{'// MEGA_INDEX signal lost'}</div>
  );
  if (!data) return (
    <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(107,159,212,0.3)', letterSpacing: '0.08em', padding: '8px 0', marginBottom: 12, animation: 'pd 2s ease infinite' }}>{'// loading MEGA_INDEX…'}</div>
  );

  const bullCount = data.entities.filter(e => e.sentiment === 'bullish').length;
  const bearCount = data.entities.filter(e => e.sentiment === 'bearish').length;
  const total = data.entities.length || 1;
  const bullPct = Math.round((bullCount / total) * 100);
  const bearPct = Math.round((bearCount / total) * 100);
  const neutPct = 100 - bullPct - bearPct;

  const confEntities = data.entities.filter(e => e.signal !== 'NEUTRAL').sort((a, b) => b.confidence - a.confidence);

  function relTime(published?: string): string {
    if (!published) return '';
    const d = new Date(published);
    if (isNaN(d.getTime())) return '';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  const newsItems = data.news ?? [];
  const polyItems = data.polymarket ?? [];

  const divider = <div style={{ height: 1, background: 'rgba(107,159,212,0.07)', margin: '10px 0' }} />;

  return (
    <div style={{ marginBottom: 28, position: 'relative', overflow: 'hidden', border: '1px solid rgba(216,196,160,0.07)', borderRadius: 2, padding: '16px' }}>
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: celadon, boxShadow: `0 0 6px rgba(212,99,26,0.55)`, animation: 'pd 2s ease infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(77,166,232,0.75)', textTransform: 'uppercase', textShadow: '0 0 8px rgba(212,99,26,0.25)' }}>MEGA_INDEX</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: REGIME_COLOR[data.regime] ?? REGIME_COLOR.neutral, padding: '2px 6px', border: `1px solid ${REGIME_COLOR[data.regime] ?? REGIME_COLOR.neutral}30`, borderRadius: 1 }}>
              {data.regime.toUpperCase()}
            </span>
            <span style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.1em', color: SENT_COLOR[data.dominant_sentiment] ?? SENT_COLOR.neutral }}>
              {data.dominant_sentiment.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Sentiment bar */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', width: '100%', height: 5, borderRadius: 2, overflow: 'hidden', gap: 1, marginBottom: 6 }}>
            <div style={{ width: `${bullPct}%`, background: 'rgba(74,222,128,0.65)', height: '100%', transition: 'width 0.5s' }} />
            <div style={{ width: `${neutPct}%`, background: 'rgba(210,188,152,0.14)', height: '100%' }} />
            <div style={{ width: `${bearPct}%`, background: 'rgba(248,113,113,0.6)', height: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(74,222,128,0.75)', letterSpacing: '0.06em' }}>{bullPct}% <span style={{ opacity: 0.5 }}>BULL</span></span>
            <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(210,188,152,0.38)', letterSpacing: '0.06em' }}>{neutPct}% <span style={{ opacity: 0.5 }}>NEUT</span></span>
            <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(248,113,113,0.7)', letterSpacing: '0.06em' }}>{bearPct}% <span style={{ opacity: 0.5 }}>BEAR</span></span>
          </div>
        </div>

        {/* Top signals */}
        {(data.top_long.length > 0 || data.top_short.length > 0) && (
          <>
            {divider}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 13, color: 'rgba(74,222,128,0.55)', letterSpacing: '0.14em', marginBottom: 7, textTransform: 'uppercase' }}>↑ LONG</div>
                {data.top_long.map(coin => {
                  const e = confEntities.find(x => x.coin === coin);
                  const fs = e ? (e.factor_score > 0 ? '+' : '') + e.factor_score.toFixed(2) : null;
                  return (
                    <div key={coin} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center', marginBottom: 5, padding: '4px 7px', background: 'rgba(74,222,128,0.04)', borderLeft: '2px solid rgba(74,222,128,0.35)', borderRadius: 1 }}>
                      <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: 'rgba(74,222,128,0.9)', letterSpacing: '0.04em' }}>{coin}</span>
                      {fs && <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(74,222,128,0.45)', letterSpacing: '0.04em' }}>z{fs}</span>}
                      <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(74,222,128,0.65)' }}>{e ? Math.round(e.confidence * 100) : '—'}%</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <div style={{ fontFamily: mono, fontSize: 13, color: 'rgba(248,113,113,0.55)', letterSpacing: '0.14em', marginBottom: 7, textTransform: 'uppercase' }}>↓ SHORT</div>
                {data.top_short.map(coin => {
                  const e = confEntities.find(x => x.coin === coin);
                  const fs = e ? (e.factor_score > 0 ? '+' : '') + e.factor_score.toFixed(2) : null;
                  return (
                    <div key={coin} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center', marginBottom: 5, padding: '4px 7px', background: 'rgba(248,113,113,0.04)', borderLeft: '2px solid rgba(248,113,113,0.28)', borderRadius: 1 }}>
                      <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: 'rgba(248,113,113,0.88)' }}>{coin}</span>
                      {fs && <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(248,113,113,0.38)' }}>z{fs}</span>}
                      <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(248,113,113,0.58)' }}>{e ? Math.round(e.confidence * 100) : '—'}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Narratives */}
        {data.narratives.length > 0 && (
          <>
            {divider}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
              {data.narratives.slice(0, 8).map(n => (
                <span key={n} style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.06em', color: 'rgba(107,159,212,0.65)', border: '1px solid rgba(107,159,212,0.16)', padding: '2px 7px', borderRadius: 2 }}>{n}</span>
              ))}
            </div>
          </>
        )}

        {/* Session notes */}
        {data.session_notes && (
          <>
            {divider}
            <div style={{ fontFamily: sans, fontSize: 16, lineHeight: 1.7, color: 'rgba(216,196,160,0.62)', fontStyle: 'italic', marginBottom: 4 }}>
              {data.session_notes}
            </div>
          </>
        )}

        {/* Live markets (prediction markets) */}
        {polyItems.length > 0 && (
          <>
            {divider}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(212,132,90,0.7)', marginBottom: 8, textTransform: 'uppercase' }}>LIVE_MARKETS</div>
              {polyItems.map((m, i) => {
                const pYes = m.yes_prob;
                const pNo = 100 - pYes;
                const volK = m.volume >= 1000 ? `$${(m.volume / 1000).toFixed(0)}k` : `$${m.volume}`;
                const yesBright = pYes > 65 ? 'rgba(74,222,128,0.88)' : pYes < 35 ? 'rgba(248,113,113,0.85)' : 'rgba(210,188,152,0.65)';
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ fontFamily: sans, fontSize: 15, color: 'rgba(216,196,160,0.72)', letterSpacing: '0.01em', marginBottom: 5, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {m.question}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, display: 'flex', height: 4, borderRadius: 1, overflow: 'hidden', gap: 1 }}>
                        <div style={{ width: `${pYes}%`, background: 'rgba(74,222,128,0.5)', height: '100%', transition: 'width 0.4s' }} />
                        <div style={{ width: `${pNo}%`, background: 'rgba(248,113,113,0.35)', height: '100%' }} />
                      </div>
                      <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: yesBright, flexShrink: 0 }}>{pYes}%</span>
                      <span style={{ fontFamily: mono, fontSize: 13, color: 'rgba(210,188,152,0.35)', flexShrink: 0 }}>{volK}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Signals (news feed) */}
        {newsItems.length > 0 && (
          <>
            {divider}
            <div>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(107,159,212,0.6)', marginBottom: 8, textTransform: 'uppercase' }}>SIGNALS</div>
              {newsItems.map((item, i) => {
                const age = relTime(item.published);
                return (
                  <div key={i} style={{ marginBottom: 7, paddingBottom: 7, borderBottom: i < newsItems.length - 1 ? '1px solid rgba(107,159,212,0.07)' : 'none' }}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <div style={{ fontFamily: sans, fontSize: 15, color: 'rgba(216,196,160,0.75)', letterSpacing: '0.01em', lineHeight: 1.5, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, cursor: 'pointer', transition: 'color 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(107,159,212,0.95)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(216,196,160,0.75)'; }}
                      >
                        {item.title}
                      </div>
                    </a>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(212,132,90,0.62)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.source}</span>
                      {age && <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(210,188,152,0.3)' }}>{age} ago</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {divider}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(210,188,152,0.22)', letterSpacing: '0.08em' }}>anjew · {total} entities</span>
          <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(107,159,212,0.28)', letterSpacing: '0.06em' }}>
            {new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Explore page ─────────────────────────────────────────────────────────────
function ExplorePage({ entities, search, setSearch, onSelectEntity }: { entities: EntityRow[]; search: string; setSearch: (s: string) => void; onSelectEntity: (name: string) => void }) {
  const filt = entities.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="fi" style={{ animationDelay: '0.06s' }}>
      <SecHead label="EXPLORE" />
      {/* Search — above MegaIndex */}
      <input
        value={search}
        onChange={e => setSearch((e.target as HTMLInputElement).value)}
        placeholder="Search entities…"
        style={{ width: '100%', padding: '11px 0', border: 'none', borderBottom: `1px solid ${border}`, background: 'transparent', color: text1, fontSize: 18, fontFamily: mono, outline: 'none', marginBottom: 28, transition: 'border-color 0.15s', letterSpacing: '0.04em' }}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(212,99,26,0.38)'; }}
        onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = border; }}
      />
      <MegaIndex />
      <div>
        {filt.map((c, i) => {
          const pct = Math.round(c.sent * 100);
          const hi  = pct >= 60;
          const lo  = pct < 40;
          const barCol = hi ? blue : terra;
          const signalLabel = hi ? 'POSITIVE' : lo ? 'NEGATIVE' : 'NEUTRAL';
          return (
            <div
              key={c.name}
              className="fi"
              style={{ animationDelay: `${40 + i * 50}ms`, marginBottom: 0, cursor: 'pointer' }}
              onClick={() => onSelectEntity(c.name)}
            >
              <ExploreRow c={c} pct={pct} barCol={barCol} signalLabel={signalLabel} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExploreRow({ c, pct, barCol, signalLabel }: { c: EntityRow; pct: number; barCol: string; signalLabel: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        paddingLeft: 16, paddingTop: 16, paddingBottom: 16,
        boxShadow: hovered ? '-2px 0 0 rgba(212,99,26,0.4)' : '-2px 0 0 rgba(212,99,26,0)',
        transition: 'box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {/* Entity icon */}
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: hovered ? celadon : 'rgba(216,196,160,0.22)', transition: 'color 0.14s', flexShrink: 0 }}>
            <rect x="1" y="1" width="5.2" height="5.2" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
            <rect x="7.8" y="1" width="5.2" height="5.2" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
            <rect x="1" y="7.8" width="5.2" height="5.2" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
            <rect x="7.8" y="7.8" width="5.2" height="5.2" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
          </svg>
          <div style={{
            fontFamily: sans, fontSize: 18, fontWeight: 400,
            color: hovered ? text1 : 'rgba(216,196,160,0.88)',
            transition: 'color 0.14s',
            letterSpacing: '-0.012em',
          }}>{c.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.28)', letterSpacing: '0.06em' }}>{c.count} posts</span>
          <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 600, color: barCol }}>{pct}%</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 1.5, overflow: 'hidden', marginBottom: 7, display: 'flex' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'rgba(77,166,232,0.5)', transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
        <div style={{ flex: 1, height: '100%', background: 'rgba(229,90,0,0.25)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: 13, color: barCol, opacity: 0.62, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{signalLabel}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hovered ? 1 : 0, transition: 'opacity 0.14s' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: celadon }}>
            <path d="M2 5h6M6 3l2 2-2 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: mono, fontSize: 13, color: 'rgba(212,99,26,0.45)', letterSpacing: '0.1em' }}>VIEW</span>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(216,196,160,0.04)', marginTop: 16 }} />
    </div>
  );
}

// ─── Ranks page ───────────────────────────────────────────────────────────────
function RanksPage({ leaders, username }: { leaders: LeaderRow[]; username: string }) {
  return (
    <div className="fi" style={{ animationDelay: '0.06s' }}>
      <SecHead label="LEADERBOARD" />

      <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(224,210,185,0.2)', letterSpacing: '0.1em', marginBottom: 24 }}>
        {'// ranked by transmission volume · all identities pseudonymous'}
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 60px', gap: 12, padding: '0 0 10px', borderBottom: `1px solid ${border}`, marginBottom: 0 }}>
        {['#', 'OPERATOR', 'KARMA', 'POSTS'].map(h => (
          <div key={h} style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(224,210,185,0.2)', textTransform: 'uppercase', textAlign: h === 'KARMA' || h === 'POSTS' ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>

      {leaders.map((e, i) => {
        const me = e.user === username;
        return (
          <div key={e.rank} className="fi" style={{ animationDelay: `${40 + i * 50}ms` }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 80px 60px', gap: 12,
              alignItems: 'center', padding: '14px 0',
              borderBottom: `1px solid rgba(255,255,255,${me ? '0.08' : '0.04'})`,
              background: me ? 'rgba(212,99,26,0.03)' : 'transparent',
            }}>
              <span style={{ fontFamily: mono, fontSize: 14, color: e.rank <= 3 ? 'rgba(224,210,185,0.6)' : 'rgba(224,210,185,0.2)', letterSpacing: '0.06em' }}>
                {String(e.rank).padStart(2, '0')}
              </span>
              <div style={{ fontFamily: mono, fontSize: 14, color: me ? celadon : 'rgba(216,196,160,0.5)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
                {e.user}
                {me && <span style={{ fontSize: 13, color: 'rgba(212,99,26,0.62)', letterSpacing: '0.16em', border: '1px solid rgba(212,99,26,0.2)', padding: '1px 5px', borderRadius: 1 }}>YOU</span>}
              </div>
              <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, color: me ? text1 : 'rgba(216,196,160,0.32)', textAlign: 'right', letterSpacing: '0.04em' }}>{e.karma.toLocaleString()}</div>
              <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.52)', textAlign: 'right', letterSpacing: '0.04em' }}>{e.posts}</div>
            </div>
          </div>
        );
      })}

      {/* OPSEC note */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${border}` }}>
        <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(232,168,124,0.4)', marginBottom: 8, textTransform: 'uppercase' }}>{'// opsec note'}</div>
        <div style={{ fontFamily: inter, fontSize: 16, lineHeight: 1.75, color: 'rgba(224,210,185,0.35)', fontWeight: 400 }}>
          Public post counts and karma can narrow your identity. A high rank combined with known posting patterns is an attack surface.
        </div>
      </div>
    </div>
  );
}

// ─── Composer — secure channel, full-screen expand ──────────────────────────
function ComposerModal({ sessionToken, onPostCreated, onClose }: { sessionToken: string; onPostCreated: (p: FeedPost) => void; onClose: () => void }) {
  const [company,    setCompany]    = useState('');
  const [title,      setTitle]      = useState('');
  const [body,       setBody]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const submitRef = useRef(false);

  const BODY_MAX = 1200;
  const TITLE_MAX = 120;

  const submit = async () => {
    if (!sessionToken) { setError('identity not established — reconnect wallet'); return; }
    if (!title.trim() || !body.trim()) { setError('HEADER* and TRANSMISSION* are required'); return; }
    if (submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true); setError('');
    try {
      const post = await createPost(sessionToken, title, body, company);
      onPostCreated(post);
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const fieldStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%',
    padding: '12px 0',
    border: 'none',
    borderBottom: `1px solid rgba(255,255,255,0.08)`,
    background: 'transparent',
    color: text1,
    fontFamily: inter,
    outline: 'none',
    transition: 'border-color 0.2s',
    letterSpacing: '0.01em',
    ...extra,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,11,0.97)', backdropFilter: 'blur(28px)' }} onClick={onClose} />

      <div className="fi" style={{
        position: 'relative', width: '100%', maxWidth: 600,
        margin: '0 24px', zIndex: 1,
        borderTop: `1px solid rgba(212,99,26,0.25)`,
        paddingTop: 48,
      }}>
        {/* Channel header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: celadon, boxShadow: `0 0 10px rgba(212,99,26,0.6)`, animation: 'pd 1.5s ease infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.26em', color: 'rgba(212,99,26,0.55)', textTransform: 'uppercase' }}>{'// secure channel open'}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: mono, fontSize: 14, color: 'rgba(224,210,185,0.25)', letterSpacing: '0.12em', padding: 0, transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(224,210,185,0.6)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(224,210,185,0.25)'; }}
          >
            ESC
          </button>
        </div>

        {/* Entity */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.22em', color: 'rgba(224,210,185,0.25)', marginBottom: 8, textTransform: 'uppercase' }}>Entity <span style={{ color: 'rgba(224,210,185,0.15)' }}>— optional</span></div>
          <input
            value={company}
            onChange={e => setCompany((e.target as HTMLInputElement).value)}
            placeholder="Coinbase, Dept. of State…"
            style={fieldStyle({ fontSize: 18, fontWeight: 400, color: 'rgba(224,210,185,0.7)' })}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(212,99,26,0.32)'; }}
            onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.22em', color: 'rgba(224,210,185,0.35)', textTransform: 'uppercase' }}>
              Headline <span style={{ color: amber, opacity: 0.7 }}>*</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 13, color: title.length > TITLE_MAX * 0.85 ? 'rgba(248,113,113,0.6)' : 'rgba(224,210,185,0.18)' }}>{title.length}/{TITLE_MAX}</span>
          </div>
          <input
            value={title}
            onChange={e => { if (e.target.value.length <= TITLE_MAX) setTitle(e.target.value); }}
            placeholder="What needs to be known"
            style={fieldStyle({ fontSize: 20, fontWeight: 500, color: 'rgba(224,210,185,0.9)' })}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(212,99,26,0.32)'; }}
            onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.22em', color: 'rgba(224,210,185,0.35)', textTransform: 'uppercase' }}>
              Transmission <span style={{ color: amber, opacity: 0.7 }}>*</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 13, color: body.length > BODY_MAX * 0.9 ? 'rgba(248,113,113,0.6)' : 'rgba(224,210,185,0.18)' }}>{body.length}/{BODY_MAX}</span>
          </div>
          <textarea
            value={body}
            onChange={e => { if (e.target.value.length <= BODY_MAX) setBody(e.target.value); }}
            placeholder="What it's actually like on the inside…"
            rows={8}
            style={fieldStyle({ padding: '12px 0', fontSize: 17, resize: 'vertical', lineHeight: 1.85, fontWeight: 400, color: 'rgba(224,210,185,0.75)', display: 'block' })}
            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(212,99,26,0.32)'; }}
            onBlur={e  => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
        </div>

        {error && (
          <div style={{ marginBottom: 24, paddingLeft: 12, borderLeft: '2px solid rgba(248,113,113,0.4)', fontFamily: inter, fontSize: 16, color: 'rgba(248,113,113,0.8)', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: mono, fontSize: 13, color: 'rgba(224,210,185,0.18)', letterSpacing: '0.1em' }}>
            anon · on-chain hash
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: mono, fontSize: 14, color: 'rgba(224,210,185,0.3)', letterSpacing: '0.14em', padding: 0, transition: 'color 0.15s', textTransform: 'uppercase' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(224,210,185,0.6)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(224,210,185,0.3)'; }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', border: `1px solid ${submitting ? 'rgba(212,99,26,0.18)' : 'rgba(212,99,26,0.42)'}`, background: submitting ? 'rgba(212,99,26,0.04)' : 'rgba(212,99,26,0.1)', color: submitting ? 'rgba(216,196,160,0.3)' : text1, fontSize: 13, fontFamily: mono, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.24em', transition: 'all 0.14s', textTransform: 'uppercase', borderRadius: 1 }}
              onMouseEnter={e => { if (!submitting) { (e.currentTarget as HTMLElement).style.background = 'rgba(212,99,26,0.18)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,99,26,0.62)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(212,99,26,0.5), 0 0 5px rgba(212,99,26,0.3), 0 0 30px rgba(212,99,26,0.1)'; } }}
              onMouseLeave={e => { if (!submitting) { (e.currentTarget as HTMLElement).style.background = 'rgba(212,99,26,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,99,26,0.42)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; } }}
            >
              {submitting && <span style={{ animation: 'pd 0.8s ease infinite' }}>◆</span>}
              {submitting ? 'Broadcasting…' : 'Broadcast'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OpSec page ───────────────────────────────────────────────────────────────
const TIERS = [
  {
    id: 'T0', label: 'BASELINE_HYGIENE', sub: 'Before you do anything else', icon: '◈', col: 'rgba(212,99,26,0.38)', threat: 'CRITICAL', bg: 'rgba(212,99,26,0.025)', time: '30min',
    steps: [
      'Never post from your main wallet. Use a dedicated wallet with zero ties to your real identity — no ENS, no NFTs, no prior activity linked to you.',
      'Use a separate browser profile or a private/incognito window exclusively for kataBased sessions. No extensions tied to your identity.',
      'Disconnect your wallet and clear site data after every session.',
      'Never access this platform from a work device, work network, or any machine that has touched your employer\'s systems.',
      'Disable WebRTC in your browser settings to prevent IP address leaks through wallet extension connections.',
      'Never post from a phone. Mobile devices log GPS history, push notification timestamps, device fingerprints, and carrier metadata across sessions. If mobile is unavoidable: a factory-reset device running GrapheneOS on an anonymous pay-as-you-go SIM is the minimum viable setup. In practice: never post from a phone.',
    ],
  },
  {
    id: 'T1', label: 'NETWORK_ANONYMITY', sub: 'Kill the IP trail', icon: '⊕', col: '#4DA6E8', threat: 'CRITICAL', bg: 'rgba(77,166,232,0.03)', time: '1h',
    steps: [
      'Use a no-log VPN for every session. Mullvad and ProtonVPN both accept anonymous crypto payment with no email required. Do not use free VPNs — they log.',
      'For stronger guarantees: use Tor Browser. Traffic routes through 3+ independent relays; no single node sees both your IP and your destination.',
      'Never use public WiFi without a VPN layer on top. Unencrypted public networks are trivial to monitor.',
      'Your wallet extension and your anonymized network must be on the same stack. Connecting MetaMask on a clearnet browser while your Tor tab is open means nothing.',
      'After enabling your VPN, verify your IP is masked before connecting your wallet. Use a DNS leak test — many VPNs allow DNS leaks by default even while connected. ipleak.net and browserleaks.com are standard checks. Mullvad\'s own tool at mullvad.net/check is the most comprehensive. Never skip this on a new setup.',
    ],
  },
  {
    id: 'T2', label: 'WALLET_ISOLATION', sub: 'Your review wallet must be sterile', icon: '◻', col: 'rgba(77,166,232,0.68)', threat: 'RECOMMENDED', bg: 'rgba(77,166,232,0.04)', time: '45min',
    steps: [
      'Generate a fresh wallet with zero transaction history — not a wallet you\'ve used anywhere else, ever.',
      'Never fund it directly from a CEX (Coinbase, Kraken, Binance, etc.). KYC links the withdrawal directly to your government identity.',
      'Never send ETH directly from your main wallet to your anon wallet. A single direct transfer is enough for blockchain analytics tools to link both addresses permanently.',
      'Hold only the minimum ETH needed to sign transactions. Don\'t accumulate assets or receive funds from unrelated sources here.',
      'Store the seed phrase offline on paper or stamped metal, physically isolated from devices connected to your real identity. Never photograph it. Never store it digitally, not even encrypted.',
    ],
  },
  {
    id: 'T3', label: 'ON-CHAIN_PRIVACY', sub: 'Break the fund flow before it reaches your anon wallet', icon: '⬡', col: '#C9A84C', threat: 'ADVANCED', bg: 'rgba(201,168,76,0.03)', time: '2–3h',
    steps: [
      'Blockchain analytics tools build identity graphs by tracing fund flows between addresses. A motivated employer or investigator can follow ETH from your KYC\'d exchange through multiple hops to your anon wallet if the on-chain trail is unbroken.',
      'RAILGUN is a zero-knowledge shielding protocol that lets you deposit ETH and ERC-20 tokens into a private shielded balance using zkSNARKs. Transfers from a shielded balance do not expose sender or recipient addresses on-chain.',
      'Recommended RAILGUN workflow: fund a staging wallet from your CEX → shield into RAILGUN via the Railway wallet interface → unshield to your anon review wallet → unwrap WETH if needed.',
      'Alternative: use Monero (XMR) as a privacy intermediary. Route funds through a non-custodial swap service (SideShift, FixedFloat) — CEX withdrawal → ETH → XMR → ETH → anon wallet.',
      'Never reuse deposit or receiving addresses. Generate a fresh address for each inbound transaction.',
    ],
  },
  {
    id: 'T4', label: 'FULL_GHOST_MODE', sub: 'Maximum deniability — nuclear option', icon: '◆', col: 'rgba(229,90,0,0.72)', threat: 'EXTREME', bg: 'rgba(229,90,0,0.04)', time: 'ongoing',
    steps: [
      'Dedicated device — purchased secondhand with cash, never signed into any account tied to your real identity, never connected to your home network.',
      'Boot from Tails OS on a live USB. Tails boots entirely into RAM, routes all traffic through Tor by default, and leaves zero forensic trace on the hardware after shutdown.',
      'Generate wallet keys while air-gapped — no network connection at all during key generation. Transfer the public address manually (write it down, type it in separately).',
      'Full operational stack: Tails OS → Tor → no-log VPN → RAILGUN-shielded funding → fresh wallet. Each layer independently defeats a different class of surveillance.',
      'Behavioral OPSEC — your writing is a fingerprint. Stylometric analysis can identify you from as few as 500 words. Do not write the way you normally write.',
      'Device and browser fingerprinting extends beyond IP. Canvas rendering, font enumeration, screen resolution, timezone, and WebGL signatures are all used to track users across sessions.',
      'Compartmentalize strictly: one review per target entity, one wallet per long-term persona, zero overlap between identities at any layer.',
    ],
  },
];

const CHECKLIST = [
  'VPN connected — IP leak test passed (ipleak.net or mullvad.net/check)',
  'Dedicated browser profile or private/incognito window only',
  'Review wallet loaded — not your main wallet, zero prior history',
  'Not on a work device or work network',
  'Not on a mobile device',
  'WebRTC disabled in browser settings',
  'Wallet extensions restricted to this browser profile only',
  'Site data cleared from previous session before reconnecting',
];

const FAILURE_MODES = [
  { mode: 'AGED_WALLET',         risk: 'CRITICAL', desc: 'Using a wallet with prior mainnet activity — even a single transaction links both identities via blockchain analytics.' },
  { mode: 'DIRECT_FUNDING',      risk: 'CRITICAL', desc: 'Sending ETH directly from a main wallet or KYC exchange to your anon wallet. The on-chain trail is immediately traceable.' },
  { mode: 'SHARED_VPN_SESSION',  risk: 'HIGH',     desc: 'Using the same VPN endpoint for both personal browsing and anonymous sessions in the same day.' },
  { mode: 'MOBILE_POST',         risk: 'HIGH',     desc: 'Posting from a phone. GPS history, push notification timestamps, device fingerprints persist regardless of VPN status.' },
  { mode: 'DNS_LEAK',            risk: 'HIGH',     desc: 'VPN connected but DNS not tunneled — DNS queries expose your site visits to your ISP. Run a DNS leak test on every new setup.' },
  { mode: 'LATE_DISCONNECT',     risk: 'MEDIUM',   desc: 'VPN connection dropped after wallet connected but before session ended. The submission IP is logged.' },
  { mode: 'STYLISTIC_OVERLAP',   risk: 'MEDIUM',   desc: 'Writing identically across personas. Stylometric tools need ~500 words of overlap to link identities.' },
  { mode: 'ADDRESS_REUSE',       risk: 'MEDIUM',   desc: 'Reusing deposit or receiving addresses when shielding via RAILGUN. Each reuse creates a traceable graph edge.' },
];

function OpsecPage() {
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const tier = TIERS.find(t => t.id === activeTier) ?? null;

  if (tier) {
    return (
      <div className="fi" style={{ animationDelay: '0.06s' }}>
        <button
          onClick={() => setActiveTier(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5, transition: 'opacity 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; }}
        >
          <span style={{ fontFamily: mono, fontSize: 15, color: 'rgba(210,188,152,0.55)', letterSpacing: '0.12em' }}>← [GUIDE]</span>
        </button>

        {(() => {
          const idx = TIERS.findIndex(t => t.id === tier.id);
          return <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(210,188,152,0.2)', letterSpacing: '0.14em', marginBottom: 16 }}>{`// TIER ${idx + 1}/${TIERS.length} — ${tier.threat}`}</div>;
        })()}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, letterSpacing: '0.18em', color: tier.col }}>{tier.id}</span>
          <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 500, color: 'rgba(220,204,172,0.8)', letterSpacing: '0.08em' }}>{tier.label}</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 15, color: 'rgba(210,188,152,0.25)', letterSpacing: '0.06em', fontStyle: 'italic', marginBottom: 32 }}>{tier.sub}</div>

        {(tier.id === 'T3' || tier.id === 'T4') && (
          <div style={{ marginBottom: 20, paddingLeft: 12, borderLeft: '2px solid rgba(212,90,90,0.3)', fontFamily: mono, fontSize: 14, color: 'rgba(212,90,90,0.55)', letterSpacing: '0.1em' }}>
            ⚠ JURISDICTION_DEPENDENT — verify tool legality before proceeding
          </div>
        )}

        <div style={{ height: 1, background: `${tier.col}18`, marginBottom: 28 }} />

        <div style={{ paddingLeft: 14, borderLeft: `1px solid ${tier.col}20`, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {tier.steps.map((step, si) => {
            const isAntiPattern = /^Never |^Do not /.test(step);
            return (
              <div key={si} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: mono, fontSize: 15, color: isAntiPattern ? 'rgba(212,90,90,0.65)' : tier.col, letterSpacing: '0.06em', flexShrink: 0, marginTop: 3, opacity: 0.85 }}>
                  {isAntiPattern ? '✗' : String(si + 1).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: inter, fontSize: 16, lineHeight: 1.72, color: isAntiPattern ? 'rgba(212,160,160,0.55)' : 'rgba(210,188,152,0.6)', fontWeight: 400, letterSpacing: '0.005em' }}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(210,188,152,0.05)' }}>
          {(() => {
            const idx = TIERS.findIndex(t => t.id === tier.id);
            const prev = TIERS[idx - 1];
            const next = TIERS[idx + 1];
            return (
              <>
                <div>{prev && (
                  <button onClick={() => setActiveTier(prev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.55, transition: 'opacity 0.15s', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.55'; }}
                  >
                    <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(210,188,152,0.4)', letterSpacing: '0.1em' }}>← PREV</div>
                    <div style={{ fontFamily: mono, fontSize: 15, color: prev.col, letterSpacing: '0.1em' }}>[{prev.id}] {prev.label}</div>
                  </button>
                )}</div>
                <div style={{ textAlign: 'right' }}>{next && (
                  <button onClick={() => setActiveTier(next.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.55, transition: 'opacity 0.15s', textAlign: 'right' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.55'; }}
                  >
                    <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(210,188,152,0.4)', letterSpacing: '0.1em' }}>NEXT →</div>
                    <div style={{ fontFamily: mono, fontSize: 15, color: next.col, letterSpacing: '0.1em' }}>[{next.id}] {next.label}</div>
                  </button>
                )}</div>
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="fi" style={{ animationDelay: '0.06s' }}>
      <SecHead label="OPSEC_GUIDE" />

      <div style={{ fontFamily: sans, fontSize: 17, lineHeight: 1.7, color: 'rgba(216,196,160,0.62)', marginBottom: 28, fontWeight: 400 }}>
        Anonymity is only as strong as the weakest step. Select a tier to view its setup guide.
      </div>

      {/* Pre-post checklist */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(107,159,212,0.4)', textTransform: 'uppercase' }}>{'// PRE_POST_CHECKLIST'}</div>
          <div style={{ fontFamily: mono, fontSize: 13, color: checked.size === CHECKLIST.length ? 'rgba(107,212,159,0.65)' : 'rgba(210,188,152,0.2)', letterSpacing: '0.1em', transition: 'color 0.2s' }}>
            {checked.size}/{CHECKLIST.length}
          </div>
        </div>
        {CHECKLIST.map((item, i) => {
          const on = checked.has(i);
          return (
            <div
              key={i}
              onClick={() => { const n = new Set(checked); on ? n.delete(i) : n.add(i); setChecked(n); }}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: on ? 1 : 0.55, transition: 'opacity 0.12s' }}
            >
              <span style={{ fontFamily: mono, fontSize: 16, color: on ? 'rgba(107,212,159,0.82)' : 'rgba(210,188,152,0.35)', flexShrink: 0, marginTop: 1, transition: 'color 0.12s' }}>{on ? '✓' : '○'}</span>
              <span style={{ fontFamily: sans, fontSize: 17, lineHeight: 1.55, color: on ? 'rgba(210,188,152,0.52)' : 'rgba(216,196,160,0.72)', textDecoration: on ? 'line-through' : 'none', textDecorationColor: 'rgba(210,188,152,0.2)', transition: 'color 0.12s' }}>{item}</span>
            </div>
          );
        })}
        {checked.size === CHECKLIST.length && (
          <div style={{ marginTop: 12, fontFamily: mono, fontSize: 14, color: 'rgba(107,212,159,0.45)', letterSpacing: '0.16em', textAlign: 'center' }}>{'// CLEARED_TO_POST'}</div>
        )}
      </div>

      {/* Tier rows — vertical descent */}
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        <div style={{
          position: 'absolute', left: 6, top: 0, bottom: 0,
          width: 1,
          background: 'linear-gradient(180deg, rgba(212,99,26,0) 0%, rgba(212,99,26,0.25) 10%, rgba(212,99,26,0.25) 90%, rgba(212,99,26,0) 100%)',
        }} />
        {TIERS.map((t, ti) => (
          <button
            key={t.id}
            onClick={() => setActiveTier(t.id)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '16px 0', textAlign: 'left', width: '100%',
              display: 'flex', alignItems: 'flex-start', gap: 16,
              position: 'relative',
              borderBottom: ti < TIERS.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).querySelector('.tier-arrow')?.setAttribute('style', 'opacity:1'); }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.75'; }}
          >
            {/* Node */}
            <div style={{
              position: 'absolute', left: -32, top: 20,
              width: 8, height: 8, borderRadius: '50%',
              background: bg,
              border: `1px solid ${t.col}`,
              boxShadow: `0 0 5px ${t.col}50`,
              flexShrink: 0,
            }} />

            <div style={{ flexShrink: 0, paddingTop: 1 }}>
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: t.col, opacity: 0.8 }}>{t.id}</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontFamily: sans, fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', color: 'rgba(220,204,172,0.88)' }}>{t.label}</span>
                <span style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.1em', color: t.col, opacity: 0.72, border: `1px solid ${t.col}40`, padding: '2px 6px', borderRadius: 1 }}>{t.threat}</span>
                {(t.id === 'T3' || t.id === 'T4') && <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(212,90,90,0.62)' }}>⚠</span>}
              </div>
              <div style={{ fontFamily: sans, fontSize: 16, color: 'rgba(210,188,152,0.52)', fontStyle: 'italic', letterSpacing: '0.01em' }}>{t.sub}</div>
            </div>

            <div style={{ fontFamily: mono, fontSize: 13, color: 'rgba(212,99,26,0.35)', flexShrink: 0, paddingTop: 2 }}>{t.steps.length} steps · {t.time} ›</div>
          </button>
        ))}
      </div>

    </div>
  );
}

// ─── Marquee transmission strip ───────────────────────────────────────────────
function MarqueeStrip({ entities, feed }: { entities: EntityRow[]; feed: FeedPost[] }) {
  const items: string[] = [];
  entities.forEach(e => {
    items.push(`${e.name.toUpperCase()} · ${e.count} transmissions`);
    items.push(`SIGNAL ${Math.round(e.sent * 100)}%`);
  });
  if (feed.length > 0) {
    feed.slice(0, 6).forEach(p => {
      if (p.entity && p.entity !== '—') items.push(`${p.entity.toUpperCase()} — ${p.confirms}✓`);
    });
  }
  // fallback — atmospheric only, no real company names until posts exist
  if (items.length === 0) {
    items.push(
      '◆ TRANSMISSION LAYER ACTIVE',
      'SIGNAL INTEGRITY — NOMINAL',
      '// awaiting first dispatches',
      'DEPTH — INITIALIZING',
      'ANONYMOUS — VERIFIED',
      '// end-to-end encrypted',
      'OPERATOR COUNT — CLASSIFIED',
      'UPLINK ESTABLISHED',
    );
  }
  const doubled = [...items, ...items];
  return (
    <div style={{
      overflow: 'hidden',
      borderBottom: '1px solid rgba(180,120,60,0.18)',
      borderTop: '1px solid rgba(180,120,60,0.12)',
      background: '#2A1A0A',
      height: 30,
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      zIndex: 90,
    }}>
      <div style={{
        display: 'flex',
        whiteSpace: 'nowrap',
        animation: 'loop-horizontal 60s linear infinite',
        willChange: 'transform',
      }}>
        {doubled.map((item, i) => (
          <span key={i} style={{
            fontFamily: mono,
            fontSize: 14,
            letterSpacing: '0.2em',
            color: i % 4 === 0 ? '#C8602A' : 'rgba(216,196,160,0.75)',
            paddingRight: 40,
            textTransform: 'uppercase',
          }}>
            {i % 6 === 0 ? '◆ ' : '· '}{item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar rail — icon strip, all content pop-out ─────────────────────────
function SidebarRail({ page, switchPage, walletDisplay, username, postCount, karma, signalAcc, entities, onSelectEntity }: {
  page: string; switchPage: (p: string) => void; walletDisplay: string;
  username: string; postCount: number; karma: number; signalAcc: number;
  entities: EntityRow[]; onSelectEntity: (name: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [entSearch, setEntSearch] = useState('');

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (id: string) => setOpen(prev => prev === id ? null : id);

  const IcoPerson = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="2.8" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
  const IcoSignal = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <polyline points="1.5,12 4.5,8 7.5,10 10.5,5 13.5,7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="13.5" cy="7.5" r="1.2" fill="currentColor"/>
    </svg>
  );
  const IcoGrid = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="2" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="2" y="9" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="9" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
  const IcoShield = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L13.5 4V8c0 3.2-2.7 5.1-5.5 5.9C5.2 13.1 2.5 11.2 2.5 8V4L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const IcoCompass = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M10 6l-1.5 3.5L5 10l1.5-3.5L10 6Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  );
  // Basin icon: water drop / pool
  const IcoBasin = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 2C8 2 3 7.5 3 10.5a5 5 0 0 0 10 0C13 7.5 8 2 8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5.5 11.5c.5 1.2 1.5 1.8 2.5 1.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );

  const panel: React.CSSProperties = {
    position: 'absolute', top: 0, right: 44,
    width: 244,
    background: 'rgba(16,16,18,0.98)',
    border: '1px solid rgba(216,196,160,0.08)',
    borderRadius: 2,
    boxShadow: '0 8px 48px rgba(0,0,0,0.72), 0 0 0 1px rgba(212,99,26,0.05)',
    backdropFilter: 'blur(20px)',
    padding: '14px 14px',
    zIndex: 200,
    animation: 'fadeIn 0.13s ease',
  };

  const railBtn = (id: string): React.CSSProperties => ({
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: open === id ? 'rgba(212,99,26,0.09)' : 'transparent',
    border: `1px solid ${open === id ? 'rgba(212,99,26,0.28)' : 'rgba(216,196,160,0.07)'}`,
    borderRadius: 2,
    cursor: 'pointer',
    color: open === id ? celadon : 'rgba(216,196,160,0.3)',
    transition: 'all 0.14s',
    padding: 0,
  });

  const navBtn = (id: string): React.CSSProperties => ({
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: page === id ? 'rgba(212,99,26,0.06)' : 'transparent',
    border: `1px solid ${page === id ? 'rgba(212,99,26,0.22)' : 'rgba(216,196,160,0.07)'}`,
    borderRadius: 2,
    cursor: 'pointer',
    color: page === id ? celadon : 'rgba(216,196,160,0.3)',
    transition: 'all 0.14s',
    padding: 0,
  });

  const hover = (e: React.MouseEvent, on: boolean, active: boolean) => {
    if (active) return;
    const el = e.currentTarget as HTMLElement;
    el.style.borderColor = on ? 'rgba(216,196,160,0.16)' : 'rgba(216,196,160,0.07)';
    el.style.color = on ? 'rgba(216,196,160,0.68)' : 'rgba(216,196,160,0.3)';
  };

  const statCell = (label: string, val: string | number, col: string) => (
    <div key={label} style={{ padding: '8px 10px', background: 'rgba(216,196,160,0.02)', border: '1px solid rgba(216,196,160,0.05)', borderRadius: 1 }}>
      <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.2em', color: 'rgba(216,196,160,0.28)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 600, color: col }}>{val}</div>
    </div>
  );

  const filtEnt = entities.filter(e => e.name.toLowerCase().includes(entSearch.toLowerCase()));

  return (
    <div ref={railRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, paddingTop: 4, position: 'relative' }}>

      {/* ── Explore nav */}
      <button style={navBtn('explore')} title="Explore" onClick={() => { switchPage('explore'); setOpen(null); }}
        onMouseEnter={e => hover(e, true, page === 'explore')} onMouseLeave={e => hover(e, false, page === 'explore')}>
        <IcoCompass />
      </button>

      {/* ── Operator pop-out */}
      <div style={{ position: 'relative' }}>
        <button style={railBtn('operator')} title="Operator" onClick={() => toggle('operator')}
          onMouseEnter={e => hover(e, true, open === 'operator')} onMouseLeave={e => hover(e, false, open === 'operator')}>
          <IcoPerson />
        </button>
        {open === 'operator' && (
          <div style={panel}>
            <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(212,99,26,0.42)', textTransform: 'uppercase', marginBottom: 12 }}>{'// OPERATOR'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(216,196,160,0.06)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 2, background: 'rgba(212,99,26,0.07)', border: '1px solid rgba(212,99,26,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 17, fontStyle: 'italic', color: celadon, flexShrink: 0 }}>κ</div>
              <div>
                <div style={{ fontFamily: mono, fontSize: 15, color: celadon, letterSpacing: '0.05em' }}>{username || '—'}</div>
                <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.26)', letterSpacing: '0.06em', marginTop: 2 }}>{walletDisplay}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {statCell('POSTS', postCount, text1)}
              {statCell('KARMA', karma.toLocaleString(), karma > 0 ? celadon : 'rgba(216,196,160,0.3)')}
              {statCell('SIGNAL_ACC', signalAcc > 0 ? `${signalAcc}%` : '—', sigBlue)}
              {statCell('STANDING', karma > 500 ? 'HIGH' : karma > 100 ? 'MED' : 'NEW', karma > 500 ? celadon : karma > 100 ? sigGold : 'rgba(216,196,160,0.28)')}
            </div>
          </div>
        )}
      </div>

      {/* ── Signal pop-out */}
      <div style={{ position: 'relative' }}>
        <button style={railBtn('signal')} title="Live signal" onClick={() => toggle('signal')}
          onMouseEnter={e => hover(e, true, open === 'signal')} onMouseLeave={e => hover(e, false, open === 'signal')}>
          <IcoSignal />
        </button>
        {open === 'signal' && (
          <div style={panel}>
            <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(77,166,232,0.5)', textTransform: 'uppercase', marginBottom: 10 }}>{'// LIVE_SIGNAL'}</div>
            {entities.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: 13, color: 'rgba(216,196,160,0.2)', letterSpacing: '0.06em', padding: '8px 0', animation: 'pd 2s ease infinite' }}>loading entities…</div>
            ) : (
              entities.slice(0, 7).map(e => {
                const pct = Math.round(e.sent * 100);
                const col = pct >= 60 ? sigBlue : pct < 40 ? sigRed : 'rgba(216,196,160,0.28)';
                const barCol = pct >= 60 ? 'rgba(77,166,232,0.4)' : 'rgba(229,90,0,0.35)';
                return (
                  <div key={e.name} onClick={() => { onSelectEntity(e.name); setOpen(null); }}
                    style={{ padding: '7px 0', borderBottom: '1px solid rgba(216,196,160,0.04)', cursor: 'pointer' }}
                    onMouseEnter={el => { (el.currentTarget as HTMLElement).style.opacity = '0.72'; }}
                    onMouseLeave={el => { (el.currentTarget as HTMLElement).style.opacity = '1'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.6)', letterSpacing: '0.03em' }}>{e.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: col }}>{pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: 1.5, background: 'rgba(216,196,160,0.05)', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: barCol, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Entities pop-out */}
      <div style={{ position: 'relative' }}>
        <button style={railBtn('entities')} title="Entities" onClick={() => toggle('entities')}
          onMouseEnter={e => hover(e, true, open === 'entities')} onMouseLeave={e => hover(e, false, open === 'entities')}>
          <IcoGrid />
        </button>
        {open === 'entities' && (
          <div style={{ ...panel, maxHeight: 420, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(216,196,160,0.35)', textTransform: 'uppercase', marginBottom: 8 }}>{'// ENTITIES'}</div>
            <input
              value={entSearch}
              onChange={e => setEntSearch(e.target.value)}
              placeholder="filter…"
              style={{ width: '100%', padding: '5px 0', border: 'none', borderBottom: '1px solid rgba(216,196,160,0.07)', background: 'transparent', color: text1, fontSize: 14, fontFamily: mono, outline: 'none', marginBottom: 8, letterSpacing: '0.04em' }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(212,99,26,0.28)'; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(216,196,160,0.07)'; }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtEnt.map(e => {
                const pct = Math.round(e.sent * 100);
                const col = pct >= 60 ? sigBlue : pct < 40 ? sigRed : 'rgba(216,196,160,0.28)';
                return (
                  <div key={e.name} onClick={() => { onSelectEntity(e.name); setOpen(null); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(216,196,160,0.04)', cursor: 'pointer', transition: 'opacity 0.12s' }}
                    onMouseEnter={el => { (el.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                    onMouseLeave={el => { (el.currentTarget as HTMLElement).style.opacity = '1'; }}>
                    <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.62)', letterSpacing: '0.03em' }}>{e.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: mono, fontSize: 14, color: 'rgba(216,196,160,0.2)', letterSpacing: '0.04em' }}>{e.count}</span>
                      <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: col }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
              {filtEnt.length === 0 && <div style={{ fontFamily: mono, fontSize: 13, color: 'rgba(216,196,160,0.2)', padding: '8px 0', letterSpacing: '0.06em' }}>no match</div>}
            </div>
          </div>
        )}
      </div>

      {/* ── Basin nav */}
      <div style={{ marginTop: 8 }}>
        <button style={navBtn('basin')} title="The Basin" onClick={() => { switchPage('basin'); setOpen(null); }}
          onMouseEnter={e => hover(e, true, page === 'basin')} onMouseLeave={e => hover(e, false, page === 'basin')}>
          <IcoBasin />
        </button>
      </div>

      {/* ── OPSEC nav */}
      <div style={{ marginTop: 4 }}>
        <button style={navBtn('privacy')} title="OPSEC / Privacy" onClick={() => { switchPage('privacy'); setOpen(null); }}
          onMouseEnter={e => hover(e, true, page === 'privacy')} onMouseLeave={e => hover(e, false, page === 'privacy')}>
          <IcoShield />
        </button>
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { address, status: wagmiStatus } = useAccount();
  const { disconnect } = useDisconnect();
  const { user: ctxUser, sessionToken, changeUsername, signingIn } = useUser();

  const walletDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????...????';
  const username = ctxUser?.username || 'anon_00000000';
  const karma    = ctxUser?.karma    || 0;
  const joined   = ctxUser?.created_at
    ? new Date(ctxUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()
    : '—';

  const [editing,         setEditing]        = useState(false);
  const [draft,           setDraft]          = useState('');
  const [editError,       setEditError]      = useState('');
  const isUpdating = useRef(false);
  const [search,          setSearch]         = useState('');
  const [page,            setPage]           = useState('feed');
  const [uMenu,           setUMenu]          = useState(false);
  const [wMenu,           setWMenu]          = useState(false);
  const [votes,           setVotes]          = useState<Record<string, string | null>>({});
  const [ready,           setReady]          = useState(false);
  const [scrollY,         setScrollY]        = useState(0);
  const [transitioning,   setTransitioning]  = useState(false);
  const [contentKey,      setContentKey]     = useState(0);
  const [showComposer,    setShowComposer]   = useState(false);
  const [selectedEntity,  setSelectedEntity]  = useState<string | null>(null);
  const [feed,            setFeed]           = useState<FeedPost[]>([]);
  const [entities,        setEntities]       = useState<EntityRow[]>([]);
  const [leaders,         setLeaders]        = useState<LeaderRow[]>([]);
  const [postCount,       setPostCount]      = useState(0);
  const [feedError,       setFeedError]      = useState(false);
  const [feedLoading,     setFeedLoading]    = useState(false);
  const [voteError,       setVoteError]      = useState<string | null>(null);
  const [navBorder,       setNavBorder]      = useState(false);

  const uRef = useRef<HTMLDivElement>(null);
  const wRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (ready && !address && wagmiStatus !== 'connecting' && wagmiStatus !== 'reconnecting') router.push('/');
  }, [address, ready, router, wagmiStatus]);

  useEffect(() => {
    if (!address) return;
    setFeedLoading(true); setFeedError(false);
    getPosts()
      .then(data => { if (data.length > 0 || process.env.NODE_ENV !== 'development') setFeed(data); })
      .catch(() => setFeedError(true))
      .finally(() => setFeedLoading(false));
    getEntities().then(data => { if (data.length > 0 || process.env.NODE_ENV !== 'development') setEntities(data); }).catch(console.error);
    getLeaderboard().then(data => { if (data.length > 0 || process.env.NODE_ENV !== 'development') setLeaders(data); }).catch(console.error);
  }, [address]);

  useEffect(() => {
    if (!ctxUser?.id) return;
    getUserStats(ctxUser.id).then(s => setPostCount(s.postCount)).catch(console.error);
  }, [ctxUser?.id]);

  useEffect(() => {
    const s = () => {
      setScrollY(window.scrollY);
      setNavBorder(window.scrollY > 10);
    };
    window.addEventListener('scroll', s, { passive: true });
    return () => window.removeEventListener('scroll', s);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (uRef.current && !uRef.current.contains(e.target as Node)) { setUMenu(false); setEditing(false); }
      if (wRef.current && !wRef.current.contains(e.target as Node)) setWMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const vote = async (id: string, t: string) => {
    if (!sessionToken) return;
    const prevVotes = votes;
    const prevFeed  = feed;
    const newVote   = votes[id] === t ? null : t;
    setVotes(p => ({ ...p, [id]: newVote }));
    const voteType = t === 'confirm' ? 'up' : 'down';
    try {
      const data = await createVote(sessionToken, id, voteType as 'up' | 'down');
      setFeed(f => f.map(p => {
        if (String(p.id) !== id) return p;
        if (t === 'confirm') return { ...p, confirms: data.new_count };
        return { ...p, disputes: data.new_count };
      }));
      setVoteError(null);
    } catch (err: unknown) {
      setVotes(prevVotes);
      setFeed(prevFeed);
      const msg = err instanceof Error ? err.message : 'vote failed';
      setVoteError(msg.includes('opposite') ? 'already voted opposite direction' : 'vote failed');
      setTimeout(() => setVoteError(null), 2500);
    }
  };

  const switchPage = useCallback((next: string) => {
    if (next === page || transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setPage(next);
      setContentKey(k => k + 1);
      setTransitioning(false);
    }, 160);
  }, [page, transitioning]);

  const dd: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    background: bg3, border: `1px solid ${border}`,
    borderRadius: 2, padding: 4, boxShadow: '0 24px 56px rgba(0,0,0,0.96)', zIndex: 200,
  };

  const depthVal = Math.floor(scrollY * 0.4);
  const signalAcc = karma > 0 ? Math.min(99, Math.round(55 + (karma / 200))) : 0;

  return (
    <>
      <style>{`
        @keyframes fi { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pd { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
        .fi { animation: fi 0.42s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
        @keyframes logoRock {
          0%,100% { transform: rotateX(0deg)    rotateY(0deg);   }
          25%     { transform: rotateX(2deg)    rotateY(-3deg);  }
          50%     { transform: rotateX(-1deg)   rotateY(3deg);   }
          75%     { transform: rotateX(1.5deg)  rotateY(-2deg);  }
        }

        @keyframes copperBreath {
          0%, 100% {
            text-shadow:
              1px 1px 0 rgba(80,20,0,0.88),
              2px 2px 0 rgba(50,10,0,0.58),
              3px 3px 0 rgba(30,5,0,0.34),
              0 0 10px rgba(200,96,42,0.54),
              0 0 28px rgba(200,96,42,0.22);
          }
          50% {
            text-shadow:
              1px 1px 0 rgba(80,20,0,0.88),
              2px 2px 0 rgba(50,10,0,0.58),
              3px 3px 0 rgba(30,5,0,0.34),
              0 0 20px rgba(200,96,42,0.92),
              0 0 52px rgba(200,96,42,0.44),
              0 0 96px rgba(200,96,42,0.18);
          }
        }

        @keyframes copperPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(200,96,42,0.22), 0 0 0 1px rgba(200,96,42,0.24); }
          50%       { box-shadow: 0 0 26px rgba(200,96,42,0.52), 0 0 0 1px rgba(200,96,42,0.55); }
        }

        @keyframes emberDot {
          0%, 100% { box-shadow: 0 0 4px rgba(200,96,42,0.55);  opacity: 0.88; }
          50%       { box-shadow: 0 0 12px rgba(200,96,42,0.95), 0 0 22px rgba(200,96,42,0.38); opacity: 1; }
        }

        @keyframes warmFlicker {
          0%,100% { opacity: 1; }
          30%     { opacity: 0.96; }
          60%     { opacity: 0.98; }
        }

        .copper-glow { animation: copperPulse  3s ease-in-out infinite; }
        .ember-dot   { animation: emberDot     2.4s ease-in-out infinite; }
        .warm-text   { animation: warmFlicker  5s ease-in-out infinite; }
      `}</style>

      {/* SVG chalk filter — hidden, referenced by filter: url(#chalk-filter) */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {/* Chalk / fired-clay filter — rough edges, matte, warm */}
          <filter id="chalk-filter" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.042 0.06" numOctaves="4" seed="12" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
            <feComposite in="displaced" in2="SourceGraphic" operator="in" result="clipped"/>
            <feMorphology operator="erode" radius="0.25" in="clipped" result="eroded"/>
            <feBlend in="clipped" in2="eroded" mode="normal" result="blended"/>
            {/* Warm the colour matrix — slight red/amber lift, desaturate slightly */}
            <feColorMatrix type="matrix"
              values="1.04 0    0    0  0.02
                      0    0.96 0    0  0
                      0    0    0.88 0  0
                      0    0    0    1  0"
              in="blended"/>
          </filter>
        </defs>
      </svg>

      <div style={{ minHeight: '100vh', background: bg, color: text1, fontFamily: sans, fontSize: 17, opacity: ready ? 1 : 0, transition: 'opacity 0.4s' }}>

        {/* Depth meter */}
        <div style={{
          position: 'fixed', bottom: 16, left: 18, zIndex: 50,
          opacity: scrollY > 20 ? 1 : 0,
          transition: 'opacity 0.5s',
          perspective: '300px',
        }}>
          <div style={{
            fontFamily: mono, fontSize: 13, letterSpacing: '0.18em',
            color: 'rgba(212,99,26,0.28)',
            transform: 'perspective(300px) rotateX(22deg) rotateY(-8deg) translateZ(0px)',
            transformOrigin: 'bottom left',
            textShadow: '0 2px 6px rgba(212,99,26,0.18), 0 4px 14px rgba(212,99,26,0.08)',
            lineHeight: 1,
          }}>
            βάθος
          </div>
          <div style={{
            fontFamily: mono, fontSize: 18, fontWeight: 600, letterSpacing: '0.14em',
            color: 'rgba(212,99,26,0.45)',
            transform: 'perspective(300px) rotateX(14deg) rotateY(-8deg) translateZ(4px)',
            transformOrigin: 'bottom left',
            textShadow: '0 3px 8px rgba(212,99,26,0.22), 0 0 20px rgba(212,99,26,0.08)',
            lineHeight: 1,
            marginTop: 2,
          }}>
            {depthVal}<span style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.2em', marginLeft: 3 }}>m</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', height: 52,
          background: 'rgba(12,8,6,0.92)', backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${navBorder ? 'rgba(200,140,60,0.12)' : 'transparent'}`,
          transition: 'border-color 0.4s ease',
          overflow: 'hidden',
        }}>

          {/* Left: logo */}
          <Suspense fallback={<div style={{ width: 72, height: 42 }} />}>
            <KataLogoMarble size="nav" />
          </Suspense>

          {/* Center: tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['feed', 'explore', 'ranks', 'about', 'privacy'] as const).map(t => {
              const isActive = page === t;
              const label = t === 'privacy' ? 'OpSec' : t === 'feed' ? 'Signals' : t === 'explore' ? 'Explore' : t === 'ranks' ? 'Ranks' : 'About';
              return (
                <button
                  key={t}
                  onClick={() => switchPage(t)}
                  style={{
                    position: 'relative', padding: '0 14px', height: 52,
                    fontFamily: sans, fontSize: 17, fontWeight: isActive ? 600 : 400,
                    border: 'none',
                    borderRadius: 0, cursor: 'pointer',
                    /* inset shadow — contained within button, can never bleed outside nav */
                    boxShadow: isActive ? `inset 0 -2px 0 ${celadon}` : 'none',
                    transition: 'color 0.14s, box-shadow 0.14s',
                    background: 'transparent',
                    color: isActive ? text1 : 'rgba(216,196,160,0.52)',
                    letterSpacing: '-0.005em',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(216,196,160,0.82)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(216,196,160,0.52)'; }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Right: wallet + user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Wallet */}
            <div ref={wRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setWMenu(!wMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 1, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', fontFamily: mono, fontSize: 13, color: 'rgba(216,196,160,0.38)', letterSpacing: '0.06em', transition: 'all 0.14s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(216,196,160,0.14)'; el.style.color = 'rgba(216,196,160,0.68)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = border; el.style.color = 'rgba(216,196,160,0.38)'; }}
              >
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: celadon, boxShadow: `0 0 5px rgba(212,99,26,0.5)`, animation: 'pd 2s ease infinite', flexShrink: 0 }} />
                {walletDisplay}
              </button>
              {wMenu && (
                <div className="fi" style={{ ...dd, minWidth: 200 }}>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(224,210,185,0.28)', marginBottom: 8 }}>Wallet</div>
                    <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(224,210,185,0.5)', letterSpacing: '0.04em' }}>{walletDisplay}</div>
                  </div>
                  <div style={{ height: 1, background: border, margin: '3px 8px' }} />
                  <button
                    onClick={() => { disconnect(); setWMenu(false); }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: 2, fontFamily: inter, fontSize: 16, color: 'rgba(248,113,113,0.6)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* User */}
            <div ref={uRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUMenu(!uMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 1, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', transition: 'all 0.14s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(216,196,160,0.14)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = border; }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 2, background: 'rgba(212,99,26,0.08)', border: '1px solid rgba(212,99,26,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 15, fontStyle: 'italic', color: celadon }}>κ</div>
                <span style={{ fontFamily: mono, fontSize: 13, color: 'rgba(216,196,160,0.5)', letterSpacing: '0.06em' }}>{username}</span>
              </button>
              {uMenu && (
                <div className="fi" style={{ ...dd, minWidth: 240 }}>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(224,210,185,0.28)', marginBottom: 8 }}>Identity</div>
                    {editing ? (
                      <div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <input
                            value={draft}
                            onChange={e => { setDraft((e.target as HTMLInputElement).value); setEditError(''); }}
                            onKeyDown={e => { if (e.key === 'Enter' && draft.trim().length >= 3 && !isUpdating.current) { isUpdating.current = true; changeUsername(draft).then(() => { setEditing(false); setEditError(''); }).catch(err => setEditError(friendlyError(err))).finally(() => { isUpdating.current = false; }); } }}
                            autoFocus maxLength={24}
                            style={{ flex: 1, padding: '6px 9px', borderRadius: 1, border: `1px solid ${editError ? 'rgba(229,90,0,0.4)' : 'rgba(212,99,26,0.28)'}`, background: 'rgba(216,196,160,0.03)', color: text1, fontSize: 15, fontFamily: mono, outline: 'none' }}
                          />
                          <button
                            onClick={() => { if (draft.trim().length >= 3 && !isUpdating.current) { isUpdating.current = true; changeUsername(draft).then(() => { setEditing(false); setEditError(''); }).catch(err => setEditError(friendlyError(err))).finally(() => { isUpdating.current = false; }); } }}
                            style={{ padding: '6px 12px', borderRadius: 1, border: 'none', background: 'rgba(212,99,26,0.15)', color: celadon, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: mono, letterSpacing: '0.08em' }}
                          >Save</button>
                        </div>
                        {editError && <div style={{ fontFamily: inter, fontSize: 15, color: 'rgba(248,113,113,0.75)', marginTop: 6 }}>{editError}</div>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: mono, fontSize: 14, color: celadon, letterSpacing: '0.06em' }}>{username}</span>
                        <button onClick={() => { setDraft(username); setEditing(true); }} style={{ padding: '3px 8px', borderRadius: 1, border: `1px solid ${border}`, background: 'none', color: 'rgba(216,196,160,0.28)', fontSize: 13, cursor: 'pointer', fontFamily: mono, transition: 'all 0.14s' }}>Edit</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </nav>

        {/* Marquee strip */}
        <MarqueeStrip entities={entities} feed={feed} />

        {/* Main grid */}
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 28px 100px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 48, position: 'relative', zIndex: 1 }}>

          {/* Left column */}
          <div style={{ opacity: transitioning ? 0 : 1, transform: transitioning ? 'perspective(900px) rotateX(8deg) translateY(8px)' : 'perspective(900px) rotateX(0deg) translateY(0)', transformOrigin: 'top center', transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            <div key={contentKey}>
              {page === 'feed'    && <FeedPage feed={feed} votes={votes} vote={vote} onCompose={() => { if (ctxUser?.id) setShowComposer(true); }} selectedEntity={selectedEntity} onClearEntity={() => setSelectedEntity(null)} loading={feedLoading} error={feedError} />}
              {page === 'explore' && <ExplorePage entities={entities} search={search} setSearch={setSearch} onSelectEntity={(name) => { setSelectedEntity(name); switchPage('feed'); }} />}
              {page === 'ranks'   && <RanksPage leaders={leaders} username={username} />}
              {page === 'about'   && (
                <div className="fi" style={{ animationDelay: '0.06s' }}>
                  <SecHead label="About" />
                  <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 33, color: 'rgba(224,210,185,0.85)', lineHeight: 1.25, marginBottom: 32, letterSpacing: '-0.01em' }}>
                    &ldquo;Every organization produces two versions of itself.&rdquo;
                  </div>
                  <div style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.9, color: 'rgba(224,210,185,0.55)', fontWeight: 400, marginBottom: 28 }}>
                    <p style={{ marginBottom: 16 }}>κατάβασις — the descent. Anonymous intelligence from inside organizations. Corporations, government agencies, state departments, regulators, contractors — any entity that shapes the world but controls what&apos;s known about its interior.</p>
                    <p style={{ marginBottom: 16 }}>Connect a wallet. Sign a message. Your public address is one-way hashed into an anonymous ID — the hash is on-chain, the wallet behind it is not.</p>
                    <p>This is a space for employees, contractors, whistleblowers, and insiders who want the truth known. Nothing more.</p>
                  </div>

                  <div style={{ height: 1, background: border, marginBottom: 32 }} />
                  <SecHead label="Information asymmetry" mb={14} />
                  <div style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.9, color: 'rgba(224,210,185,0.55)', fontWeight: 400, marginBottom: 28 }}>
                    <p style={{ marginBottom: 16 }}>Every organization produces two versions of itself. The public version — press releases, job postings, investor decks. And the real version — what employees know, what contractors have seen.</p>
                    <p style={{ marginBottom: 16 }}>That gap is information asymmetry. It advantages the institution over the individual. kataBased exists to close it.</p>
                    <p style={{ fontFamily: mono, fontSize: 13, color: 'rgba(212,99,26,0.35)', letterSpacing: '0.16em' }}>anonymous · verified · permanent · on-chain</p>
                  </div>

                  <div style={{ height: 1, background: border, marginBottom: 32 }} />
                  <SecHead label="Data API" mb={14} />
                  <div style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.9, color: 'rgba(224,210,185,0.55)', fontWeight: 400, marginBottom: 28 }}>
                    <p style={{ marginBottom: 16 }}>Aggregated company sentiment data is available via API for research and due diligence. Delayed public data is free. Real-time feeds require a paid subscription.</p>
                    <p style={{ fontFamily: mono, fontSize: 13, color: 'rgba(212,99,26,0.28)', letterSpacing: '0.1em' }}>API access: contact via on-chain message to the kataBased treasury address.</p>
                  </div>

                  <div style={{ height: 1, background: border, marginBottom: 32 }} />
                  <SecHead label="Prediction markets" mb={14} />
                  <div style={{ fontFamily: inter, fontSize: 17, lineHeight: 1.9, color: 'rgba(224,210,185,0.55)', fontWeight: 400 }}>
                    <p style={{ marginBottom: 16 }}>Every post on kataBased is a signal. Signals should be priceable. Posts about an entity&apos;s internal health are leading indicators — the kind of information that moves before markets, elections, or investigations do.</p>
                    <div style={{ marginTop: 20, paddingLeft: 16, borderLeft: `2px solid rgba(201,168,76,0.28)` }}>
                      <p style={{ fontFamily: sans, fontSize: 17, fontWeight: 400, color: sigGold, margin: 0, lineHeight: 1.6 }}>Every insider transmission is a leading indicator. Soon it will be priceable.</p>
                      <p style={{ fontFamily: mono, fontSize: 14, color: 'rgba(201,168,76,0.38)', letterSpacing: '0.12em', margin: '8px 0 0' }}>on the roadmap — data model built for this from day one</p>
                    </div>
                  </div>
                </div>
              )}
              {page === 'privacy' && <OpsecPage />}
              {page === 'basin'   && (
                <Suspense fallback={null}>
                  <BasinPage />
                </Suspense>
              )}
            </div>
          </div>

          {/* Sidebar — icon rail, everything pop-out */}
          <SidebarRail
            page={page}
            switchPage={switchPage}
            walletDisplay={walletDisplay}
            username={username}
            postCount={postCount}
            karma={karma}
            signalAcc={signalAcc}
            entities={entities}
            onSelectEntity={(name) => { setSelectedEntity(name); switchPage('feed'); }}
          />
        </div>
      </div>

      {signingIn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,11,0.95)', backdropFilter: 'blur(24px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: celadon, boxShadow: `0 0 14px rgba(212,99,26,0.7)`, animation: 'pd 1s ease infinite', margin: '0 auto 20px' }} />
            <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.22em', color: 'rgba(212,99,26,0.55)', marginBottom: 10, textTransform: 'uppercase' }}>Verifying identity</div>
            <div style={{ fontFamily: sans, fontSize: 16, color: 'rgba(216,196,160,0.35)', lineHeight: 1.7 }}>
              Check your wallet.<br />
              <span style={{ fontSize: 15, opacity: 0.6 }}>Sign the message to prove ownership. No gas.</span>
            </div>
          </div>
        </div>
      )}

      {voteError && (
        <div style={{ position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 350, fontFamily: mono, fontSize: 13, color: 'rgba(229,90,0,0.9)', background: 'rgba(10,10,11,0.96)', border: '1px solid rgba(229,90,0,0.18)', borderRadius: 2, padding: '8px 18px', backdropFilter: 'blur(16px)', pointerEvents: 'none', letterSpacing: '0.1em' }}>
          {voteError}
        </div>
      )}

      {showComposer && (
        <ComposerModal
          sessionToken={sessionToken ?? ''}
          onPostCreated={(p) => setFeed(prev => [p, ...prev])}
          onClose={() => setShowComposer(false)}
        />
      )}
    </>
  );
}
