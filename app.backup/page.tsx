'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useUser } from '@/lib/UserContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
  const { isConnected } = useAccount();
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isConnected && user && !loading) {
      router.push('/dashboard');
    }
  }, [isConnected, user, loading, router]);

  return (
    <div style={{ minHeight: '100vh', background: '#030303', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontStyle: 'italic', fontSize: 64, lineHeight: 1, letterSpacing: '-0.04em', userSelect: 'none', display: 'flex', alignItems: 'baseline' }}>
        <span style={{ color: '#22a83a' }}>κ</span>
        <span style={{ color: '#fff', marginLeft: 3 }}>β</span>
      </div>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>Anonymous workplace truth, verified on-chain.</p>
      <ConnectButton />
    </div>
  );
}
