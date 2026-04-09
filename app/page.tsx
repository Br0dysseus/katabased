'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useUser } from '@/lib/UserContext';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import TunnelBackground from '@/components/TunnelBackground';

const mono  = "'JetBrains Mono',monospace";
const serif = "'Cormorant Garamond',serif";
const blue  = '#6B9FD4';
const terra = '#D4845A';

const MEANDER = 'repeating-linear-gradient(90deg,rgba(107,159,212,0.2) 0,rgba(107,159,212,0.2) 3px,transparent 3px,transparent 6px,rgba(107,159,212,0.2) 6px,rgba(107,159,212,0.2) 9px,transparent 9px,transparent 12px,rgba(107,159,212,0.12) 12px,rgba(107,159,212,0.12) 15px,transparent 15px,transparent 18px)';

export default function Home() {
  const { isConnected } = useAccount();
  const { user, loading } = useUser();
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const s = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', s, { passive: true });
    return () => window.removeEventListener('scroll', s);
  }, []);

  useEffect(() => {
    if (isConnected && user && !loading) {
      router.push('/dashboard');
    }
  }, [isConnected, user, loading, router]);

  return (
    <div style={{ minHeight: '100vh', background: '#04050C', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes pd  { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes lfi { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .lfi { animation: lfi 0.55s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
        @keyframes btnGlow { 0%,100%{box-shadow:0 0 10px rgba(107,159,212,0.12),inset 0 0 12px rgba(107,159,212,0.03)} 50%{box-shadow:0 0 18px rgba(107,159,212,0.22),inset 0 0 18px rgba(107,159,212,0.06)} }
        .descent-btn { animation: btnGlow 2.8s ease infinite; }
        @keyframes tunnelReveal { 0%{opacity:0} 100%{opacity:1} }
        .tunnel-reveal { animation: tunnelReveal 0.8s ease-in forwards; }
        .descent-btn:hover { box-shadow: 0 0 24px rgba(107,159,212,0.35) !important; border-color: rgba(107,159,212,0.65) !important; color: rgba(218,228,248,0.95) !important; }
        @keyframes bydFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .byd-block { animation: bydFade 0.6s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
        @media (max-width: 600px) {
          .landing-stats { gap: 18px !important; }
          .landing-hero  { padding: 0 20px !important; }
          .landing-copy  { font-size: 10px !important; }
          .landing-logo  { font-size: 56px !important; }
        }
      `}</style>

      <div className="tunnel-reveal"><TunnelBackground dimOpacity={0.58} /></div>

      {/* Meander bar */}
      <div style={{ height: 2, background: MEANDER, position: 'relative', zIndex: 10 }} />

      {/* Top session bar */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 9, letterSpacing: '0.07em', color: 'rgba(107,159,212,0.45)', fontWeight: 300 }}>
          <span>KATABASED</span>
          <span style={{ color: 'rgba(107,159,212,0.18)' }}>{'//'}</span>
          <span>v0.1</span>
          <span style={{ color: 'rgba(107,159,212,0.18)' }}>{'//'}</span>
          <span>ANON_MODE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 8, color: 'rgba(212,132,90,0.55)', letterSpacing: '0.1em' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: terra, boxShadow: `0 0 5px rgba(212,132,90,0.4)`, animation: 'pd 2.2s ease infinite', flexShrink: 0 }} />
          <span>REC</span>
        </div>
      </div>

      {/* Hero */}
      <div
        className="landing-hero"
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 'calc(100vh - 80px)', padding: '0 32px', textAlign: 'center',
        }}
      >

        {/* κβ logo */}
        <div
          className="lfi landing-logo"
          style={{ fontFamily: serif, fontWeight: 700, fontStyle: 'italic', fontSize: 76, lineHeight: 1, letterSpacing: '-0.04em', userSelect: 'none', display: 'flex', alignItems: 'baseline', marginBottom: 8, animationDelay: '0.08s' }}
        >
          <span style={{ color: blue }}>κ</span>
          <span style={{ color: 'rgba(218,228,248,0.92)', marginLeft: 5 }}>β</span>
        </div>

        {/* Greek name */}
        <div className="lfi" style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 14, color: 'rgba(107,159,212,0.5)', letterSpacing: '0.2em', marginBottom: 36, animationDelay: '0.16s' }}>
          κατάβασις — the descent
        </div>

        {/* Divider */}
        <div className="lfi" style={{ width: 180, height: 1, background: 'rgba(107,159,212,0.12)', marginBottom: 36, animationDelay: '0.20s' }} />

        {/* Tagline */}
        <div
          className="lfi landing-copy"
          style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.95, color: 'rgba(190,208,238,0.48)', maxWidth: 400, marginBottom: 14, letterSpacing: '0.015em', fontWeight: 300, animationDelay: '0.26s' }}
        >
          Surface is managed. Depths are not.
        </div>

        {/* Stats counters */}
        <div
          className="lfi landing-stats"
          style={{ display: 'flex', gap: 32, marginBottom: 44, animationDelay: '0.32s' }}
        >
          {([['342', 'TRANSMISSIONS'], ['47', 'COMPANIES'], ['12k', 'KARMA_POOL']] as const).map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 600, color: 'rgba(218,228,248,0.3)', lineHeight: 1, letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontFamily: mono, fontSize: 7, color: 'rgba(107,159,212,0.18)', letterSpacing: '0.16em', marginTop: 5 }}>{l}</div>
              <div style={{ fontFamily: mono, fontSize: 6, color: 'rgba(107,159,212,0.15)', letterSpacing: '0.1em', marginTop: 2 }}>// ESTIMATED</div>
            </div>
          ))}
        </div>

        {/* BEFORE_YOU_DESCEND */}
        <div
          className="lfi byd-block"
          style={{
            maxWidth: 360,
            marginBottom: 28,
            padding: '12px 16px',
            borderLeft: '2px solid rgba(107,159,212,0.25)',
            background: 'rgba(107,159,212,0.025)',
            animationDelay: '0.34s',
          }}
        >
          <div style={{ fontFamily: mono, fontSize: 7, fontWeight: 500, letterSpacing: '0.18em', color: 'rgba(107,159,212,0.38)', marginBottom: 8, textTransform: 'uppercase' }}>{'// BEFORE_YOU_DESCEND'}</div>
          {[
            'Your wallet address will be one-way hashed.',
            'The hash anchors your identity on-chain.',
            'The wallet behind it is never stored.',
            'What you write here cannot be taken back.',
          ].map((line, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: 10, lineHeight: 1.8, color: 'rgba(190,208,238,0.35)', letterSpacing: '0.01em', fontWeight: 300 }}>{line}</div>
          ))}
        </div>

        {/* Connect section */}
        <div className="lfi" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animationDelay: '0.42s' }}>
          <div style={{ fontFamily: mono, fontSize: 7, letterSpacing: '0.2em', color: 'rgba(107,159,212,0.28)', textTransform: 'uppercase' }}>
            {'// CONNECT_WALLET_TO_ENTER'}
          </div>
          <button
            onClick={() => { if (!isConnected && openConnectModal) openConnectModal(); }}
            className={isConnected ? '' : 'descent-btn'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 28px',
              borderRadius: 2,
              border: isConnected ? '1px solid rgba(74,222,128,0.35)' : '1px solid rgba(107,159,212,0.3)',
              background: isConnected ? 'rgba(74,222,128,0.05)' : 'rgba(107,159,212,0.06)',
              color: isConnected ? 'rgba(74,222,128,0.8)' : 'rgba(190,208,238,0.75)',
              fontFamily: mono,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isConnected ? '#4ADE80' : blue,
              boxShadow: isConnected ? '0 0 6px rgba(74,222,128,0.6)' : '0 0 6px rgba(107,159,212,0.5)',
              animation: 'pd 2s ease infinite',
              flexShrink: 0,
            }} />
            {isConnected ? 'DESCENT_ACTIVE' : 'INITIATE_DESCENT'}
          </button>
          <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(190,208,238,0.13)', letterSpacing: '0.06em', marginTop: 2 }}>
            wallet address is never stored · one-way hashed on-chain
          </div>
        </div>

      </div>

      {/* Fixed corner metadata */}
      <div style={{ position: 'fixed', bottom: 14, left: 16, zIndex: 50, fontFamily: mono, fontSize: 8, color: 'rgba(107,159,212,0.22)', letterSpacing: '0.1em' }}>
        βάθος: {Math.floor(scrollY * 0.4)}m
      </div>
      <div style={{ position: 'fixed', bottom: 14, right: 16, zIndex: 50, fontFamily: mono, fontSize: 7, color: 'rgba(107,159,212,0.2)', letterSpacing: '0.1em' }}>
        37.9°N · 23.7°E · ΕΛΛΆΔΑ
      </div>
    </div>
  );
}
