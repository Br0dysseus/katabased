'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useUser } from '@/lib/UserContext';

// ─── Typography / colour constants ───────────────────────────────────────────
const serif    = "'Cormorant Garamond','Georgia',serif";
const sans     = "'Outfit',sans-serif";
const mono     = "'JetBrains Mono',monospace";
const green    = '#22a83a';
const greenDim = 'rgba(34,168,58,0.35)';
const lbl: React.CSSProperties = {
  fontFamily: mono, fontSize: 9, fontWeight: 500,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.18)',
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const FEED = [
  { id: 1, author: 'anon_19283746', company: 'Coinbase',      title: 'engineering culture is cooked post-layoffs',          content: 'After the restructuring, the team dynamic changed. More pressure, less psychological safety. Middle management is stretched thin and sprint planning is a mess.',                  upvotes: 142, downvotes: 18, comments: 34,  time: '2h'  },
  { id: 2, author: 'anon_55839201', company: 'Chainalysis',   title: 'good benefits, zero upward mobility',                 content: "Solid comp, good WLB, but promotions are completely opaque. If you want stability and interesting blockchain forensics work it's fine. Don't expect to climb.",         upvotes: 89,  downvotes: 7,  comments: 12,  time: '5h'  },
  { id: 3, author: 'anon_77201938', company: 'OpenSea',       title: 'the Seaport pivot split the company in half',         content: "Protocol team is doing genuinely interesting work. Product side feels directionless. Two very different experiences depending on which org you're in.",                    upvotes: 211, downvotes: 31, comments: 67,  time: '8h'  },
  { id: 4, author: 'anon_33018274', company: 'Uniswap Labs',  title: 'best smart contract engineers in DeFi',               content: "Technical bar is extremely high. If you can keep up you'll learn more in six months than three years elsewhere. Compensation is top of market.",                        upvotes: 304, downvotes: 12, comments: 45,  time: '12h' },
  { id: 5, author: 'anon_99182736', company: 'Alchemy',       title: 'sales-driven culture wearing an engineering costume', content: 'Marketing is great, actual DX of the product is falling behind. Internal tooling is held together with duct tape. Nobody wants to hear it.',                           upvotes: 178, downvotes: 44, comments: 91,  time: '1d'  },
  { id: 6, author: 'anon_44102938', company: 'Paradigm',      title: 'if you get in, never leave',                          content: 'Best research environment in crypto. The people are genuinely world-class. Only downside is the pressure to publish and the hours during market events.',                  upvotes: 523, downvotes: 8,  comments: 112, time: '2d'  },
];

const LEADERS = [
  { rank: 1, user: 'anon_00128374', karma: 12840, posts: 156 },
  { rank: 2, user: 'anon_55291037', karma: 9720,  posts: 98  },
  { rank: 3, user: 'anon_33018274', karma: 8430,  posts: 87  },
  { rank: 4, user: 'anon_77201938', karma: 6210,  posts: 64  },
  { rank: 5, user: 'anon_95410276', karma: 847,   posts: 23  },
];

