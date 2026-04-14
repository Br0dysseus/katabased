'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useUser } from '@/lib/UserContext';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';

const mono  = "'JetBrains Mono',monospace";
const serif = "'Cormorant Garamond',serif";
const blue  = '#6B9FD4';
const terra = '#D4845A';

const MEANDER = 'repeating-linear-gradient(90deg,rgba(107,159,212,0.2) 0,rgba(107,159,212,0.2) 3px,transparent 3px,transparent 6px,rgba(107,159,212,0.2) 6px,rgba(107,159,212,0.2) 9px,transparent 9px,transparent 12px,rgba(107,159,212,0.12) 12px,rgba(107,159,212,0.12) 15px,transparent 15px,transparent 18px)';

export default function Home() {
  const { isConnected } = useAccount();
  const { user, loading, signingIn, authError, refetchUser } = useUser();
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
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
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes pd  { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes lfi { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .lfi { animation: lfi 0.55s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
        @keyframes tunnelReveal { 0%{opacity:0} 100%{opacity:1} }
        .tunnel-reveal { animation: tunnelReveal 0.8s ease-in forwards; }
        @keyframes bydFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .byd-block { animation: bydFade 0.6s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
        @media (max-width: 600px) {
          .landing-hero  { padding: 0 20px !important; }
          .landing-copy  { font-size: 10px !important; }
          .landing-logo  { font-size: 56px !important; }
        }
      `}</style>


      {/* Meander bar */}
      <div style={{ height: 2, background: MEANDER, position: 'relative', zIndex: 10 }} />

      {/* Top session bar */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 13, letterSpacing: '0.07em', color: 'rgba(107,159,212,0.45)', fontWeight: 300 }}>
          <span>KATABASED</span>
          <span style={{ color: 'rgba(107,159,212,0.18)' }}>{'//'}</span>
          <span>v0.1</span>
          <span style={{ color: 'rgba(107,159,212,0.18)' }}>{'//'}</span>
          <span>ANON_MODE</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(107,159,212,0.28)', letterSpacing: '0.1em' }}>
          37.9°N · 23.7°E
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
        <div className="lfi" style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 14, color: 'rgba(107,159,212,0.78)', letterSpacing: '0.2em', marginBottom: 36, animationDelay: '0.16s' }}>
          κατάβασις — the descent
        </div>

        {/* Divider */}
        <div className="lfi" style={{ width: 180, height: 1, background: 'rgba(107,159,212,0.12)', marginBottom: 36, animationDelay: '0.20s' }} />

        {/* Tagline */}
        <div
          className="lfi landing-copy"
          style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.95, color: 'rgba(190,208,238,0.78)', maxWidth: 400, marginBottom: 14, letterSpacing: '0.015em', fontWeight: 300, animationDelay: '0.26s' }}
        >
          Surface is managed. Depths are not.
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
            textAlign: 'left',
          }}
        >
          <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.18em', color: 'rgba(107,159,212,0.60)', marginBottom: 8, textTransform: 'uppercase' }}>{'// BEFORE_YOU_DESCEND'}</div>
          {[
            'Your wallet address will be one-way hashed.',
            'The hash anchors your identity on-chain.',
            'The wallet behind it is never stored.',
            'What you write here cannot be taken back.',
          ].map((line, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.75, color: 'rgba(190,208,238,0.65)', letterSpacing: '0.01em', fontWeight: 300 }}>{line}</div>
          ))}
        </div>

        {/* Connect section */}
        <div className="lfi" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animationDelay: '0.42s' }}>
          <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.2em', color: 'rgba(107,159,212,0.55)', textTransform: 'uppercase' }}>
            {signingIn ? '// SIGN_MESSAGE_IN_WALLET' : isConnected && !user ? '// SIGNATURE_NEEDED_TO_ENTER' : '// CONNECT_WALLET_TO_ENTER'}
          </div>
          <button
            onClick={() => {
              if (!isConnected && openConnectModal) openConnectModal();
              else if (isConnected && !user && !loading) refetchUser();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 3,
              border: signingIn ? '1px solid rgba(107,159,212,0.5)' : isConnected && user ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(74,222,128,0.25)',
              background: signingIn ? 'rgba(107,159,212,0.10)' : isConnected && user ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.05)',
              cursor: (isConnected && !!user) ? 'default' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: isConnected && user ? '0 0 18px rgba(74,222,128,0.25)' : '0 0 8px rgba(74,222,128,0.08)',
            }}
            onMouseEnter={e => { if (!isConnected || (!user && !loading)) { const el = e.currentTarget as HTMLElement; el.style.background = signingIn ? 'rgba(107,159,212,0.14)' : 'rgba(74,222,128,0.12)'; el.style.borderColor = signingIn ? 'rgba(107,159,212,0.7)' : 'rgba(74,222,128,0.5)'; el.style.boxShadow = '0 0 22px rgba(74,222,128,0.3)'; } }}
            onMouseLeave={e => { if (!isConnected || (!user && !loading)) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(74,222,128,0.05)'; el.style.borderColor = 'rgba(74,222,128,0.25)'; el.style.boxShadow = '0 0 8px rgba(74,222,128,0.08)'; } }}
          >
            {signingIn ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(107,159,212,0.8)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isConnected && user ? 'rgba(74,222,128,0.9)' : 'rgba(74,222,128,0.6)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="3" x2="12" y2="14" />
                <path d="M8 14 Q8 20 12 20 Q16 20 16 14 Z" />
                <line x1="9" y1="3" x2="15" y2="3" />
              </svg>
            )}
          </button>
          <div style={{ fontFamily: mono, fontSize: 13, color: signingIn ? 'rgba(107,159,212,0.5)' : 'rgba(74,222,128,0.25)', letterSpacing: '0.08em', marginTop: 2 }}>
            {signingIn ? '// waiting for signature...' : isConnected && !user ? '// click to retry sign-in' : isConnected && user ? '// WALLET_CONNECTED' : '// wallet address is never stored'}
          </div>
          {authError && (
            <div style={{ fontFamily: mono, fontSize: 14, color: 'rgba(212,90,90,0.75)', letterSpacing: '0.04em', maxWidth: 320, textAlign: 'center', lineHeight: 1.6, padding: '8px 12px', border: '1px solid rgba(212,90,90,0.2)', borderRadius: 2, background: 'rgba(212,90,90,0.04)' }}>
              {'// '}{authError}
            </div>
          )}
        </div>

      </div>

      {/* Top 3 posts preview — visible without login */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 520, margin: '0 auto 48px', padding: '0 32px' }}>
        <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(107,159,212,0.45)', marginBottom: 14, textTransform: 'uppercase' }}>{'// RECENT_TRANSMISSIONS — last 6h'}</div>
        {[
          { entity: 'Uniswap Labs', title: 'best smart contract engineers in DeFi',       confirms: 304, time: '1h' },
          { entity: 'OpenSea',      title: 'the Seaport pivot split the company in half',  confirms: 211, time: '4h' },
          { entity: 'Coinbase',     title: 'engineering culture is cooked post-layoffs',   confirms: 142, time: '5h' },
        ].map((p, i) => (
          <div key={i} style={{ borderLeft: '2px solid rgba(107,159,212,0.12)', padding: '10px 14px', marginBottom: 8, background: 'rgba(107,159,212,0.018)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', color: terra, fontWeight: 500 }}>{p.entity}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: 'rgba(107,159,212,0.3)', letterSpacing: '0.08em' }}>{p.time}</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, color: 'rgba(190,208,238,0.55)', letterSpacing: '0.01em', fontWeight: 300, lineHeight: 1.5, marginBottom: 6 }}>{p.title}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(107,159,212,0.3)', letterSpacing: '0.08em' }}>
              <span style={{ color: 'rgba(107,212,159,0.45)' }}>{p.confirms} confirmed</span>
            </div>
          </div>
        ))}
        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(107,159,212,0.25)', letterSpacing: '0.12em', marginTop: 10, textAlign: 'center' }}>
          {'// connect wallet to see full feed + post'}
        </div>
      </div>

      {/* Scroll nav links */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', gap: 32, paddingBottom: 32 }}>
        {[{ label: '// ABOUT', href: '#about' }, { label: '// OPSEC', href: '#opsec' }].map(l => (
          <a
            key={l.href}
            href={l.href}
            style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.18em', color: 'rgba(107,159,212,0.35)', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(107,159,212,0.7)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(107,159,212,0.35)'; }}
          >{l.label}</a>
        ))}
      </div>

      {/* ── ABOUT ──────────────────────────────────────────────────────────── */}
      <div id="about" style={{ position: 'relative', zIndex: 10, maxWidth: 620, margin: '0 auto', padding: '48px 32px 64px' }}>
        <div style={{ height: 1, background: 'rgba(107,159,212,0.08)', marginBottom: 32 }} />
        <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.22em', color: 'rgba(107,159,212,0.35)', marginBottom: 20 }}>{'// ABOUT'}</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 22, color: 'rgba(218,228,248,0.55)', letterSpacing: '0.04em', marginBottom: 20, lineHeight: 1.3 }}>
          κατάβασις — the descent.
        </div>
        <div style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.9, color: 'rgba(190,208,238,0.38)', letterSpacing: '0.01em', fontWeight: 300, marginBottom: 16 }}>
          Anonymous intelligence from inside organizations. Corporations, government agencies, state departments, regulators, contractors — any entity that shapes the world but controls what is known about its interior. The surface is managed. The depths are not.
        </div>
        <div style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.9, color: 'rgba(190,208,238,0.28)', letterSpacing: '0.01em', fontWeight: 300 }}>
          A space for employees, contractors, whistleblowers, and insiders who want the truth known — about where they work, what they have seen, and what the public deserves to hear. Wallet-anchored identity. No email. No account. Nothing stored.
        </div>
      </div>

      {/* ── OPSEC ──────────────────────────────────────────────────────────── */}
      <div id="opsec" style={{ position: 'relative', zIndex: 10, maxWidth: 620, margin: '0 auto', padding: '0 32px 80px' }}>
        <div style={{ height: 1, background: 'rgba(107,159,212,0.08)', marginBottom: 32 }} />
        <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.22em', color: 'rgba(107,159,212,0.35)', marginBottom: 20 }}>{'// OPSEC'}</div>
        <div style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.9, color: 'rgba(190,208,238,0.32)', letterSpacing: '0.01em', fontWeight: 300, marginBottom: 24 }}>
          Anonymity is only as strong as its weakest step. The full guide is inside the app. Quick orientation:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {[
            { tier: 'T0', label: 'MINDSET', desc: 'Compartmentalize. Never link your real identity to this wallet.' },
            { tier: 'T1', label: 'NETWORK', desc: 'VPN or Tor. Mullvad accepts Monero. No-log policy.' },
            { tier: 'T2', label: 'WALLET', desc: 'Dedicated wallet. Never fund from a KYC exchange directly.' },
            { tier: 'T3', label: 'ON-CHAIN', desc: 'Break the fund trail with RAILGUN or XMR bridge before depositing.' },
            { tier: 'T4', label: 'DEVICE', desc: 'Tails OS for maximum exposure. GrapheneOS for mobile.' },
          ].map(r => (
            <div key={r.tier} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(107,159,212,0.4)', flexShrink: 0, width: 24 }}>{r.tier}</span>
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(190,208,238,0.35)', flexShrink: 0, width: 76 }}>{r.label}</span>
              <span style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.65, color: 'rgba(190,208,238,0.22)', letterSpacing: '0.01em', fontWeight: 300 }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: 12, color: 'rgba(107,159,212,0.25)', letterSpacing: '0.12em' }}>
          {'// full guide → sign in → privacy tab'}
        </div>
      </div>

      {/* Fixed corner metadata */}
      <div style={{ position: 'fixed', bottom: 14, left: 16, zIndex: 50, fontFamily: mono, fontSize: 14, color: 'rgba(107,159,212,0.22)', letterSpacing: '0.1em' }}>
        βάθος: {Math.floor(scrollY * 0.4)}m
      </div>
      <div style={{ position: 'fixed', bottom: 14, right: 16, zIndex: 50, fontFamily: mono, fontSize: 13, color: 'rgba(107,159,212,0.2)', letterSpacing: '0.1em' }}>
        37.9°N · 23.7°E · ΕΛΛΆΔΑ
      </div>
    </div>
  );
}
