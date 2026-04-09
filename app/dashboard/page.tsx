'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { useUser } from '@/lib/UserContext';
import { getPosts, createPost, getEntities, getLeaderboard, getUserStats } from '@/lib/posts';
import type { FeedPost, EntityRow, LeaderRow } from '@/lib/posts';

// ─── Design tokens ────────────────────────────────────────────────────────────
const mono  = "'JetBrains Mono',monospace";
const serif = "'Cormorant Garamond',serif";
const blue  = '#6B9FD4';
const terra = '#D4845A';
const green = 'rgba(107,212,159,1)';

// ─── Mock data ────────────────────────────────────────────────────────────────
const FEED = [
  { id: 1, author: 'anon_19283746', entity: 'Coinbase',      title: 'engineering culture is cooked post-layoffs',          content: 'After the restructuring, the team dynamic changed. More pressure, less psychological safety. Middle management is stretched thin and sprint planning is a mess.',                  confirms: 142, disputes: 18, replies: 34,  time: '2h'  },
  { id: 2, author: 'anon_55839201', entity: 'Chainalysis',  title: 'good benefits, zero upward mobility',                 content: "Solid comp, good WLB, but promotions are completely opaque. If you want stability and interesting blockchain forensics work it's fine. Don't expect to climb.",         confirms: 89,  disputes: 7,  replies: 12,  time: '5h'  },
  { id: 3, author: 'anon_77201938', entity: 'OpenSea',      title: 'the Seaport pivot split the company in half',         content: "Protocol team is doing genuinely interesting work. Product side feels directionless. Two very different experiences depending on which org you're in.",                    confirms: 211, disputes: 31, replies: 67,  time: '8h'  },
  { id: 4, author: 'anon_33018274', entity: 'Uniswap Labs', title: 'best smart contract engineers in DeFi',               content: "Technical bar is extremely high. If you can keep up you'll learn more in six months than three years elsewhere. Compensation is top of market.",                        confirms: 304, disputes: 12, replies: 45,  time: '12h' },
  { id: 5, author: 'anon_99182736', entity: 'Alchemy',      title: 'sales-driven culture wearing an engineering costume', content: 'Marketing is great, actual DX of the product is falling behind. Internal tooling is held together with duct tape. Nobody wants to hear it.',                           confirms: 178, disputes: 44, replies: 91,  time: '1d'  },
  { id: 6, author: 'anon_44102938', entity: 'Paradigm',     title: 'if you get in, never leave',                          content: 'Best research environment in crypto. The people are genuinely world-class. Only downside is the pressure to publish and the hours during market events.',                  confirms: 523, disputes: 8,  replies: 112, time: '2d'  },
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

import TunnelBackground from '@/components/TunnelBackground';

// ─── Logo ─────────────────────────────────────────────────────────────────────
function KataLogo({ size = 'nav' }: { size?: 'nav' | 'large' }) {
  const isLarge = size === 'large';
  return (
    <div style={{ fontFamily: serif, fontWeight: 700, fontStyle: 'italic', fontSize: isLarge ? 38 : 22, lineHeight: 1, letterSpacing: '-0.04em', userSelect: 'none', display: 'flex', alignItems: 'baseline' }}>
      <span style={{ color: blue }}>κ</span>
      <span style={{ color: 'rgba(218,228,248,0.9)', marginLeft: isLarge ? 2 : 1 }}>β</span>
    </div>
  );
}

// ─── Keyboard icon ────────────────────────────────────────────────────────────
function KeyboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="1"/>
      <line x1="6"  y1="8"  x2="6"  y2="8"  strokeWidth="2.5"/><line x1="10" y1="8"  x2="10" y2="8"  strokeWidth="2.5"/>
      <line x1="14" y1="8"  x2="14" y2="8"  strokeWidth="2.5"/><line x1="18" y1="8"  x2="18" y2="8"  strokeWidth="2.5"/>
      <line x1="6"  y1="12" x2="6"  y2="12" strokeWidth="2.5"/><line x1="10" y1="12" x2="10" y2="12" strokeWidth="2.5"/>
      <line x1="14" y1="12" x2="14" y2="12" strokeWidth="2.5"/><line x1="18" y1="12" x2="18" y2="12" strokeWidth="2.5"/>
      <line x1="8"  y1="16" x2="16" y2="16"/>
    </svg>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SecHead({ label, mb = 20 }: { label: string; mb?: number }) {
  return (
    <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(107,159,212,0.7)', marginBottom: mb, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'rgba(107,159,212,0.28)', fontWeight: 400 }}>{'// '}</span>
      {label}
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(107,159,212,0.14) 0%, transparent 100%)' }} />
    </div>
  );
}