const COS = [
  { name: 'Coinbase',     count: 342, sent: 0.62 },
  { name: 'Uniswap Labs', count: 189, sent: 0.84 },
  { name: 'OpenSea',      count: 276, sent: 0.51 },
  { name: 'Alchemy',      count: 134, sent: 0.45 },
  { name: 'Chainalysis',  count: 98,  sent: 0.73 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KataLogo({ size = 'nav' }: { size?: 'nav' | 'large' }) {
  const isLarge = size === 'large';
  return (
    <div style={{ fontFamily: serif, fontWeight: 700, fontStyle: 'italic', fontSize: isLarge ? 44 : 26, lineHeight: 1, letterSpacing: '-0.04em', userSelect: 'none', display: 'flex', alignItems: 'baseline' }}>
      <span style={{ color: green }}>κ</span>
      <span style={{ color: '#fff', marginLeft: isLarge ? 2 : 1 }}>β</span>
    </div>
  );
}

function KeyboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <line x1="6" y1="8" x2="6" y2="8" strokeWidth="2" /><line x1="10" y1="8" x2="10" y2="8" strokeWidth="2" /><line x1="14" y1="8" x2="14" y2="8" strokeWidth="2" /><line x1="18" y1="8" x2="18" y2="8" strokeWidth="2" />
      <line x1="6" y1="12" x2="6" y2="12" strokeWidth="2" /><line x1="10" y1="12" x2="10" y2="12" strokeWidth="2" /><line x1="14" y1="12" x2="14" y2="12" strokeWidth="2" /><line x1="18" y1="12" x2="18" y2="12" strokeWidth="2" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function CragBackground({ scrollY }: { scrollY: number }) {
  const crags = useMemo(() => {
    const seed = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const left: any[] = [], right: any[] = [];
    for (let i = 0; i < 30; i++) {
      left.push({ y: i * 140, indent: 10 + seed(i * 3) * 12, width: 25 + seed(i * 7) * 35, height: 1 + seed(i * 11) * 2, opacity: 0.01 + seed(i * 13) * 0.015, parallax: 0.02 + seed(i * 17) * 0.04 });
      right.push({ y: i * 140 + 70, indent: 10 + seed(i * 5 + 1) * 12, width: 25 + seed(i * 9 + 1) * 35, height: 1 + seed(i * 11 + 1) * 2, opacity: 0.01 + seed(i * 13 + 1) * 0.015, parallax: 0.02 + seed(i * 19 + 1) * 0.04 });
    }
    const leftEdge: any[] = [], rightEdge: any[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      leftEdge.push({ y: t, x: 0.04 + seed(i * 31) * 0.06 + Math.sin(t * 10 + seed(i) * 5) * 0.02 });
      rightEdge.push({ y: t, x: 0.96 - seed(i * 37) * 0.06 - Math.sin(t * 9 + seed(i + 50) * 4) * 0.02 });
    }
    return { left, right, leftEdge, rightEdge };
  }, []);

  const leftPath  = crags.leftEdge.map((p: any, i: number)  => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ') + ' L 0 100 L 0 0 Z';
  const rightPath = crags.rightEdge.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ') + ' L 100 100 L 100 0 Z';

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, transform: `translateY(${scrollY * 0.04}px)` }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={leftPath}  fill="rgba(255,255,255,0.006)" />
        <path d={rightPath} fill="rgba(255,255,255,0.004)" />
      </svg>
      {crags.left.map((c: any, i: number)  => (<div key={`lc${i}`} style={{ position: 'absolute', left: 0, top: c.y, width: c.width, height: c.height, marginLeft: c.indent, background: `rgba(255,255,255,${c.opacity})`, borderRadius: '0 1px 1px 0', transform: `translateY(${-scrollY * c.parallax}px)` }} />))}
      {crags.right.map((c: any, i: number) => (<div key={`rc${i}`} style={{ position: 'absolute', right: 0, top: c.y, width: c.width, height: c.height, marginRight: c.indent, background: `rgba(255,255,255,${c.opacity})`, borderRadius: '1px 0 0 1px', transform: `translateY(${-scrollY * c.parallax}px)` }} />))}
      <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '200%', background: 'linear-gradient(180deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 50%,rgba(255,255,255,0.003) 100%)', transform: `translateY(${scrollY * 0.08}px)` }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.035, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 55% 50% at 50% ${50 - scrollY * 0.004}%,transparent 10%,rgba(0,0,0,${Math.min(0.75, 0.4 + scrollY * 0.0003)}) 100%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20vh', background: 'linear-gradient(180deg,rgba(0,0,0,0.25) 0%,transparent 100%)' }} />
    </div>
  );
}

function Bar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 60 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
      </div>
      <span style={{ fontFamily: serif, fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' }}>{pct}</span>
    </div>
  );
}

function VoteBtn({ count, up, active, onClick }: { count: number; up: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderColor = up ? 'rgba(34,168,58,0.3)' : 'rgba(255,255,255,0.12)';
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)';
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)';
        }
      }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: `1px solid ${active ? (up ? 'rgba(34,168,58,0.45)' : 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.05)'}`, background: active && up ? 'rgba(34,168,58,0.1)' : 'transparent', color: active && up ? green : active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: serif, fontWeight: 600, fontStyle: 'italic', cursor: 'pointer', transition: 'all 0.15s' }}
    >
      {up ? '↑' : '↓'} {count}
    </button>
  );
}

