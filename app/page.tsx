'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
const KataLogoMarble = dynamic(() => import('@/app/components/KataLogoMarble'), { ssr: false, loading: () => null });
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useUser } from '@/lib/UserContext';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const mono    = "'kataGlyph Stele',Georgia,serif";
const serif   = "'kataGlyph Stele',Georgia,serif";
const sans    = "'kataGlyph Stele',Georgia,serif";
const display = "'kataGlyph Stele',Georgia,serif";
const celadon = '#D4631A';
const sigRed  = '#C89020';
const sigBlue = '#4DA6E8';
const text1   = '#C8D0DC';
const text2   = 'rgba(200,208,220,0.72)';
const text3   = 'rgba(200,208,220,0.50)';
const bg      = '#0A0A0B';
const rule    = 'rgba(200,208,220,0.07)';

// ─── Custom SVG logotype — hand-specified paths, not a font ──────────────────
// κ: vertical stem + two arms with ink-trap notch at junction
// β: tall stem + stacked bowls, lower bowl wider, stem descends below
// ViewBox 128×80 — scale via height prop
// ─── Logotype — Greek characters, typographically refined ────────────────────
function KbLogo({ size = 'hero' }: { size?: 'hero' | 'nav' }) {
  const isHero = size === 'hero';
  const fs     = isHero ? 118 : 22;
  const gap    = isHero ? 4   : 1;
  return (
    <div style={{
      display:        'flex',
      alignItems:     'baseline',
      gap,
      userSelect:     'none',
      lineHeight:     1,
      letterSpacing:  isHero ? '-0.04em' : '-0.02em',
    }}>
      <span style={{
        fontFamily:  "'kataGlyph Stele',Georgia,serif",
        fontStyle:   'normal',
        fontWeight:  400,
        fontSize:    fs,
        color:       celadon,
        textShadow:  isHero
          ? `0 0 1px ${celadon}, 0 0 18px rgba(212,99,26,0.45), 0 0 60px rgba(212,99,26,0.12)`
          : `0 0 1px ${celadon}, 0 0 8px rgba(212,99,26,0.35)`,
        display:     'inline-block',
        transform:   isHero ? 'translateY(0.04em)' : 'none',
      }}>κ</span>
      <span style={{
        fontFamily:  "'kataGlyph Stele',Georgia,serif",
        fontStyle:   'normal',
        fontWeight:  400,
        fontSize:    fs * 0.92,
        color:       text1,
        opacity:     0.82,
        display:     'inline-block',
        transform:   isHero ? 'translateY(-0.03em)' : 'none',
      }}>β</span>
    </div>
  );
}

// ─── Tagline char-by-char reveal ──────────────────────────────────────────────
function TaglineReveal({ text, delay = 0 }: { text: string; delay?: number }) {
  const [revealed, setRevealed] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (revealed >= text.length) return;
    const t = setTimeout(() => setRevealed(r => r + 1), 14);
    return () => clearTimeout(t);
  }, [started, revealed, text.length]);

  return (
    <span>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          style={{
            opacity: i < revealed ? 1 : 0,
            transition: 'opacity 0.035s',
            display: 'inline',
          }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  );
}