// ─── Signal button (confirm / dispute) ───────────────────────────────────────
function SignalBtn({ count, confirm, active, onClick }: { count: number; confirm: boolean; active: boolean; onClick: () => void }) {
  const col     = confirm ? blue : terra;
  const colFull = confirm ? 'rgba(107,159,212,' : 'rgba(212,132,90,';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
        borderRadius: 2,
        border: `1px solid ${active ? colFull + '0.45)' : 'rgba(190,208,238,0.07)'}`,
        background: active ? colFull + '0.07)' : 'transparent',
        color: active ? col : 'rgba(190,208,238,0.2)',
        fontSize: 8, fontFamily: mono, fontWeight: active ? 600 : 400, cursor: 'pointer',
        transition: 'all 0.18s', letterSpacing: '0.1em',
      }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = colFull + '0.25)'; (e.currentTarget as HTMLElement).style.color = colFull + '0.6)'; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(190,208,238,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(190,208,238,0.2)'; } }}
    >
      <span style={{ fontSize: 7 }}>{confirm ? '◆' : '◈'}</span>
      {confirm ? 'CONFIRM' : 'DISPUTE'}
      <span style={{ opacity: 0.7 }}>{count}</span>
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
      <div className="fi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, animationDelay: '0.04s' }}>
        <SecHead label={selectedEntity ? `FEED_LOG // ${selectedEntity.toUpperCase().replace(/ /g, '_')}` : 'FEED_LOG'} mb={0} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedEntity && (
            <button
              onClick={onClearEntity}
              style={{ padding: '4px 10px', borderRadius: 2, border: '1px solid rgba(212,132,90,0.2)', background: 'rgba(212,132,90,0.06)', color: 'rgba(212,132,90,0.6)', fontSize: 8, fontFamily: mono, cursor: 'pointer', letterSpacing: '0.1em', transition: 'all 0.18s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,132,90,0.4)'; (e.currentTarget as HTMLElement).style.color = 'rgba(212,132,90,0.9)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,132,90,0.2)'; (e.currentTarget as HTMLElement).style.color = 'rgba(212,132,90,0.6)'; }}
            >
              ✕ CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Full-width broadcast bar */}
      <div
        className="fi"
        onClick={onCompose}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 14px',
          marginBottom: 18,
          border: '1px dashed rgba(107,159,212,0.2)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'border-color 0.18s, background 0.18s',
          animationDelay: '0.08s',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(107,159,212,0.55)'; el.style.borderStyle = 'solid'; el.style.background = 'rgba(107,159,212,0.03)'; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(107,159,212,0.2)'; el.style.borderStyle = 'dashed'; el.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: blue, boxShadow: '0 0 6px rgba(107,159,212,0.5)', animation: 'pd 2s ease infinite', flexShrink: 0 }} />
          <span style={{ fontFamily: mono, fontSize: 10, color: 'rgba(190,208,238,0.32)', letterSpacing: '0.1em', fontWeight: 400 }}>{'// DROP_A_TRANSMISSION'}</span>
        </div>
        <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(107,159,212,0.35)', letterSpacing: '0.08em', border: '1px solid rgba(107,159,212,0.18)', padding: '2px 6px', borderRadius: 1 }}>[⌘K / ctrl+K]</span>
      </div>

      <div>
        {loading && (
          <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(107,159,212,0.28)', padding: '24px 0', letterSpacing: '0.06em', animation: 'pd 2s ease infinite' }}>{'// fetching transmissions...'}</div>
        )}
        {!loading && error && (
          <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(212,90,90,0.45)', padding: '24px 0', letterSpacing: '0.06em' }}>{'// signal lost — could not reach the archive'}</div>
        )}
        {!loading && !error && displayFeed.length === 0 && (
          <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(190,208,238,0.2)', padding: '24px 0', letterSpacing: '0.06em' }}>{'// no transmissions found for this entity'}</div>
        )}
        {displayFeed.map((p, i) => {
          const signalHigh = p.confirms > 300;
          const signalMed  = p.confirms > 100;
          const borderCol  = signalHigh ? 'rgba(107,159,212,0.65)' : signalMed ? 'rgba(107,159,212,0.3)' : 'rgba(107,159,212,0.1)';
          const bgTint     = signalHigh ? 'rgba(107,159,212,0.012)' : 'transparent';
          return (
          <div key={p.id} className="fi" style={{ animationDelay: `${60 + i * 60}ms` }}>
            <div
              style={{ padding: '16px 0 16px 14px', cursor: 'pointer', borderLeft: `2px solid ${borderCol}`, background: bgTint, transition: 'all 0.18s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'rgba(107,159,212,0.75)'; el.style.background = 'rgba(107,159,212,0.022)'; el.style.boxShadow = 'inset 4px 0 12px rgba(107,159,212,0.04)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = borderCol; el.style.background = bgTint; el.style.boxShadow = 'none'; }}
            >
              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(107,159,212,0.6)', letterSpacing: '0.05em' }}>[{p.author}]</span>
                {p.entity && p.entity !== '—' && (
                  <span style={{ fontFamily: mono, fontSize: 7, fontWeight: 600, color: terra, letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid rgba(212,132,90,0.28)', padding: '1px 6px', borderRadius: 1, background: 'rgba(212,132,90,0.05)' }}>{p.entity}</span>
                )}
                <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.18)', letterSpacing: '0.04em' }}>{p.time}</span>
                <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(107,159,212,0.38)', border: '1px solid rgba(107,159,212,0.14)', padding: '1px 5px', borderRadius: 1, letterSpacing: '0.08em' }}>ON-CHAIN</span>
              </div>
              {/* Title */}
              <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 600, color: 'rgba(240,245,255,1.0)', marginBottom: 8, lineHeight: 1.32, letterSpacing: '-0.02em' }}>{p.title}</div>
              {/* Body */}
              <div style={{ fontFamily: mono, fontSize: 12, lineHeight: 1.8, color: 'rgba(210,222,242,0.82)', fontWeight: 400, marginBottom: 12, letterSpacing: '0.01em' }}>{p.content}</div>
              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SignalBtn count={p.confirms + (votes[String(p.id)] === 'confirm' ? 1 : 0)} confirm={true}  active={votes[String(p.id)] === 'confirm'} onClick={() => vote(String(p.id), 'confirm')} />
                <SignalBtn count={p.disputes + (votes[String(p.id)] === 'dispute' ? 1 : 0)} confirm={false} active={votes[String(p.id)] === 'dispute'} onClick={() => vote(String(p.id), 'dispute')} />
                {p.replies > 0 && <span style={{ marginLeft: 4, fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.2)', letterSpacing: '0.07em' }}>{p.replies} replies</span>}
                <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 8, letterSpacing: '0.08em', color: signalHigh ? blue : signalMed ? 'rgba(107,159,212,0.45)' : 'rgba(190,208,238,0.2)' }}>
                  {signalHigh ? '◆ HIGH_SIGNAL' : signalMed ? '◈ MED_SIGNAL' : '◻ LOW_SIGNAL'}
                </span>
              </div>
              {/* Confirm/dispute ratio sliver */}
              {(() => {
                const total = p.confirms + p.disputes;
                const confPct = total > 0 ? (p.confirms / total) * 100 : 50;
                return (
                  <div style={{ height: 2, width: '100%', marginTop: 10, borderRadius: 1, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${confPct}%`, background: 'rgba(107,159,212,0.5)', height: '100%', transition: 'width 0.4s' }} />
                    <div style={{ flex: 1, background: 'rgba(212,132,90,0.35)', height: '100%' }} />
                  </div>
                );
              })()}
            </div>
            {i < displayFeed.length - 1 && <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(107,159,212,0.1) 0%, rgba(107,159,212,0.03) 100%)', marginLeft: 14 }} />}
          </div>
          );
        })}
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
      <input
        value={search}
        onChange={e => setSearch((e.target as HTMLInputElement).value)}
        placeholder="> search entities..."
        style={{ width: '100%', padding: '7px 10px', borderRadius: 2, border: '1px solid rgba(107,159,212,0.1)', background: 'rgba(107,159,212,0.03)', color: 'rgba(190,208,238,0.65)', fontSize: 10, fontFamily: mono, outline: 'none', marginBottom: 14, transition: 'border-color 0.15s', letterSpacing: '0.04em' }}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(107,159,212,0.3)'; (e.target as HTMLInputElement).style.background = 'rgba(107,159,212,0.04)'; }}
        onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(107,159,212,0.1)'; (e.target as HTMLInputElement).style.background = 'rgba(107,159,212,0.03)'; }}
      />
      <div>
        {filt.map((c, i) => {
          const pct = Math.round(c.sent * 100);
          const hi  = pct >= 60;
          const lo  = pct < 40;
          const barCol = hi ? blue : terra;
          const signalLabel = hi ? 'POSITIVE_SIGNAL' : lo ? 'NEGATIVE_SIGNAL' : 'NEUTRAL_SIGNAL';
          return (
            <div key={c.name} className="fi" style={{ animationDelay: `${40 + i * 60}ms` }}>
              <div
                onClick={() => onSelectEntity(c.name)}
                style={{ padding: '16px 10px', cursor: 'pointer', borderLeft: '2px solid transparent', transition: 'all 0.18s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = barCol + '55'; el.style.background = 'rgba(107,159,212,0.02)'; el.style.paddingLeft = '14px'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'transparent'; el.style.background = 'transparent'; el.style.paddingLeft = '10px'; }}
              >
                {/* Company name + meta */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: 'rgba(240,245,255,0.9)', letterSpacing: '0.01em' }}>{c.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.22)', letterSpacing: '0.06em' }}>{c.count} {c.count === 1 ? 'TRANSMISSION' : 'TRANSMISSIONS'}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: barCol, letterSpacing: '-0.01em' }}>{pct}<span style={{ fontSize: 8, fontWeight: 400, marginLeft: 1 }}>%</span></span>
                  </div>
                </div>
                {/* Two-tone sentiment bar: blue=positive left, terra=negative right */}
                <div style={{ width: '100%', height: 8, borderRadius: 1, overflow: 'hidden', marginBottom: 6, display: 'flex' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'rgba(107,159,212,0.7)', transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                  <div style={{ flex: 1, height: '100%', background: 'rgba(212,132,90,0.4)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: mono, fontSize: 7, color: barCol, opacity: 0.65, letterSpacing: '0.1em' }}>{signalLabel}</div>
                  <div style={{ fontFamily: mono, fontSize: 7, color: 'rgba(190,208,238,0.3)', letterSpacing: '0.1em' }}>VIEW_TRANSMISSIONS →</div>
                </div>
              </div>
              {i < filt.length - 1 && <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(107,159,212,0.1) 0%, transparent 100%)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Ranks page ───────────────────────────────────────────────────────────────
function RanksPage({ leaders, username }: { leaders: LeaderRow[]; username: string }) {
  return (
    <div className="fi" style={{ animationDelay: '0.06s' }}>
      <SecHead label="LEADERBOARD" />
      <div>
        {leaders.map((e, i) => {
          const me = e.user === username;
          return (
            <div key={e.rank} className="fi" style={{ animationDelay: `${40 + i * 60}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '9px 0', paddingLeft: me ? 8 : 0, background: me ? 'rgba(107,159,212,0.03)' : 'transparent', borderLeft: me ? '2px solid rgba(107,159,212,0.25)' : '2px solid transparent' }}>
                <span style={{ fontFamily: mono, width: 22, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: e.rank <= 3 ? 'rgba(218,228,248,0.7)' : 'rgba(190,208,238,0.18)' }}>
                  {String(e.rank).padStart(2, '0')}
                </span>
                <div style={{ flex: 1, marginLeft: 10 }}>
                  <div style={{ fontFamily: mono, fontSize: 9, color: blue, letterSpacing: '0.04em' }}>
                    [{e.user}]{me && <span style={{ marginLeft: 5, fontSize: 7, color: 'rgba(212,132,90,0.6)', letterSpacing: '0.08em' }}>YOU</span>}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.15)', marginTop: 2, letterSpacing: '0.04em' }}>{e.posts} posts</div>
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.02em', color: me ? 'rgba(218,228,248,0.8)' : 'rgba(190,208,238,0.22)' }}>{e.karma.toLocaleString()}</div>
              </div>
              {i < leaders.length - 1 && <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(107,159,212,0.1) 0%, transparent 100%)' }} />}
            </div>
          );
        })}
      </div>

      {/* OPSEC note */}
      <div style={{ marginTop: 28, padding: '10px 14px', border: '1px solid rgba(212,132,90,0.08)', borderRadius: 2, background: 'rgba(212,132,90,0.02)' }}>
        <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 500, letterSpacing: '0.14em', color: 'rgba(212,132,90,0.35)', marginBottom: 5 }}>{'// OPSEC_NOTE'}</div>
        <div style={{ fontFamily: mono, fontSize: 9, lineHeight: 1.7, color: 'rgba(190,208,238,0.25)', fontWeight: 300, letterSpacing: '0.01em' }}>
          Public post counts and karma can narrow your identity. A high rank combined with known posting patterns is an attack surface. Read the <span style={{ color: 'rgba(107,159,212,0.45)', cursor: 'default' }}>[OPSEC]</span> guide before accumulating a visible profile.
        </div>
      </div>
    </div>
  );
}