// ─── Page components ──────────────────────────────────────────────────────────

function FeedPage({ votes, vote }: { votes: Record<number, string | null>; vote: (id: number, t: string) => void }) {
  return (
    <div>
      {/* Header fades in first */}
      <div className="fi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, animationDelay: '0.04s' }}>
        <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.02em' }}>Feed</div>
        <button
          style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          title="Write a post"
        >
          <KeyboardIcon />
        </button>
      </div>

      {/* Posts stagger in at 50ms intervals */}
      <div>
        {FEED.map((p, i) => (
          <div key={p.id} className="fi" style={{ animationDelay: `${60 + i * 50}ms` }}>
            <div
              style={{ padding: '12px 0', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.012)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: green }}>{p.author}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.08)' }}>·</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: sans }}>{p.company}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.08)' }}>·</span>
                <span style={{ fontFamily: serif, fontSize: 10, fontStyle: 'italic', color: 'rgba(255,255,255,0.12)' }}>{p.time}</span>
              </div>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 4, lineHeight: 1.4 }}>{p.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.3)', fontFamily: sans, marginBottom: 8 }}>{p.content}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <VoteBtn count={p.upvotes  + (votes[p.id] === 'up'   ? 1 : 0)} up={true}  active={votes[p.id] === 'up'}   onClick={() => vote(p.id, 'up')} />
                <VoteBtn count={p.downvotes + (votes[p.id] === 'down' ? 1 : 0)} up={false} active={votes[p.id] === 'down'} onClick={() => vote(p.id, 'down')} />
                <span style={{ marginLeft: 'auto', fontFamily: sans, fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>{p.comments} replies</span>
              </div>
            </div>
            {i < FEED.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.035)' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExplorePage({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const filt = COS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="fi" style={{ animationDelay: '0.06s' }}>
      <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.02em', marginBottom: 12 }}>Explore</div>
      <input
        value={search}
        onChange={e => setSearch((e.target as HTMLInputElement).value)}
        placeholder="Search..."
        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', color: '#aaa', fontSize: 11, fontFamily: sans, outline: 'none', marginBottom: 8 }}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(34,168,58,0.3)'; }}
        onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.04)'; }}
      />
      <div>
        {filt.map((c, i) => (
          <div key={c.name}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.012)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{c.name}</div>
                <div style={{ fontFamily: serif, fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.18)', marginTop: 1 }}>{c.count} posts</div>
              </div>
              <Bar value={c.sent} />
            </div>
            {i < filt.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.035)' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function RanksPage({ username }: { username: string }) {
  return (
    <div className="fi" style={{ animationDelay: '0.06s' }}>
      <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.02em', marginBottom: 12 }}>Ranks</div>
      <div>
        {LEADERS.map((e, i) => {
          const me = e.user === username;
          return (
            <div key={e.rank}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', background: me ? 'rgba(34,168,58,0.05)' : 'transparent' }}>
                <span style={{ fontFamily: serif, width: 20, fontSize: 15, fontWeight: 700, fontStyle: 'italic', color: e.rank <= 3 ? '#fff' : 'rgba(255,255,255,0.12)' }}>{e.rank}</span>
                <div style={{ flex: 1, marginLeft: 8 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: green }}>
                    {e.user}
                    {me && <span style={{ marginLeft: 5, fontSize: 8, color: greenDim, fontFamily: sans }}>you</span>}
                  </div>
                  <div style={{ fontFamily: sans, fontSize: 10, color: 'rgba(255,255,255,0.12)', marginTop: 1 }}>{e.posts} posts</div>
                </div>
                <div style={{ fontFamily: serif, fontSize: 14, fontWeight: 700, fontStyle: 'italic', color: me ? '#fff' : 'rgba(255,255,255,0.2)' }}>{e.karma.toLocaleString()}</div>
              </div>
              {i < LEADERS.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.035)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { user: ctxUser } = useUser();

  // Commented out for testing — re-enable to gate behind wallet connection:
  // const { isConnected } = useAccount(); const { loading } = useUser(); const router = useRouter();
  // useEffect(() => { if (!loading && !isConnected) router.push('/'); }, [isConnected, loading, router]);

  const walletDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????...????';
  const username = ctxUser?.username || 'anon_00000000';
  const karma    = ctxUser?.karma    || 0;
  const joined   = ctxUser?.created_at
    ? new Date(ctxUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const [editing,      setEditing]      = useState(false);
  const [draft,        setDraft]        = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState('feed');
  const [uMenu,        setUMenu]        = useState(false);
  const [wMenu,        setWMenu]        = useState(false);
  const [votes,        setVotes]        = useState<Record<number, string | null>>({});
  const [ready,        setReady]        = useState(false);
  const [scrollY,      setScrollY]      = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [contentKey,   setContentKey]   = useState(0);

  const uRef = useRef<HTMLDivElement>(null);
  const wRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    const s = () => setScrollY(window.scrollY);
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

  const vote = (id: number, t: string) => setVotes(p => ({ ...p, [id]: p[id] === t ? null : t }));

  // ── Page transition: 160ms exit (fade + lift), then swap + key-remount (triggers fi animations)
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
    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 5, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', zIndex: 200,
  };

  return (
    <>
      <style>{`
        @keyframes fi { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pd { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .fi { animation: fi 0.4s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
        .lift { transition: transform 0.2s, border-color 0.2s; }
        .lift:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.08) !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#030303', color: '#aaa', fontFamily: sans, opacity: ready ? 1 : 0, transition: 'opacity 0.4s' }}>
        <CragBackground scrollY={scrollY} />

        {/* Depth meter */}
        <div style={{ position: 'fixed', bottom: 14, right: 14, zIndex: 50, fontFamily: mono, fontSize: 9, color: 'rgba(255,255,255,0.06)', letterSpacing: '0.1em' }}>
          −{Math.floor(scrollY * 0.3)}m
        </div>

        {/* Nav */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 50, background: 'rgba(3,3,3,0.88)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <KataLogo />
            <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>kataBased</span>
          </div>

          <div style={{ display: 'flex', gap: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 2 }}>
            {(['feed', 'explore', 'ranks', 'about', 'privacy'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchPage(t)}
                style={{ padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 500, fontFamily: sans, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: page === t ? 'rgba(255,255,255,0.05)' : 'transparent', color: page === t ? '#fff' : 'rgba(255,255,255,0.25)' }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Wallet button */}
            <div ref={wRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setWMenu(!wMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(34,168,58,0.22)', background: 'rgba(34,168,58,0.04)', cursor: 'pointer' }}
              >
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: green, boxShadow: `0 0 7px ${greenDim}`, animation: 'pd 2.5s ease infinite' }} />
                <span style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{walletDisplay}</span>
              </button>
              {wMenu && (
                <div className="fi" style={{ ...dd, width: 200 }}>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={lbl}>Wallet</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{walletDisplay}</div>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.03)', margin: '2px 6px' }} />
                  <button
                    onClick={() => { disconnect(); setWMenu(false); }}
                    style={{ display: 'block', width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 11, color: 'rgba(255,60,60,0.6)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: sans }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,60,60,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* User button */}
            <div ref={uRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUMenu(!uMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 5, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 11, fontWeight: 700, fontStyle: 'italic', color: green }}>κ</div>
                <span style={{ fontFamily: mono, fontSize: 10, color: green }}>{username}</span>
              </button>
              {uMenu && (
                <div className="fi" style={{ ...dd, width: 240 }}>
                  <div style={{ padding: 10 }}>
                    <div style={{ ...lbl, marginBottom: 7 }}>Identity</div>
                    {editing ? (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <input
                          value={draft}
                          onChange={e => setDraft((e.target as HTMLInputElement).value)}
                          onKeyDown={e => e.key === 'Enter' && setEditing(false)}
                          autoFocus
                          maxLength={24}
                          style={{ flex: 1, padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(34,168,58,0.35)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 11, fontFamily: mono, outline: 'none' }}
                        />
                        <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: green, color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: sans }}>Save</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: mono, fontSize: 12, color: green }}>{username}</span>
                        <button onClick={() => { setDraft(username); setEditing(true); }} style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.07)', background: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 9, cursor: 'pointer', fontFamily: sans }}>Edit</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Main grid */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 80px', display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, position: 'relative', zIndex: 1 }}>

          {/* ── Left column: transition wrapper → keyed content mount ── */}
          <div style={{
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? 'translateY(5px)' : 'translateY(0)',
            transition: 'opacity 0.16s ease, transform 0.16s ease',
          }}>
            <div key={contentKey} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {page === 'feed'    && <FeedPage votes={votes} vote={vote} />}
              {page === 'explore' && <ExplorePage search={search} setSearch={setSearch} />}
              {page === 'ranks'   && <RanksPage username={username} />}
              {page === 'about'   && (
                <div className="fi" style={{ animationDelay: '0.06s' }}>
                  <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.02em', marginBottom: 14 }}>What is kataBased?</div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.35)', fontFamily: sans }}>
                    <p style={{ marginBottom: 14 }}>κατάβασις — the descent. Anonymous workplace truth, verified on-chain. No corporate PR. No HR filter. Just what it&apos;s actually like on the inside.</p>
                    <p style={{ marginBottom: 14 }}>Connect a wallet. Get an identity. Post what you know. Your wallet is hashed — your employer will never know it&apos;s you.</p>
                    <p>This is a space for people who want the truth about where they work, where they&apos;re interviewing, and where they might end up. Nothing more.</p>
                  </div>
                </div>
              )}
              {page === 'privacy' && (
                <div className="fi" style={{ animationDelay: '0.06s' }}>
                  <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.02em', marginBottom: 14 }}>Privacy Guide</div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.35)', fontFamily: sans }}>
                    <p style={{ marginBottom: 14 }}>Your anonymity is only as strong as the steps you take to protect it. This guide covers everything you need to stay invisible.</p>
                    <p style={{ color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>Full guide coming soon — wallet hygiene, VPN setup, burner wallets, RAILGUN integration, and more.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Profile card */}
            <div className="fi" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, animationDelay: '0.06s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <KataLogo size="large" />
                <div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: green }}>{username}</div>
                  <div style={{ fontFamily: serif, fontSize: 10, fontStyle: 'italic', color: 'rgba(255,255,255,0.15)', marginTop: 2 }}>{joined} · {walletDisplay}</div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[{ v: karma, l: 'Karma' }, { v: 23, l: 'Posts' }, { v: '12d', l: 'Streak' }, { v: '#5', l: 'Rank' }].map(s => (
                  <div key={s.l} style={{ textAlign: 'center', padding: '4px 0' }}>
                    <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, fontStyle: 'italic', color: '#fff', lineHeight: 1 }}>{s.v}</div>
                    <div style={{ ...lbl, marginTop: 3, fontSize: 9 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Link cards — use switchPage for consistent transition */}
            {(page === 'feed' || page === 'explore' || page === 'ranks') && (
              <div className="fi" style={{ animationDelay: '0.12s', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[{ label: 'About', desc: 'What this is and why', pg: 'about' }, { label: 'Privacy Guide', desc: 'How to stay invisible', pg: 'privacy' }].map(l => (
                  <div
                    key={l.label}
                    className="lift"
                    onClick={() => switchPage(l.pg)}
                    style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: 10, cursor: 'pointer' }}
                  >
                    <div style={{ fontFamily: serif, fontSize: 13, fontWeight: 600, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>{l.label}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: sans }}>{l.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {/* κατάβασις watermark */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 180 }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, fontStyle: 'italic', color: 'rgba(255,255,255,0.055)', letterSpacing: '0.08em', whiteSpace: 'nowrap', userSelect: 'none', transform: 'rotate(-90deg)', transformOrigin: 'center center' }}>
                κατάβασις
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