// ─── Intersection observer fade-up hook ──────────────────────────────────────
function useFadeIn(threshold = 0.05) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fire immediately if already in viewport on mount (avoids stall above-fold)
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold, rootMargin: '0px 0px -5% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useFadeIn();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'perspective(800px) rotateX(0deg) translateY(0)'
          : 'perspective(800px) rotateX(8deg) translateY(10px)',
        transformOrigin: 'top center',
        transition: `opacity 0.35s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.40s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Quote slab — 3D tilt on hover, like reading an inscription ───────────────
function QuoteSlab() {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const nx = (e.clientX - left) / width  - 0.5;
    const ny = (e.clientY - top)  / height - 0.5;
    setTilt({ rx: -ny * 5, ry: nx * 7 });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ rx: 0, ry: 0 }); }}
      onMouseMove={onMove}
      style={{
        fontFamily: display,
        fontSize: 'clamp(36px,3vw+20px,52px)',
        lineHeight: 1.18,
        color: text1,
        letterSpacing: '0.01em',
        marginBottom: 48,
        maxWidth: 540,
        cursor: 'default',
        // 3D stone slab tilt — like reading an inscription on a leaning tablet
        transform: hovered
          ? `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(8px)`
          : 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)',
        transformStyle: 'preserve-3d',
        transition: hovered
          ? 'transform 0.08s ease'
          : 'transform 0.55s cubic-bezier(0.16,1,0.3,1)',
        // Subtle engraved text shadow on hover — depth of carved letters
        textShadow: hovered
          ? `1px 2px 4px rgba(0,0,0,0.6), 0 0 40px rgba(200,208,220,0.08)`
          : 'none',
        willChange: 'transform',
      }}
    >
      &ldquo;Every organization produces two versions of itself.&rdquo;
    </div>
  );
}

export default function Home() {
  const { isConnected } = useAccount();
  const { user, loading, signingIn, refetchUser } = useUser();
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const s = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', s, { passive: true });
    return () => window.removeEventListener('scroll', s);
  }, []);

  useEffect(() => {
    if (isConnected && user && !loading) router.push('/dashboard');
  }, [isConnected, user, loading, router]);

  const ctaLabel = signingIn
    ? 'VERIFYING…'
    : isConnected && !user
    ? 'RETRY'
    : isConnected && user
    ? 'CONNECTED'
    : 'DESCEND';

  const ctaDisabled = signingIn || (isConnected && !!user);

  const handleCta = () => {
    if (ctaDisabled) return;
    if (!isConnected && openConnectModal) openConnectModal();
    else if (isConnected && !user && !loading) refetchUser();
  };

  const depthVal = Math.floor(scrollY * 0.4);

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes breathe      { 0%,100%{transform:scale(1)} 50%{transform:scale(1.006)} }
        @keyframes celadonGlow  { 0%,100%{box-shadow:0 0 16px rgba(212,99,26,0.2),0 0 0 1px rgba(212,99,26,0.28)} 50%{box-shadow:0 0 32px rgba(212,99,26,0.42),0 0 0 1px rgba(212,99,26,0.52)} }
        @keyframes appear       { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotPulse     { 0%,100%{opacity:1} 50%{opacity:0.12} }
        @keyframes scanH        { 0%{transform:scaleX(0);transform-origin:left} 50%{transform:scaleX(1);transform-origin:left} 50.01%{transform:scaleX(1);transform-origin:right} 100%{transform:scaleX(0);transform-origin:right} }
        .logo-breathe  { animation: breathe     4.5s ease-in-out infinite; }
        .cta-glow      { animation: celadonGlow 1.8s ease-in-out infinite; }
        .hero-appear   { animation: appear      0.45s cubic-bezier(0.16,1,0.3,1) forwards; opacity:0; }
        .dot-pulse     { animation: dotPulse    2.2s ease infinite; }
        @media (max-width:600px) {
          .hero-logo-main { font-size:68px !important; }
          .kb-nav { padding: 0 16px !important; }
          .kb-hero { padding: 72px 20px 0 !important; }
          .kb-cta { width: 160px !important; }
          .kb-section { padding: 0 20px !important; }
          .kb-depth { display: none !important; }
        }
      `}</style>


      {/* ── HERO LOGO — fixed at tunnel vanishing point (50.2%, 44%) ────────────── */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top:      '44vh',
          left:     '50.2%',
          transform: `translate(-50%, -50%) scale(${Math.max(0.18, 1 - scrollY / 620)})`,
          transformOrigin: 'center',
          opacity:  Math.max(0, 1 - scrollY / 680),
          zIndex:   5,
          pointerEvents: 'none',
          willChange: 'transform, opacity',
        }}
      >
        <Suspense fallback={
          <div style={{ width: 600, height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'kataGlyph Stele',Georgia,serif", fontStyle: 'normal', fontSize: 175, color: celadon, opacity: 0.5 }}>κβ</span>
          </div>
        }>
          <KataLogoMarble size="large" scrollY={scrollY} />
        </Suspense>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────────────────── */}
      <div
        id="hero"
        ref={heroRef}
        className="kb-hero"
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
          minHeight: '100vh', padding: '68vh 32px 52px',
          textAlign: 'center',
        }}
      >
        {/* Tagline — cold serif, not warm */}
        <div
          className="hero-appear"
          style={{
            fontFamily: display,
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.25,
            color: text1,
            maxWidth: 520,
            marginBottom: 14,
            letterSpacing: '0.02em',
            animationDelay: '180ms',
          }}
        >
          {mounted && (
            <>
              <TaglineReveal text="Surface is managed." delay={60} />
              <br />
              <TaglineReveal text="Depths are not." delay={220} />
            </>
          )}
        </div>

        {/* Subtitle */}
        <div
          className="hero-appear"
          style={{
            fontFamily: serif,
            fontStyle: 'italic',
            fontSize: 13,
            color: 'rgba(212,99,26,0.4)',
            letterSpacing: '0.3em',
            marginBottom: 56,
            animationDelay: '200ms',
          }}
        >
          κατάβασις
        </div>

        {/* CTA cluster */}
        <div className="hero-appear" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animationDelay: '300ms' }}>
          {signingIn && (
            <div style={{
              fontFamily: mono, fontSize: 10, letterSpacing: '0.2em',
              color: 'rgba(212,99,26,0.5)', textTransform: 'uppercase',
            }}>
              Sign message in wallet →
            </div>
          )}
          <button
            onClick={handleCta}
            disabled={ctaDisabled}
            className={`kb-cta${(!isConnected || (!user && !loading && !signingIn)) ? ' cta-glow' : ''}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10,
              width: 200, height: 48,
              borderRadius: 2,
              border: signingIn
                ? `1px solid rgba(212,99,26,0.4)`
                : isConnected && user
                ? `1px solid rgba(212,99,26,0.62)`
                : `1px solid rgba(212,99,26,0.52)`,
              background: signingIn
                ? 'rgba(212,99,26,0.10)'
                : isConnected && user
                ? 'rgba(212,99,26,0.16)'
                : 'rgba(212,99,26,0.14)',
              cursor: ctaDisabled ? 'default' : 'pointer',
              transition: 'background 0.2s, border-color 0.2s, transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s ease',
              transformStyle: 'preserve-3d',
              fontFamily: mono,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.32em',
              color: signingIn
                ? 'rgba(212,99,26,0.7)'
                : isConnected && user
                ? celadon
                : 'rgba(212,99,26,0.82)',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => {
              if (ctaDisabled) return;
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(212,99,26,0.12)';
              el.style.borderColor = 'rgba(212,99,26,0.6)';
              el.style.transform = 'perspective(400px) rotateX(6deg) translateZ(-4px) translateY(2px)';
              el.style.boxShadow = '0 8px 24px rgba(212,99,26,0.22), 0 2px 0 rgba(212,99,26,0.18), inset 0 -2px 0 rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              if (ctaDisabled) return;
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(212,99,26,0.14)';
              el.style.borderColor = 'rgba(212,99,26,0.52)';
              el.style.transform = 'perspective(400px) rotateX(0deg) translateZ(0px) translateY(0px)';
              el.style.boxShadow = '';
            }}
            onMouseDown={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'perspective(400px) rotateX(10deg) translateZ(-8px) translateY(4px)';
              el.style.boxShadow = '0 2px 8px rgba(212,99,26,0.12), 0 1px 0 rgba(212,99,26,0.1)';
            }}
            onMouseUp={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'perspective(400px) rotateX(6deg) translateZ(-4px) translateY(2px)';
              el.style.boxShadow = '0 8px 24px rgba(212,99,26,0.22), 0 2px 0 rgba(212,99,26,0.18)';
            }}
          >
            {signingIn && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(212,99,26,0.7)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            {ctaLabel}
          </button>

        </div>

        {/* Scroll indicator — vertical rule */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 1, height: 44,
            background: `linear-gradient(180deg, rgba(212,99,26,0.4) 0%, rgba(212,99,26,0) 100%)`,
          }} />
          <div style={{
            fontFamily: mono, fontSize: 9, letterSpacing: '0.24em',
            color: 'rgba(212,99,26,0.3)', textTransform: 'lowercase',
          }}>
            scroll
          </div>
        </div>
      </div>

      {/* ── TRANSMISSIONS — no cards, text in space ───────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 580, margin: '0 auto 96px', padding: '0 36px' }}>
        <FadeUp delay={0}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 36 }}>
            <div style={{
              fontFamily: mono, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.32em', color: 'rgba(200,208,220,0.48)',
              textTransform: 'uppercase',
            }}>
              {'// recent transmissions'}
            </div>
            <div style={{
              fontFamily: mono, fontSize: 8, letterSpacing: '0.12em',
              color: 'rgba(200,208,220,0.22)', textTransform: 'uppercase',
            }}>
              example
            </div>
          </div>
        </FadeUp>

        {[
          { entity: 'Drift',       title: 'team wallet moved to Bybit during the active DPRK incident. not after. nobody on the post-mortem had a straight answer.', confirms: 284, disputes: 22, time: '2h',  signal: 3 },
          { entity: 'Wintermute',  title: 'market make your token while running prop on the same book. nobody tells you that in the term sheet.',                   confirms: 341, disputes: 47, time: '6h',  signal: 3 },
          { entity: 'Hyperliquid', title: '70% of onchain perps OI and that is not even the play. they are building data infra the exchange is a front-end for.',   confirms: 489, disputes: 8,  time: '9h',  signal: 3 },
          { entity: 'Polymarket',  title: 'Kalshi spends 3x on marketing and still cannot close the gap. no KYC is the product.',                                    confirms: 341, disputes: 47, time: '14h', signal: 2 },
          { entity: 'TRM Labs',    title: 'paid by the same exchanges we are supposed to flag. biggest contracts generate the most suspicious volume.',              confirms: 198, disputes: 12, time: '1d',  signal: 2 },
        ].map((p, i) => {
          const total = p.confirms + p.disputes;
          const confPct = total > 0 ? (p.confirms / total) * 100 : 50;
          return (
            <FadeUp key={i} delay={i * 30}>
              <PreviewEntry p={p} confPct={confPct} />
            </FadeUp>
          );
        })}

        <FadeUp delay={120}>
          <div style={{
            fontFamily: mono, fontSize: 10, color: 'rgba(200,208,220,0.45)',
            letterSpacing: '0.16em', marginTop: 36, textAlign: 'center',
          }}>
            connect wallet → full archive
          </div>
        </FadeUp>
      </div>

      {/* ── Section anchors ──────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', gap: 48, paddingBottom: 72 }}>
        {[{ label: 'About', href: '#about' }, { label: 'OpSec', href: '#opsec' }].map(l => (
          <a
            key={l.href}
            href={l.href}
            style={{
              fontFamily: sans, fontSize: 13, fontWeight: 400,
              letterSpacing: '0.02em', color: text3,
              textDecoration: 'none', transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = text2; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = text3; }}
          >
            {l.label}
          </a>
        ))}
      </div>

      {/* ── ABOUT ────────────────────────────────────────────────────────────── */}
      <div id="about" style={{ position: 'relative', zIndex: 10, maxWidth: 640, margin: '0 auto', padding: '72px 36px' }}>
        <div style={{ height: 1, background: rule, marginBottom: 64 }} />

        <FadeUp>
          <QuoteSlab />
        </FadeUp>

        <FadeUp delay={80}>
          <div style={{
            fontFamily: sans, fontSize: 15, lineHeight: 1.95,
            color: text2, fontWeight: 400,
            marginBottom: 22, letterSpacing: '0.005em',
          }}>
            Anonymous intelligence from inside organizations. Corporations, government agencies, state departments, regulators, contractors — any entity that shapes the world but controls what is known about its interior.
          </div>
        </FadeUp>

        <FadeUp delay={160}>
          <div style={{
            fontFamily: sans, fontSize: 15, lineHeight: 1.95,
            color: text3, fontWeight: 400,
            letterSpacing: '0.005em',
          }}>
            Wallet-anchored identity. No email. No account. Nothing stored. The truth, permanently.
          </div>
        </FadeUp>

        <FadeUp delay={240}>
          <div style={{ marginTop: 44, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['anonymous', 'verified', 'permanent', 'on-chain'].map(tag => (
              <span key={tag} style={{
                fontFamily: mono, fontSize: 10, letterSpacing: '0.18em',
                color: 'rgba(212,99,26,0.45)',
                borderBottom: '1px solid rgba(212,99,26,0.2)',
                paddingBottom: 2,
                textTransform: 'lowercase',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </FadeUp>
      </div>

      {/* ── OPSEC — vertical descent timeline ───────────────────────────────── */}
      <div id="opsec" style={{ position: 'relative', zIndex: 10, maxWidth: 640, margin: '0 auto', padding: '0 36px 112px' }}>
        <div style={{ height: 1, background: rule, marginBottom: 64 }} />

        <FadeUp>
          <div style={{
            fontFamily: mono, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.32em', color: 'rgba(212,99,26,0.35)',
            marginBottom: 14, textTransform: 'uppercase',
          }}>
            {'// descent protocol'}
          </div>
          <div style={{
            fontFamily: display,
            fontSize: 'clamp(28px,2.5vw+16px,40px)',
            lineHeight: 1.22,
            color: text1,
            letterSpacing: '0.01em',
            marginBottom: 52,
          }}>
            Anonymity is only as strong as its weakest step.
          </div>
        </FadeUp>

        {/* Timeline tiers */}
        <div style={{ position: 'relative', paddingLeft: 36 }}>
          {/* Vertical spine */}
          <div style={{
            position: 'absolute', left: 6, top: 0, bottom: 0,
            width: 1,
            background: 'linear-gradient(180deg, rgba(212,99,26,0) 0%, rgba(212,99,26,0.28) 8%, rgba(212,99,26,0.28) 92%, rgba(212,99,26,0) 100%)',
          }} />

          {[
            {
              tier: 'T0', label: 'Mindset', depth: 'surface',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><line x1="12" y1="2" x2="12" y2="1"/></svg>,
              summary: 'Compartmentalize. Never link your real identity to this wallet.',
              detail: [
                'Treat every interaction on this platform as if it could be subpoenaed.',
                'Never use a username, phrase, or pattern you\'ve used anywhere else online.',
                'Assume your employer monitors your activity — write nothing you wouldn\'t say to their face.',
                'Your wallet address is your identity here. Guard it accordingly.',
              ],
            },
            {
              tier: 'T1', label: 'Network', depth: '−100m',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M3 12h18"/></svg>,
              summary: 'VPN or Tor. Mullvad accepts Monero. No-log policy only.',
              detail: [
                'A residential IP leaks your approximate location and can be correlated with your employer\'s network.',
                'Mullvad, ProtonVPN, or IVPN — all accept crypto, all have audited no-log policies.',
                'Tor is stronger but slower. Use it if you\'re posting about sensitive ongoing situations.',
                'Never connect to this platform from a corporate device or corporate Wi-Fi.',
              ],
            },
            {
              tier: 'T2', label: 'Wallet isolation', depth: '−500m',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M16 11a2 2 0 0 1 0 4"/><path d="M6 7V5a6 6 0 0 1 12 0v2"/></svg>,
              summary: 'Dedicated wallet. Never fund from a KYC exchange directly.',
              detail: [
                'Create a wallet used only for this platform. No DeFi, no NFTs, no other activity.',
                'Funding directly from Coinbase or Binance creates a chain-of-custody link to your legal identity.',
                'Use a privacy-preserving bridge: RAILGUN for EVM, XMR swap for cross-chain isolation.',
                'Hardware wallet is ideal. Browser extension wallets expose metadata to sites.',
              ],
            },
            {
              tier: 'T3', label: 'On-chain privacy', depth: '−2km',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
              summary: 'Break the fund trail with RAILGUN or XMR bridge before depositing.',
              detail: [
                'Chain analytics firms (Chainalysis, TRM) can trace fund flows back to KYC sources.',
                'RAILGUN provides shielded on-chain transfers using zk-proofs. No off-chain custodian.',
                'Monero→ETH atomic swaps exist via decentralized protocols. Research current options.',
                'Even with perfect fund isolation, on-chain behavior patterns can be fingerprinted. Vary timing.',
              ],
            },
            {
              tier: 'T4', label: 'Full ghost mode', depth: '−abyss',
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="12" x2="15" y2="12" strokeOpacity="0"/><path d="M9 12l2 2 4-4"/></svg>,
              summary: 'Tails OS. Air-gapped key gen. Behavioral OPSEC. Zero trace.',
              detail: [
                'Tails OS boots from USB, leaves no trace on hardware, routes all traffic through Tor by default.',
                'Generate your wallet keys on an air-gapped machine that has never touched the internet.',
                'Behavioral patterns are as identifying as metadata: time of day, writing style, post frequency.',
                'At this tier, assume state-level adversaries. The threat model is employment, not criminal law.',
              ],
            },
          ].map((r, i) => {
            const isOpen = expandedTier === r.tier;
            const nodeCol = i === 4 ? sigRed : i === 0 ? 'rgba(212,99,26,0.5)' : celadon;
            return (
              <FadeUp key={r.tier} delay={i * 110}>
                <div style={{ marginBottom: i < 4 ? 8 : 0, position: 'relative' }}>
                  {/* Node */}
                  <div style={{
                    position: 'absolute', left: -30, top: 16,
                    width: 9, height: 9, borderRadius: '50%',
                    background: bg,
                    border: `1px solid ${nodeCol}`,
                    boxShadow: isOpen ? `0 0 12px ${nodeCol}` : `0 0 5px ${nodeCol}66`,
                    transition: 'box-shadow 0.2s',
                  }} />

                  {/* Tap target row */}
                  <button
                    onClick={() => setExpandedTier(isOpen ? null : r.tier)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '12px 0', textAlign: 'left',
                      borderTop: `1px solid ${isOpen ? 'rgba(212,99,26,0.12)' : 'rgba(200,208,220,0.06)'}`,
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        color: i === 4 ? sigRed : celadon,
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                        opacity: isOpen ? 1 : 0.65, transition: 'opacity 0.2s',
                      }}>{r.icon}</span>
                      <span style={{
                        fontFamily: mono, fontSize: 9, fontWeight: 600,
                        letterSpacing: '0.24em', textTransform: 'uppercase',
                        color: i === 4 ? sigRed : celadon,
                      }}>{r.tier}</span>
                      <span style={{
                        fontFamily: sans, fontSize: 15, fontWeight: 500,
                        color: text1, letterSpacing: '-0.01em',
                      }}>{r.label}</span>
                      <span style={{
                        fontFamily: mono, fontSize: 9, letterSpacing: '0.16em',
                        color: i === 4 ? 'rgba(229,90,0,0.5)' : 'rgba(212,99,26,0.35)',
                        marginLeft: 'auto', marginRight: 8,
                      }}>{r.depth}</span>
                      <span style={{
                        fontFamily: mono, fontSize: 11,
                        color: isOpen ? celadon : text3,
                        transition: 'color 0.2s, transform 0.2s',
                        display: 'inline-block',
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      }}>+</span>
                    </div>
                    <div style={{
                      fontFamily: sans, fontSize: 13, lineHeight: 1.6,
                      color: text2, marginTop: 5, maxWidth: 460,
                    }}>{r.summary}</div>
                  </button>

                  {/* Expanded drawer */}
                  <div style={{
                    overflow: 'hidden',
                    maxHeight: isOpen ? 400 : 0,
                    transition: 'max-height 0.35s cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    <div style={{
                      paddingBottom: 20, paddingTop: 4,
                      borderLeft: `1px solid rgba(212,99,26,0.15)`,
                      marginLeft: 2, paddingLeft: 18,
                    }}>
                      {r.detail.map((line, j) => (
                        <div key={j} style={{
                          fontFamily: sans, fontSize: 13, lineHeight: 1.75,
                          color: text2,
                          marginBottom: j < r.detail.length - 1 ? 10 : 0,
                          opacity: 0,
                          animation: isOpen ? `fadeIn 0.3s ease ${j * 60}ms forwards` : 'none',
                        }}>
                          <span style={{ color: celadon, marginRight: 8, fontSize: 10 }}>›</span>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </FadeUp>
            );
          })}
        </div>

        <FadeUp delay={200}>
          <div style={{
            marginTop: 52, fontFamily: mono, fontSize: 9,
            color: 'rgba(200,208,220,0.48)', letterSpacing: '0.2em',
          }}>
            full guide → sign in → privacy tab
          </div>
        </FadeUp>
      </div>

      {/* Fixed depth meter */}
      <div className="kb-depth" style={{
        position: 'fixed', bottom: 16, left: 20, zIndex: 50,
        fontFamily: mono, fontSize: 10, color: 'rgba(212,99,26,0.25)',
        letterSpacing: '0.16em',
        transition: 'opacity 0.3s',
        opacity: scrollY > 40 ? 1 : 0,
      }}>
        βάθος: {depthVal}m
      </div>
    </div>
  );
}

// ── Preview entry — no cards, text in space ──────────────────────────────────
function PreviewEntry({ p, confPct }: { p: { entity: string; title: string; confirms: number; disputes: number; time: string; signal: number }; confPct: number }) {
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const nx = (e.clientX - left) / width  - 0.5;  // -0.5 to 0.5
    const ny = (e.clientY - top)  / height - 0.5;
    setTilt({ rx: -ny * 6, ry: nx * 8 });           // max ±3° X, ±4° Y
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ rx: 0, ry: 0 }); }}
      onMouseMove={handleMouseMove}
      style={{
        paddingLeft: 14,
        paddingTop: 0,
        paddingBottom: 24,
        cursor: 'default',
        boxShadow: hovered
          ? '-2px 0 0 rgba(212,99,26,0.45)'
          : '-2px 0 0 rgba(212,99,26,0)',
        // 3D tilt — feels like picking up a clay tablet
        transform: hovered
          ? `perspective(600px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(4px)`
          : 'perspective(600px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
        transformStyle: 'preserve-3d',
        transition: hovered
          ? 'box-shadow 0.22s ease, transform 0.08s ease'
          : 'box-shadow 0.22s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        willChange: 'transform',
      }}
    >
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{
          fontFamily: mono, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.22em',
          color: hovered ? celadon : 'rgba(212,99,26,0.6)',
          textTransform: 'uppercase',
          textShadow: hovered ? `0 0 16px rgba(212,99,26,0.45)` : 'none',
          transition: 'color 0.18s, text-shadow 0.18s',
        }}>
          {p.entity}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(200,208,220,0.3)', letterSpacing: '0.1em' }}>{p.time}</span>
          <span style={{
            fontFamily: mono, fontSize: 8, letterSpacing: '0.18em',
            color: p.signal === 3 ? 'rgba(77,166,232,0.7)' : p.signal === 2 ? 'rgba(77,166,232,0.42)' : 'rgba(200,208,220,0.2)',
          }}>
            {p.signal === 3 ? '◆ HIGH' : p.signal === 2 ? '◈ MED' : '◻ LOW'}
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: sans, fontSize: 16, fontWeight: 400,
        color: hovered ? text1 : 'rgba(200,208,220,0.8)',
        lineHeight: 1.5, marginBottom: 4,
        letterSpacing: '-0.015em',
        transition: 'color 0.18s',
      }}>
        {p.title}
      </div>

      {/* Ratio bar — 1.5px */}
      <div style={{
        height: 1.5, width: '100%', marginTop: 10, marginBottom: 2,
        overflow: 'hidden', display: 'flex',
        opacity: hovered ? 1 : 0.38,
        transition: 'opacity 0.18s',
      }}>
        <div style={{ width: `${confPct}%`, background: 'rgba(77,166,232,0.55)', height: '100%' }} />
        <div style={{ flex: 1, background: 'rgba(229,90,0,0.3)', height: '100%' }} />
      </div>
      <div style={{
        display: 'flex', gap: 12, marginTop: 5,
        opacity: hovered ? 0.7 : 0.28,
        transition: 'opacity 0.18s',
      }}>
        <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.12em', color: 'rgba(77,166,232,0.8)' }}>
          ▪ {p.confirms} confirms
        </span>
        <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.12em', color: 'rgba(229,90,0,0.7)' }}>
          ▪ {p.disputes} disputes
        </span>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'rgba(200,208,220,0.05)', marginTop: 24 }} />
    </div>
  );
}