// ─── Composer modal ───────────────────────────────────────────────────────────
function ComposerModal({ userId, onPostCreated, onClose }: { userId: string; onPostCreated: (p: FeedPost) => void; onClose: () => void }) {
  const [company,    setCompany]    = useState('');
  const [title,      setTitle]      = useState('');
  const [body,       setBody]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const BODY_MAX = 1200;
  const TITLE_MAX = 120;

  const submit = async () => {
    if (!userId) { setError('identity not established — reconnect wallet'); return; }
    if (!title.trim() || !body.trim()) { setError('HEADER* and TRANSMISSION* are required'); return; }
    setSubmitting(true); setError('');
    try {
      const post = await createPost(userId, title, body, company);
      onPostCreated(post);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'broadcast failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (extra?: object) => ({
    width: '100%', borderRadius: 2, border: '1px solid rgba(107,159,212,0.18)',
    background: 'rgba(107,159,212,0.04)', color: 'rgba(218,228,248,0.88)',
    fontFamily: mono, outline: 'none', transition: 'border-color 0.15s, background 0.15s',
    letterSpacing: '0.02em', boxSizing: 'border-box' as const,
    ...extra,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,5,12,0.92)', backdropFilter: 'blur(12px)' }} onClick={onClose} />
      <div className="fi" style={{ position: 'relative', width: '100%', maxWidth: 580, margin: '0 24px', background: '#080C18', border: '1px solid rgba(107,159,212,0.5)', borderRadius: 3, padding: 36, zIndex: 1, boxShadow: '0 0 0 1px rgba(107,159,212,0.08), 0 48px 96px rgba(0,0,0,0.95)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: blue, boxShadow: `0 0 8px ${blue}`, animation: 'pd 2s ease infinite', flexShrink: 0 }} />
            <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(107,159,212,0.7)' }}>{'// NEW_TRANSMISSION'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(190,208,238,0.08)', borderRadius: 2, cursor: 'pointer', fontFamily: mono, fontSize: 9, color: 'rgba(190,208,238,0.25)', padding: '3px 8px', letterSpacing: '0.08em', transition: 'all 0.18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(190,208,238,0.2)'; (e.currentTarget as HTMLElement).style.color = 'rgba(190,208,238,0.55)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(190,208,238,0.08)'; (e.currentTarget as HTMLElement).style.color = 'rgba(190,208,238,0.25)'; }}
          >✕</button>
        </div>

        {/* Top divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(107,159,212,0.35) 0%, rgba(107,159,212,0.06) 100%)', marginBottom: 28 }} />

        {/* TARGET_ENTITY — optional */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 7, letterSpacing: '0.16em', color: 'rgba(107,159,212,0.4)' }}>TARGET_ENTITY</span>
            <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(190,208,238,0.18)', letterSpacing: '0.1em' }}>optional</span>
          </div>
          <input
            value={company}
            onChange={e => setCompany((e.target as HTMLInputElement).value)}
            placeholder="e.g. Coinbase, Dept. of State, City Hall..."
            style={inputStyle({ padding: '10px 12px', fontSize: 11 })}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(107,159,212,0.4)'; (e.target as HTMLInputElement).style.background = 'rgba(107,159,212,0.06)'; }}
            onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(107,159,212,0.18)'; (e.target as HTMLInputElement).style.background = 'rgba(107,159,212,0.04)'; }}
          />
        </div>

        {/* HEADER — required */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontFamily: mono, fontSize: 7, letterSpacing: '0.16em', color: 'rgba(107,159,212,0.55)' }}>HEADER</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(212,132,90,0.6)', lineHeight: 1 }}>*</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 7, color: title.length > TITLE_MAX * 0.85 ? 'rgba(212,90,90,0.6)' : 'rgba(190,208,238,0.18)', letterSpacing: '0.04em' }}>{title.length}/{TITLE_MAX}</span>
          </div>
          <input
            value={title}
            onChange={e => { if (e.target.value.length <= TITLE_MAX) setTitle(e.target.value); }}
            placeholder="What needs to be said"
            style={inputStyle({ padding: '10px 12px', fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' })}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(107,159,212,0.4)'; (e.target as HTMLInputElement).style.background = 'rgba(107,159,212,0.06)'; }}
            onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(107,159,212,0.18)'; (e.target as HTMLInputElement).style.background = 'rgba(107,159,212,0.04)'; }}
          />
        </div>

        {/* TRANSMISSION — required */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontFamily: mono, fontSize: 7, letterSpacing: '0.16em', color: 'rgba(107,159,212,0.55)' }}>TRANSMISSION</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(212,132,90,0.6)', lineHeight: 1 }}>*</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 7, color: body.length > BODY_MAX * 0.9 ? 'rgba(212,90,90,0.6)' : 'rgba(190,208,238,0.18)', letterSpacing: '0.04em' }}>{body.length}/{BODY_MAX}</span>
          </div>
          <textarea
            value={body}
            onChange={e => { if (e.target.value.length <= BODY_MAX) setBody(e.target.value); }}
            placeholder="What it's actually like on the inside..."
            rows={8}
            style={inputStyle({ padding: '12px', fontSize: 12, resize: 'vertical', lineHeight: 1.8, fontWeight: 300, letterSpacing: '0.01em', color: 'rgba(190,208,238,0.78)' })}
            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(107,159,212,0.4)'; (e.target as HTMLTextAreaElement).style.background = 'rgba(107,159,212,0.06)'; }}
            onBlur={e  => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(107,159,212,0.18)'; (e.target as HTMLTextAreaElement).style.background = 'rgba(107,159,212,0.04)'; }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 20, padding: '8px 12px', borderLeft: '2px solid rgba(212,90,90,0.5)', background: 'rgba(212,90,90,0.04)', fontFamily: mono, fontSize: 9, color: 'rgba(212,90,90,0.8)', letterSpacing: '0.06em' }}>
            !! {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.2)', letterSpacing: '0.06em' }}>
            identity: anon · hash: on-chain · payload: encrypted
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 18px', borderRadius: 2, border: '1px solid rgba(190,208,238,0.1)', background: 'none', color: 'rgba(190,208,238,0.3)', fontSize: 9, fontFamily: mono, cursor: 'pointer', letterSpacing: '0.12em', transition: 'all 0.18s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(190,208,238,0.22)'; (e.currentTarget as HTMLElement).style.color = 'rgba(190,208,238,0.55)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(190,208,238,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(190,208,238,0.3)'; }}
            >
              ABORT
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 22px', borderRadius: 2, border: `1px solid ${submitting ? 'rgba(107,159,212,0.2)' : 'rgba(107,159,212,0.55)'}`, background: submitting ? 'rgba(107,159,212,0.04)' : 'rgba(107,159,212,0.12)', color: submitting ? 'rgba(218,228,248,0.35)' : 'rgba(218,228,248,0.9)', fontSize: 9, fontFamily: mono, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.14em', transition: 'all 0.18s' }}
              onMouseEnter={e => { if (!submitting) { (e.currentTarget as HTMLElement).style.background = 'rgba(107,159,212,0.2)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(107,159,212,0.7)'; } }}
              onMouseLeave={e => { if (!submitting) { (e.currentTarget as HTMLElement).style.background = 'rgba(107,159,212,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(107,159,212,0.55)'; } }}
            >
              {submitting && <span style={{ animation: 'pd 0.8s ease infinite', fontSize: 10 }}>◆</span>}
              {submitting ? 'BROADCASTING...' : 'BROADCAST'}
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
    id: 'T0',
    label: 'BASELINE_HYGIENE',
    sub: 'Before you do anything else',
    icon: '◈',
    col: 'rgba(190,208,238,0.38)',
    threat: 'CRITICAL',
    bg: 'rgba(190,208,238,0.025)',
    time: '30min',
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
    id: 'T1',
    label: 'NETWORK_ANONYMITY',
    sub: 'Kill the IP trail',
    icon: '⊕',
    col: '#6B9FD4',
    threat: 'CRITICAL',
    bg: 'rgba(107,159,212,0.03)',
    time: '1h',
    steps: [
      'Use a no-log VPN for every session. Mullvad and ProtonVPN both accept anonymous crypto payment with no email required. Do not use free VPNs — they log.',
      'For stronger guarantees: use Tor Browser. Traffic routes through 3+ independent relays; no single node sees both your IP and your destination.',
      'Never use public WiFi without a VPN layer on top. Unencrypted public networks are trivial to monitor.',
      'Your wallet extension and your anonymized network must be on the same stack. Connecting MetaMask on a clearnet browser while your Tor tab is open means nothing.',
      'After enabling your VPN, verify your IP is masked before connecting your wallet. Use a DNS leak test — many VPNs allow DNS leaks by default even while connected. ipleak.net and browserleaks.com are standard checks. Mullvad\'s own tool at mullvad.net/check is the most comprehensive. Never skip this on a new setup.',
    ],
  },
  {
    id: 'T2',
    label: 'WALLET_ISOLATION',
    sub: 'Your review wallet must be sterile',
    icon: '◻',
    col: 'rgba(107,159,212,0.75)',
    threat: 'RECOMMENDED',
    bg: 'rgba(107,159,212,0.04)',
    time: '45min',
    steps: [
      'Generate a fresh wallet with zero transaction history — not a wallet you\'ve used anywhere else, ever.',
      'Never fund it directly from a CEX (Coinbase, Kraken, Binance, etc.). KYC links the withdrawal directly to your government identity.',
      'Never send ETH directly from your main wallet to your anon wallet. A single direct transfer is enough for blockchain analytics tools to link both addresses permanently.',
      'Hold only the minimum ETH needed to sign transactions. Don\'t accumulate assets or receive funds from unrelated sources here.',
      'Store the seed phrase offline on paper or stamped metal, physically isolated from devices connected to your real identity. Never photograph it. Never store it digitally, not even encrypted. Geographic redundancy (two separate locations) is strongly advised for long-term personas.',
    ],
  },
  {
    id: 'T3',
    label: 'ON-CHAIN_PRIVACY',
    sub: 'Break the fund flow before it reaches your anon wallet',
    icon: '⬡',
    col: '#D4845A',
    threat: 'ADVANCED',
    bg: 'rgba(212,132,90,0.03)',
    time: '2–3h',
    steps: [
      'Blockchain analytics tools build identity graphs by tracing fund flows between addresses. A motivated employer or investigator can follow ETH from your KYC\'d exchange through multiple hops to your anon wallet if the on-chain trail is unbroken. The goal of this tier is to break that trail.',
      'RAILGUN is a zero-knowledge shielding protocol that lets you deposit ETH and ERC-20 tokens into a private shielded balance using zkSNARKs. Transfers from a shielded balance do not expose sender or recipient addresses on-chain. Critical caveat: RAILGUN breaks the on-chain fund trail but does not hide network-level activity. Always combine with T1 (VPN or Tor) — your ISP and exit node can still see that you are interacting with the RAILGUN contract at a given timestamp.',
      'RAILGUN note on WETH: RAILGUN wraps ETH as WETH internally for all shielded transactions. When you shield ETH, it is held as shielded WETH inside the protocol. When you unshield, you receive WETH — not native ETH. You will need to unwrap WETH → ETH after unshielding if your target wallet requires native ETH. Plan this into your funding flow.',
      'Recommended RAILGUN workflow: fund a staging wallet from your CEX → shield into RAILGUN via the Railway wallet interface → unshield to your anon review wallet → unwrap WETH if needed. The direct link between your KYC withdrawal and your review wallet is now cryptographically severed.',
      'Alternative: use Monero (XMR) as a privacy intermediary. Route funds through a non-custodial swap service (SideShift, FixedFloat) — CEX withdrawal → ETH → XMR → ETH → anon wallet. Monero\'s native ring signatures, stealth addresses, and RingCT make the intermediate hops untraceable by design. Same caveat applies: the swap service interactions are still visible at the network layer — use T1 protections throughout.',
      'Never reuse deposit or receiving addresses. Generate a fresh address for each inbound transaction.',
    ],
  },
  {
    id: 'T4',
    label: 'FULL_GHOST_MODE',
    sub: 'Maximum deniability — nuclear option',
    icon: '◆',
    col: 'rgba(212,90,90,0.72)',
    threat: 'EXTREME',
    bg: 'rgba(212,90,90,0.04)',
    time: 'ongoing',
    steps: [
      'Dedicated device — purchased secondhand with cash, never signed into any account tied to your real identity, never connected to your home network.',
      'Boot from Tails OS on a live USB. Tails boots entirely into RAM, routes all traffic through Tor by default, and leaves zero forensic trace on the hardware after shutdown. If the device is seized, there is nothing to recover. This is not a convenience measure — it is the difference between plausible deniability and none.',
      'Generate wallet keys while air-gapped — no network connection at all during key generation. Transfer the public address manually (write it down, type it in separately). Never copy-paste across the air gap.',
      'Full operational stack: Tails OS → Tor → no-log VPN → RAILGUN-shielded funding → fresh wallet. Each layer independently defeats a different class of surveillance. Together they compound into a threat model that defeats most non-state adversaries entirely.',
      'Behavioral OPSEC — your writing is a fingerprint. Stylometric analysis can identify you from as few as 500 words by matching sentence length distributions, punctuation habits, rare vocabulary, and structural patterns. Do not write the way you normally write. Vary sentence length deliberately. Avoid your signature phrases, abbreviations, and formatting habits. Never post on a predictable schedule — random delays (not 9am every Monday) defeat timing correlation attacks. If you post across multiple personas, ensure zero stylistic overlap.',
      'Device and browser fingerprinting extends beyond IP. Canvas rendering, font enumeration, screen resolution, timezone, and WebGL signatures are all used to track users across sessions. Tails + Tor Browser mitigates most of this by design — but only if you do not resize the browser window, install extensions, or change default settings. The default Tor Browser window size is standardized; deviating from it breaks the anonymity set.',
      'Compartmentalize strictly: one review per target entity, one wallet per long-term persona, zero overlap between identities at any layer. Never let two personas touch the same device, network, or funding source. The moment two identities share any artifact — a timing pattern, a writing tic, a staging wallet — they are linkable.',
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
  { mode: 'AGED_WALLET',         risk: 'CRITICAL', desc: 'Using a wallet with prior mainnet activity — even a single transaction links both identities via blockchain analytics. Generate a sterile wallet every time.' },
  { mode: 'DIRECT_FUNDING',      risk: 'CRITICAL', desc: 'Sending ETH directly from a main wallet or KYC exchange to your anon wallet. The on-chain trail is immediately traceable without T3 shielding.' },
  { mode: 'SHARED_VPN_SESSION',  risk: 'HIGH',     desc: 'Using the same VPN endpoint for both personal browsing and anonymous sessions in the same day. Timing correlation maps your anonymous window to your real identity.' },
  { mode: 'MOBILE_POST',         risk: 'HIGH',     desc: 'Posting from a phone. GPS history, push notification timestamps, device fingerprints, and carrier metadata persist across sessions regardless of VPN status.' },
  { mode: 'DNS_LEAK',            risk: 'HIGH',     desc: 'VPN connected but DNS not tunneled — DNS queries expose your site visits to your ISP. Run a DNS leak test on every new setup before connecting your wallet.' },
  { mode: 'LATE_DISCONNECT',     risk: 'MEDIUM',   desc: 'VPN connection dropped after wallet connected but before session ended. The submission IP is logged. If connection drops: stop, close wallet, reconnect, re-verify, restart.' },
  { mode: 'STYLISTIC_OVERLAP',   risk: 'MEDIUM',   desc: 'Writing identically across personas. Stylometric tools need ~500 words of overlap to link identities. Vary sentence length deliberately, eliminate signature phrases.' },
  { mode: 'ADDRESS_REUSE',       risk: 'MEDIUM',   desc: 'Reusing deposit or receiving addresses when shielding via RAILGUN or routing through XMR. Each reuse creates a traceable graph edge. Generate fresh addresses per operation.' },
];

function OpsecPage() {
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const tier = TIERS.find(t => t.id === activeTier) ?? null;

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (tier) {
    return (
      <div className="fi" style={{ animationDelay: '0.06s' }}>

        {/* Back */}
        <button
          onClick={() => setActiveTier(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; }}
        >
          <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(190,208,238,0.55)', letterSpacing: '0.1em' }}>←</span>
          <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(190,208,238,0.55)', letterSpacing: '0.12em' }}>[GUIDE]</span>
        </button>

        {/* Progress indicator */}
        {(() => {
          const idx = TIERS.findIndex(t => t.id === tier.id);
          return (
            <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.22)', letterSpacing: '0.12em', marginBottom: 18 }}>
              {'// TIER '}{idx + 1}{' / '}{TIERS.length}{' — '}{tier.threat}
            </div>
          );
        })()}

        {/* Tier header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: mono, fontSize: 20, color: tier.col, opacity: 0.55, lineHeight: 1, flexShrink: 0 }}>
            {tier.icon}
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', color: tier.col, border: `1px solid ${tier.col}`, padding: '2px 8px', borderRadius: 1, flexShrink: 0 }}>
            {tier.id}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(218,228,248,0.85)' }}>
            {tier.label}
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.22)', letterSpacing: '0.08em', marginLeft: 4 }}>
            EST_EFFORT: {tier.time}
          </div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(190,208,238,0.28)', letterSpacing: '0.06em', fontStyle: 'italic', marginBottom: 28 }}>
          {tier.sub}
        </div>

        {/* Jurisdiction warning for T3/T4 */}
        {(tier.id === 'T3' || tier.id === 'T4') && (
          <div style={{ marginBottom: 20, padding: '8px 12px', border: '1px solid rgba(212,90,90,0.2)', borderRadius: 1, background: 'rgba(212,90,90,0.03)' }}>
            <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(212,90,90,0.6)' }}>
              ⚠ JURISDICTION_DEPENDENT — verify tool legality in your country before proceeding
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: `${tier.col}20`, marginBottom: 28 }} />

        {/* Steps */}
        <div style={{ paddingLeft: 14, borderLeft: `1px solid ${tier.col}22`, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {tier.steps.map((step, si) => {
            const isAntiPattern = /^Never |^Do not /.test(step);
            return (
              <div key={si} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: mono, fontSize: 8, color: isAntiPattern ? 'rgba(212,90,90,0.7)' : tier.col, letterSpacing: '0.06em', flexShrink: 0, marginTop: 3, opacity: 0.9 }}>
                  {isAntiPattern ? '✗' : String(si + 1).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.65, color: isAntiPattern ? 'rgba(212,160,160,0.6)' : 'rgba(190,208,238,0.65)', fontWeight: 300, letterSpacing: '0.01em' }}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {/* Nav between tiers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(190,208,238,0.05)' }}>
          {(() => {
            const idx = TIERS.findIndex(t => t.id === tier.id);
            const prev = TIERS[idx - 1];
            const next = TIERS[idx + 1];
            return (
              <>
                <div>
                  {prev && (
                    <button onClick={() => setActiveTier(prev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left', opacity: 0.65, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.65'; }}
                    >
                      <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.4)', letterSpacing: '0.1em' }}>← PREV</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: prev.col, letterSpacing: '0.12em' }}>[{prev.id}] {prev.label}</span>
                    </button>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {next && (
                    <button onClick={() => setActiveTier(next.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', opacity: 0.65, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.65'; }}
                    >
                      <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.4)', letterSpacing: '0.1em' }}>NEXT →</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: next.col, letterSpacing: '0.12em' }}>[{next.id}] {next.label}</span>
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>

      </div>
    );
  }

  // ── Overview (tier cards) ─────────────────────────────────────────────────────
  return (
    <div className="fi" style={{ animationDelay: '0.06s' }}>
      <SecHead label="OPSEC_GUIDE" />

      {/* κατάβασις motto */}
      <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(107,159,212,0.3)', letterSpacing: '0.12em', marginBottom: 10, fontStyle: 'italic' }}>
        {'// ΚΑΤΆΒΑΣΙΣ — descent into the shadows'}
      </div>

      <div style={{ fontFamily: mono, fontSize: 10, lineHeight: 1.78, color: 'rgba(190,208,238,0.38)', marginBottom: 20, letterSpacing: '0.015em', fontWeight: 300 }}>
        Your anonymity is only as strong as your weakest step. Partial implementation creates a false sense of security — treat your identity as exposed unless each tier is covered.
      </div>

      {/* Threat model */}
      <div style={{ marginBottom: 28, padding: '12px 14px', border: '1px solid rgba(107,159,212,0.1)', borderRadius: 2, background: 'rgba(107,159,212,0.02)' }}>
        <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(107,159,212,0.45)', marginBottom: 8 }}>{'// THREAT_MODEL'}</div>
        <div style={{ fontFamily: mono, fontSize: 9, lineHeight: 1.78, color: 'rgba(190,208,238,0.3)', fontWeight: 300, letterSpacing: '0.01em' }}>
          This guide assumes an adversary with: (1) access to KYC records from centralized exchanges, (2) blockchain analytics tools capable of tracing multi-hop fund flows, (3) IP-level traffic logging by ISPs or network operators, (4) employer-grade forensic capability on work devices and networks, and (5) stylometric analysis tools for writing-based deanonymization. Read tiers in order — each one builds on the previous.
        </div>
      </div>

      {/* Quick path */}
      <div style={{ marginBottom: 24, padding: '12px 14px', border: '1px solid rgba(107,159,212,0.12)', borderRadius: 2, background: 'rgba(107,159,212,0.03)' }}>
        <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(107,159,212,0.45)', marginBottom: 10 }}>{'// QUICK_PATH'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { label: 'CASUAL_REVIEWER', path: 'T0 + T1', desc: 'Posting on a past employer, low personal risk' },
            { label: 'CURRENT_EMPLOYER', path: 'T0 + T1 + T2 + T3', desc: 'Reviewing active employer — on-chain trail must be broken' },
            { label: 'HOSTILE_ADVERSARY', path: 'T0 → T4 full stack', desc: 'Retaliation risk, legal exposure, or high-profile target' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontFamily: mono, fontSize: 7, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(107,159,212,0.4)', flexShrink: 0, width: 130 }}>{r.label}</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(107,159,212,0.7)', letterSpacing: '0.06em', flexShrink: 0 }}>{r.path}</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.2)', letterSpacing: '0.01em' }}>— {r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-post checklist */}
      <div style={{ marginBottom: 24, padding: '12px 14px', border: '1px solid rgba(107,159,212,0.1)', borderRadius: 2, background: 'rgba(107,159,212,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(107,159,212,0.45)' }}>{'// PRE_POST_CHECKLIST'}</div>
          <div style={{ fontFamily: mono, fontSize: 7, color: checked.size === CHECKLIST.length ? 'rgba(107,212,159,0.7)' : 'rgba(190,208,238,0.2)', letterSpacing: '0.1em', transition: 'color 0.2s' }}>
            {checked.size}/{CHECKLIST.length} VERIFIED
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {CHECKLIST.map((item, i) => {
            const on = checked.has(i);
            return (
              <div
                key={i}
                onClick={() => {
                  const next = new Set(checked);
                  on ? next.delete(i) : next.add(i);
                  setChecked(next);
                }}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', opacity: on ? 1 : 0.65, transition: 'opacity 0.12s' }}
              >
                <span style={{ fontFamily: mono, fontSize: 9, color: on ? 'rgba(107,212,159,0.8)' : 'rgba(190,208,238,0.25)', flexShrink: 0, marginTop: 1, transition: 'color 0.12s' }}>{on ? '✓' : '○'}</span>
                <span style={{ fontFamily: mono, fontSize: 9, lineHeight: 1.55, color: on ? 'rgba(190,208,238,0.5)' : 'rgba(190,208,238,0.32)', letterSpacing: '0.01em', textDecoration: on ? 'line-through' : 'none', textDecorationColor: 'rgba(190,208,238,0.18)', transition: 'color 0.12s' }}>{item}</span>
              </div>
            );
          })}
        </div>
        {checked.size === CHECKLIST.length && (
          <div style={{ marginTop: 10, fontFamily: mono, fontSize: 8, color: 'rgba(107,212,159,0.5)', letterSpacing: '0.14em', textAlign: 'center', borderTop: '1px solid rgba(107,212,159,0.1)', paddingTop: 8 }}>
            {'// CLEARED_TO_POST'}
          </div>
        )}
      </div>

      {/* Tier cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TIERS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTier(t.id)}
            style={{
              background: t.bg,
              border: `1px solid ${t.col}35`,
              borderRadius: 2,
              cursor: 'pointer',
              padding: '14px 16px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${t.col}70`; (e.currentTarget as HTMLButtonElement).style.background = `${t.col}10`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${t.col}35`; (e.currentTarget as HTMLButtonElement).style.background = t.bg; }}
          >
            {/* Icon */}
            <div style={{ fontFamily: mono, fontSize: 16, color: t.col, opacity: 0.7, flexShrink: 0, width: 22, textAlign: 'center', lineHeight: 1 }}>
              {t.icon}
            </div>

            {/* Tier badge */}
            <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', color: t.col, border: `1px solid ${t.col}`, padding: '2px 7px', borderRadius: 1, flexShrink: 0 }}>
              {t.id}
            </div>

            {/* Label + sub */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(218,228,248,0.8)', marginBottom: 3 }}>
                {t.label}
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(190,208,238,0.3)', letterSpacing: '0.06em', fontStyle: 'italic' }}>
                {t.sub}
              </div>
            </div>

            {/* Threat badge + time + step count + arrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {(t.id === 'T3' || t.id === 'T4') && (
                <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(212,90,90,0.65)', flexShrink: 0 }} title="Jurisdiction-dependent — verify tool legality before use">⚠</div>
              )}
              {t.id === 'T0' && (
                <div style={{ fontFamily: mono, fontSize: 6, fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(190,208,238,0.55)', border: '1px solid rgba(190,208,238,0.2)', padding: '1px 5px', borderRadius: 1 }}>START_HERE</div>
              )}
              <div style={{ fontFamily: mono, fontSize: 7, fontWeight: 600, letterSpacing: '0.14em', color: t.col, border: `1px solid ${t.col}55`, padding: '1px 5px', borderRadius: 1, opacity: 0.85 }}>
                {t.threat}
              </div>
              <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.18)', letterSpacing: '0.06em' }}>
                {t.steps.length} steps · {t.time}
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: `${t.col}70` }}>›</div>
            </div>
          </button>
        ))}
      </div>

      {/* Tools reference */}
      <div style={{ marginTop: 28, padding: '12px 14px', border: '1px solid rgba(190,208,238,0.06)', borderRadius: 2 }}>
        <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(190,208,238,0.3)', marginBottom: 12 }}>{'// TOOLS_REFERENCE'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { tier: 'T1', name: 'Mullvad VPN',      desc: 'No-log VPN. Accepts Monero + cash. No account required.',         cat: 'NETWORK'  },
            { tier: 'T1', name: 'ProtonVPN',         desc: 'Swiss jurisdiction. Free tier available. Audited no-log policy.', cat: 'NETWORK'  },
            { tier: 'T1', name: 'Tor Browser',       desc: 'Routes traffic through 3+ relays. Defeats IP correlation.',       cat: 'NETWORK'  },
            { tier: 'T2', name: 'MetaMask',          desc: 'Generate a dedicated wallet. Never reuse addresses.',             cat: 'WALLET'   },
            { tier: 'T3', name: 'RAILGUN / Railway', desc: 'zkSNARK shielding for ETH/ERC-20. Severs on-chain fund trail.',   cat: 'PRIVACY'  },
            { tier: 'T3', name: 'SideShift.ai',      desc: 'Non-custodial swap. ETH → XMR → ETH intermediary route.',        cat: 'PRIVACY'  },
            { tier: 'T3', name: 'Monero (XMR)',      desc: 'Ring sigs + stealth addrs + RingCT. Native untraceable layer.',   cat: 'PRIVACY'  },
            { tier: 'T4', name: 'Tails OS',          desc: 'Amnesic live OS. All traffic over Tor. Zero forensic trace.',     cat: 'OS'       },
            { tier: 'T4', name: 'GrapheneOS',        desc: 'Hardened Android. Only viable mobile option.',                    cat: 'OS'       },
          ].map(tool => (
            <div key={tool.name} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontFamily: mono, fontSize: 7, letterSpacing: '0.1em', color: 'rgba(190,208,238,0.18)', flexShrink: 0, width: 22 }}>{tool.tier}</span>
              <span style={{ fontFamily: mono, fontSize: 7, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(190,208,238,0.25)', flexShrink: 0, width: 46, textAlign: 'right' }}>[{tool.cat}]</span>
              <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 500, color: 'rgba(190,208,238,0.55)', letterSpacing: '0.04em', flexShrink: 0, width: 130 }}>{tool.name}</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.2)', letterSpacing: '0.01em', lineHeight: 1.5 }}>{tool.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Failure modes */}
      <div style={{ marginTop: 28, padding: '12px 14px', border: '1px solid rgba(212,90,90,0.12)', borderRadius: 2 }}>
        <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(212,90,90,0.38)', marginBottom: 4 }}>{'// FAILURE_MODES'}</div>
        <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(190,208,238,0.2)', letterSpacing: '0.01em', marginBottom: 14, lineHeight: 1.5 }}>Common deanonymization vectors. Each has ended real-world opsec setups.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {FAILURE_MODES.map((f, fi) => (
            <div key={f.mode} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: fi < FAILURE_MODES.length - 1 ? '1px solid rgba(212,90,90,0.12)' : 'none' }}>
              <div style={{ flexShrink: 0, width: 130 }}>
                <div style={{
                  fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 4,
                  color: f.risk === 'CRITICAL' ? 'rgba(212,90,90,0.75)' : f.risk === 'HIGH' ? 'rgba(212,132,90,0.65)' : 'rgba(190,208,238,0.35)',
                  border: `1px solid ${f.risk === 'CRITICAL' ? 'rgba(212,90,90,0.3)' : f.risk === 'HIGH' ? 'rgba(212,132,90,0.25)' : 'rgba(190,208,238,0.15)'}`,
                  padding: '1px 5px', borderRadius: 1, display: 'inline-block',
                }}>{f.risk}</div>
                <div style={{ fontFamily: mono, fontSize: 7, letterSpacing: '0.07em', color: 'rgba(190,208,238,0.2)', lineHeight: 1.3 }}>{f.mode}</div>
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, lineHeight: 1.65, color: 'rgba(190,208,238,0.28)', letterSpacing: '0.01em', fontWeight: 300 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 20, padding: '12px 16px', border: '1px solid rgba(212,132,90,0.08)', borderRadius: 2, background: 'rgba(212,132,90,0.02)' }}>
        <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 500, letterSpacing: '0.16em', color: 'rgba(212,132,90,0.38)', marginBottom: 6, textTransform: 'uppercase' }}>{'// DISCLAIMER'}</div>
        <div style={{ fontFamily: mono, fontSize: 9, lineHeight: 1.72, color: 'rgba(190,208,238,0.25)', fontWeight: 300, letterSpacing: '0.01em' }}>
          This guide is for informational purposes only. Verify the current legal and regulatory status of any privacy tool in your jurisdiction before use. VPN legality varies by country. Monero is subject to ongoing regulatory scrutiny in some jurisdictions. kataBased does not endorse any specific third-party service.
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { address, status: wagmiStatus } = useAccount();
  const { disconnect } = useDisconnect();
  const { user: ctxUser, changeUsername, signingIn } = useUser();

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
  const [feed,            setFeed]           = useState<FeedPost[]>(FEED);
  const [entities,        setEntities]       = useState<EntityRow[]>(COS);
  const [leaders,         setLeaders]        = useState<LeaderRow[]>(LEADERS);
  const [postCount,       setPostCount]      = useState(0);
  const [feedError,       setFeedError]      = useState(false);
  const [feedLoading,     setFeedLoading]    = useState(false);

  const uRef = useRef<HTMLDivElement>(null);
  const wRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setReady(true); }, []);

  // Redirect to landing if wallet disconnected — wait for wagmi to settle before redirecting
  useEffect(() => {
    if (ready && !address && wagmiStatus !== 'connecting' && wagmiStatus !== 'reconnecting') router.push('/');
  }, [address, ready, router, wagmiStatus]);

  // Fetch real data on mount — fall back to mock only in dev if DB is empty
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

  // Fetch user stats
  useEffect(() => {
    if (!ctxUser?.id) return;
    getUserStats(ctxUser.id).then(s => setPostCount(s.postCount)).catch(console.error);
  }, [ctxUser?.id]);
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

  const vote = (id: string, t: string) => setVotes(p => ({ ...p, [id]: p[id] === t ? null : t }));

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
    background: '#090A15', border: '1px solid rgba(107,159,212,0.12)',
    borderRadius: 3, padding: 4, boxShadow: '0 20px 60px rgba(0,0,0,0.9)', zIndex: 200,
  };

  return (
    <>
      <style>{`
        @keyframes fi { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pd { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
        .fi { animation: fi 0.42s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#04050C', color: 'rgba(190,208,238,0.68)', fontFamily: mono, fontSize: 11, opacity: ready ? 1 : 0, transition: 'opacity 0.4s' }}>

        <TunnelBackground />

        {/* Depth meter */}
        <div style={{ position: 'fixed', bottom: 14, right: 16, zIndex: 50, fontFamily: mono, fontSize: 8, color: 'rgba(107,159,212,0.18)', letterSpacing: '0.1em' }}>
          βάθος: {Math.floor(scrollY * 0.4)}m
        </div>

        {/* Meander bar */}
        <div style={{
          height: 2,
          background: 'repeating-linear-gradient(90deg,rgba(107,159,212,0.2) 0,rgba(107,159,212,0.2) 3px,transparent 3px,transparent 6px,rgba(107,159,212,0.2) 6px,rgba(107,159,212,0.2) 9px,transparent 9px,transparent 12px,rgba(107,159,212,0.12) 12px,rgba(107,159,212,0.12) 15px,transparent 15px,transparent 18px)',
          position: 'relative', zIndex: 101,
        }} />

        {/* Nav */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 46, background: 'rgba(4,5,12,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(107,159,212,0.07)' }}>

          {/* Left: logo + session meta + rec dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <KataLogo />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 9, letterSpacing: '0.07em', color: 'rgba(107,159,212,0.55)', fontWeight: 300 }}>
              <span>KATABASED</span>
              <span style={{ color: 'rgba(107,159,212,0.18)' }}>{'//'}</span>
              <span>v0.1</span>
              <span style={{ color: 'rgba(107,159,212,0.18)' }}>{'//'}</span>
              <span>ANON_MODE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 8, color: 'rgba(212,132,90,0.55)', letterSpacing: '0.1em', fontWeight: 400 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: terra, boxShadow: '0 0 5px rgba(212,132,90,0.4)', animation: 'pd 2s ease infinite', flexShrink: 0 }} />
              <span>REC</span>
            </div>
          </div>

          {/* Center: tabs */}
          <div style={{ display: 'flex', gap: 1 }}>
            {(['feed', 'explore', 'ranks', 'about', 'privacy'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchPage(t)}
                style={{
                  padding: '4px 11px', fontFamily: mono, fontSize: 9, fontWeight: 400,
                  border: `1px solid ${page === t ? 'rgba(107,159,212,0.22)' : 'transparent'}`,
                  borderRadius: 2, cursor: 'pointer', transition: 'all 0.18s',
                  background: page === t ? 'rgba(107,159,212,0.08)' : 'transparent',
                  color: page === t ? 'rgba(218,228,248,0.88)' : 'rgba(190,208,238,0.28)',
                  letterSpacing: '0.06em',
                }}
              >
                [{t === 'privacy' ? 'OPSEC' : t === 'feed' ? 'FEED_LOG' : t === 'explore' ? 'ENTITIES' : t.toUpperCase()}]
              </button>
            ))}
          </div>

          {/* Right: wallet + user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

            {/* Wallet */}
            <div ref={wRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setWMenu(!wMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 2, border: '1px solid rgba(107,159,212,0.14)', background: 'rgba(107,159,212,0.04)', cursor: 'pointer', fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.28)', letterSpacing: '0.04em', transition: 'all 0.18s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(107,159,212,0.3)'; el.style.color = 'rgba(190,208,238,0.65)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(107,159,212,0.14)'; el.style.color = 'rgba(190,208,238,0.4)'; }}
              >
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(107,159,212,0.7)', boxShadow: '0 0 4px rgba(107,159,212,0.35)', animation: 'pd 2s ease infinite', flexShrink: 0 }} />
                <span>{walletDisplay}</span>
              </button>
              {wMenu && (
                <div className="fi" style={{ ...dd, minWidth: 200 }}>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontFamily: mono, fontSize: 7, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(107,159,212,0.32)', marginBottom: 8 }}>WALLET</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(190,208,238,0.4)', letterSpacing: '0.04em' }}>{walletDisplay}</div>
                  </div>
                  <div style={{ height: 1, background: 'rgba(107,159,212,0.07)', margin: '3px 6px' }} />
                  <button
                    onClick={() => { disconnect(); setWMenu(false); }}
                    style={{ display: 'block', width: '100%', padding: '7px 10px', borderRadius: 2, fontFamily: mono, fontSize: 8, color: 'rgba(212,90,90,0.55)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,90,90,0.05)'; }}
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
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', background: 'transparent', cursor: 'pointer', transition: 'all 0.18s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(107,159,212,0.15)'; el.style.background = 'rgba(107,159,212,0.04)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,255,255,0.05)'; el.style.background = 'transparent'; }}
              >
                <div style={{ width: 18, height: 18, borderRadius: 2, background: 'rgba(107,159,212,0.1)', border: '1px solid rgba(107,159,212,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 10, fontWeight: 700, fontStyle: 'italic', color: blue }}>κ</div>
                <span style={{ fontFamily: mono, fontSize: 9, color: blue, letterSpacing: '0.05em' }}>{username}</span>
              </button>
              {uMenu && (
                <div className="fi" style={{ ...dd, minWidth: 240 }}>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: 7, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(107,159,212,0.32)', marginBottom: 8 }}>IDENTITY</div>
                    {editing ? (
                      <div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <input
                            value={draft}
                            onChange={e => { setDraft((e.target as HTMLInputElement).value); setEditError(''); }}
                            onKeyDown={e => { if (e.key === 'Enter' && draft.trim().length >= 3 && !isUpdating.current) { isUpdating.current = true; changeUsername(draft).then(() => { setEditing(false); setEditError(''); }).catch(err => setEditError(err.message ?? 'failed')).finally(() => { isUpdating.current = false; }); } }}
                            autoFocus
                            maxLength={24}
                            style={{ flex: 1, padding: '6px 9px', borderRadius: 2, border: `1px solid ${editError ? 'rgba(212,90,90,0.4)' : 'rgba(107,159,212,0.35)'}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 10, fontFamily: mono, outline: 'none', letterSpacing: '0.04em' }}
                          />
                          <button onClick={() => { if (draft.trim().length >= 3 && !isUpdating.current) { isUpdating.current = true; changeUsername(draft).then(() => { setEditing(false); setEditError(''); }).catch(err => setEditError(err.message ?? 'failed')).finally(() => { isUpdating.current = false; }); } }} style={{ padding: '6px 12px', borderRadius: 2, border: 'none', background: blue, color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: mono, letterSpacing: '0.06em' }}>SAVE</button>
                        </div>
                        {editError && <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(212,90,90,0.7)', marginTop: 5, letterSpacing: '0.05em' }}>{editError}</div>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: mono, fontSize: 10, color: blue, letterSpacing: '0.05em' }}>[{username}]</span>
                        <button onClick={() => { setDraft(username); setEditing(true); }} style={{ padding: '2px 7px', borderRadius: 2, border: '1px solid rgba(190,208,238,0.08)', background: 'none', color: 'rgba(190,208,238,0.3)', fontSize: 8, cursor: 'pointer', fontFamily: mono, letterSpacing: '0.08em' }}>EDIT</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </nav>

        {/* Main grid */}
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 100px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 26, position: 'relative', zIndex: 1 }}>

          {/* Left column */}
          <div style={{ opacity: transitioning ? 0 : 1, transform: transitioning ? 'translateY(5px)' : 'translateY(0)', transition: 'opacity 0.16s ease,transform 0.16s ease' }}>
            <div key={contentKey}>
              {page === 'feed'    && <FeedPage feed={feed} votes={votes} vote={vote} onCompose={() => { if (ctxUser?.id) setShowComposer(true); }} selectedEntity={selectedEntity} onClearEntity={() => setSelectedEntity(null)} loading={feedLoading} error={feedError} />}
              {page === 'explore' && <ExplorePage entities={entities} search={search} setSearch={setSearch} onSelectEntity={(name) => { setSelectedEntity(name); switchPage('feed'); }} />}
              {page === 'ranks'   && <RanksPage leaders={leaders} username={username} />}
              {page === 'about'   && (
                <div className="fi" style={{ animationDelay: '0.06s' }}>
                  <SecHead label="ABOUT" />
                  <div style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.85, color: 'rgba(190,208,238,0.58)', fontWeight: 300, letterSpacing: '0.015em', marginBottom: 28 }}>
                    <p style={{ marginBottom: 14 }}>κατάβασις — the descent. Anonymous intelligence from inside organizations. Corporations, government agencies, state departments, regulators, contractors — any entity that shapes the world but controls what&apos;s known about its interior. The surface is managed. The depths are not.</p>
                    <p style={{ marginBottom: 14 }}>Connect a wallet. Sign a message to prove ownership. Your public address is one-way hashed into an anonymous ID — the hash is on-chain, the wallet behind it is not. The entity you work for sees a pseudonym. We see the same.</p>
                    <p>This is a space for employees, contractors, whistleblowers, and insiders who want the truth known — about where they work, what they&apos;ve seen, and what the public deserves to hear. Nothing more.</p>
                  </div>

                  <SecHead label="INFORMATION_ASYMMETRY" mb={14} />
                  <div style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.85, color: 'rgba(190,208,238,0.58)', fontWeight: 300, letterSpacing: '0.015em', marginBottom: 28 }}>
                    <p style={{ marginBottom: 14 }}>Every organization produces two versions of itself. The public version — press releases, job postings, investor decks, PR. And the real version — what employees know, what contractors have seen, what the org chart doesn&apos;t show.</p>
                    <p style={{ marginBottom: 14 }}>That gap is information asymmetry. It advantages the institution over the individual, the employer over the candidate, the regulated over the regulator. kataBased exists to close it.</p>
                    <p style={{ color: 'rgba(107,159,212,0.5)', fontSize: 10, letterSpacing: '0.04em' }}>{'// anonymous · verified · permanent · on-chain'}</p>
                  </div>

                  <SecHead label="DATA_API" mb={14} />
                  <div style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.85, color: 'rgba(190,208,238,0.58)', fontWeight: 300, letterSpacing: '0.015em', marginBottom: 28 }}>
                    <p style={{ marginBottom: 14 }}>Aggregated company sentiment data — post volume, rolling sentiment scores, trending signals — is available via API for research, due diligence, and automated consumption.</p>
                    <p style={{ marginBottom: 14 }}>Access is tiered: delayed public data is free. Real-time feeds, webhooks, and raw historical data require a paid subscription key.</p>
                    <p style={{ color: 'rgba(107,159,212,0.5)', fontSize: 10, letterSpacing: '0.04em' }}>{'// API access: contact via on-chain message to the kataBased treasury address. Details forthcoming at launch.'}</p>
                  </div>

                  <SecHead label="PREDICTION_MARKETS" mb={14} />
                  <div style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.85, color: 'rgba(190,208,238,0.58)', fontWeight: 300, letterSpacing: '0.015em' }}>
                    <p style={{ marginBottom: 14 }}>The long-term vision: every post on kataBased is a signal. Signals should be priceable. Posts about an entity&apos;s internal health, leadership, or policy direction are leading indicators — the kind of information that moves before markets, elections, or investigations do.</p>
                    <p style={{ marginBottom: 14 }}>kataBased is designed to integrate with on-chain prediction markets. Verified insiders posting about their entity could anchor outcome resolution. Entity sentiment scores could seed market parameters. The intelligence becomes a bet, and the bet has consequence.</p>
                    <div style={{ marginTop: 18, padding: '14px 16px', border: '1px solid rgba(212,132,90,0.2)', background: 'rgba(212,132,90,0.03)', borderRadius: 2 }}>
                      <p style={{ fontFamily: mono, fontSize: 13, color: 'rgba(212,132,90,0.7)', letterSpacing: '0.01em', margin: 0, lineHeight: 1.6 }}>Every insider transmission is a leading indicator. Soon it will be priceable.</p>
                      <p style={{ fontFamily: mono, fontSize: 9, color: 'rgba(212,132,90,0.35)', letterSpacing: '0.06em', margin: '8px 0 0', }}>{'// on the roadmap — data model built for this from day one'}</p>
                    </div>
                  </div>
                </div>
              )}
              {page === 'privacy' && <OpsecPage />}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Coord label */}
            <div style={{ fontFamily: mono, fontSize: 7, color: 'rgba(107,159,212,0.38)', letterSpacing: '0.1em', textAlign: 'center', marginBottom: 4 }}>
              37.9°N · 23.7°E · ΕΛΛΆΔΑ
            </div>

            {/* Profile card */}
            <div className="fi" style={{ background: 'rgba(4,5,12,0.55)', border: '1px solid rgba(107,159,212,0.1)', borderRadius: 3, padding: 14, backdropFilter: 'blur(6px)', animationDelay: '0.06s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {/* Procedural per-user identity block — derived from username hash */}
                {(() => {
                  const hash = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                  const hue = (hash * 137) % 360;
                  const avatarColor = `hsl(${hue}, 35%, 45%)`;
                  const initial = username.replace('anon_', '')[0] ?? 'A';
                  return (
                    <div style={{ width: 36, height: 36, borderRadius: 3, border: `2px solid ${avatarColor}`, background: `hsla(${hue},35%,45%,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, fontStyle: 'italic', color: avatarColor, flexShrink: 0 }}>
                      {initial}
                    </div>
                  );
                })()}
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: blue, letterSpacing: '0.06em' }}>[{username}]</div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.18)', marginTop: 3, letterSpacing: '0.04em' }}>{joined} · {walletDisplay}</div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(107,159,212,0.07)', marginBottom: 12 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[{ v: karma, l: 'KARMA' }, { v: postCount, l: 'POSTS' }, { v: '—', l: 'STREAK' }, { v: '—', l: 'RANK' }].map(s => (
                  <div key={s.l} style={{ textAlign: 'center', padding: '5px 0' }}>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 600, color: 'rgba(218,228,248,0.95)', lineHeight: 1, letterSpacing: '-0.02em' }}>{s.v}</div>
                    <div style={{ fontFamily: mono, fontSize: 7, fontWeight: 400, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(107,159,212,0.3)', marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Link cards */}
            <div className="fi" style={{ animationDelay: '0.1s', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {((page === 'about' || page === 'privacy')
                ? [{ label: '// FEED', desc: 'Back to the stream', pg: 'feed' }, { label: '// EXPLORE', desc: 'Browse entities', pg: 'explore' }]
                : [{ label: '// ABOUT', desc: 'What this is and why', pg: 'about' }, { label: '// OPSEC', desc: 'Stay invisible', pg: 'privacy' }]
              ).map(l => (
                <div
                  key={l.label}
                  onClick={() => switchPage(l.pg)}
                  style={{ background: 'rgba(4,5,12,0.45)', border: '1px solid rgba(107,159,212,0.08)', borderRadius: 2, padding: '10px 12px', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'all 0.18s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(107,159,212,0.06)'; el.style.borderColor = 'rgba(107,159,212,0.2)'; el.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(4,5,12,0.45)'; el.style.borderColor = 'rgba(107,159,212,0.08)'; el.style.transform = 'none'; }}
                >
                  <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 500, color: 'rgba(218,228,248,0.55)', marginBottom: 2, letterSpacing: '0.06em' }}>{l.label}</div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.2)', letterSpacing: '0.04em' }}>{l.desc}</div>
                </div>
              ))}
            </div>

            {/* Prediction markets teaser */}
            {(page === 'feed' || page === 'explore') && (
              <div className="fi" onClick={() => switchPage('about')} style={{ animationDelay: '0.14s', background: 'rgba(212,132,90,0.03)', border: '1px solid rgba(212,132,90,0.1)', borderRadius: 2, padding: '10px 12px', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'all 0.18s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(212,132,90,0.07)'; el.style.borderColor = 'rgba(212,132,90,0.22)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(212,132,90,0.03)'; el.style.borderColor = 'rgba(212,132,90,0.1)'; }}
              >
                <div style={{ fontFamily: mono, fontSize: 7, fontWeight: 500, letterSpacing: '0.14em', color: 'rgba(212,132,90,0.45)', marginBottom: 4 }}>{'// COMING_SOON'}</div>
                <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 500, color: 'rgba(218,228,248,0.45)', marginBottom: 3, letterSpacing: '0.04em' }}>Prediction markets</div>
                <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.18)', letterSpacing: '0.03em', lineHeight: 1.6 }}>Every transmission is a signal. Signals should be priceable.</div>
              </div>
            )}

            {/* Live signal pulse */}
            <div className="fi" style={{ marginTop: 20, padding: '12px 14px', border: '1px solid rgba(107,159,212,0.08)', borderRadius: 2, background: 'rgba(107,159,212,0.02)', animationDelay: '0.18s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: blue, boxShadow: '0 0 5px rgba(107,159,212,0.5)', animation: 'pd 2s ease infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: mono, fontSize: 7, fontWeight: 500, letterSpacing: '0.18em', color: 'rgba(107,159,212,0.45)' }}>{'// LIVE_SIGNAL'}</span>
              </div>
              {entities.slice(0, 3).map(c => {
                const pct = Math.round(c.sent * 100);
                const hi  = pct >= 60;
                const lo  = pct < 40;
                const col = hi ? blue : lo ? terra : 'rgba(190,208,238,0.4)';
                return (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: col, opacity: 0.75, flexShrink: 0 }} />
                    <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(218,228,248,0.55)', letterSpacing: '0.04em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: col, letterSpacing: '0.02em', flexShrink: 0 }}>{pct}%</span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {signingIn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,5,12,0.92)', backdropFilter: 'blur(12px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.22em', color: 'rgba(107,159,212,0.6)', marginBottom: 16 }}>{'// VERIFY_IDENTITY'}</div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: blue, boxShadow: `0 0 12px ${blue}`, animation: 'pd 1s ease infinite', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: mono, fontSize: 11, color: 'rgba(190,208,238,0.55)', letterSpacing: '0.04em', lineHeight: 1.7 }}>
              Check your wallet.<br />
              <span style={{ color: 'rgba(190,208,238,0.28)', fontSize: 9 }}>Sign the message to prove ownership. No gas.</span>
            </div>
          </div>
        </div>
      )}

      {showComposer && (
        <ComposerModal
          userId={ctxUser?.id ?? ''}
          onPostCreated={(p) => setFeed(prev => [p, ...prev])}
          onClose={() => setShowComposer(false)}
        />
      )}
    </>
  );
}
