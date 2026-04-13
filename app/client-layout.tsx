'use client';

// WHY THIS FILE EXISTS:
// wagmi/WalletConnect SSR conflict — if Providers (RainbowKit/Wagmi) render on the server,
// localStorage access throws during Next.js build. Fix: dynamic(..., { ssr: false }) must
// live in a 'use client' component. Moving this import to layout.tsx (Server Component) breaks the build.
// DO NOT modify the dynamic import or add server-side logic here.

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

// Dynamic import with ssr:false must live inside a Client Component
const ProvidersInner = dynamic(
  () => import('./providers').then(mod => ({ default: mod.Providers })),
  { ssr: false, loading: () => null }
);

const TunnelLayer = dynamic(
  () => import('@/components/TunnelLayer'),
  { ssr: false, loading: () => null }
);

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <ProvidersInner>
      <TunnelLayer />
      {children}
    </ProvidersInner>
  );
}
