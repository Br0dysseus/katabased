'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

// Dynamic import with ssr:false must live inside a Client Component
const ProvidersInner = dynamic(
  () => import('./providers').then(mod => ({ default: mod.Providers })),
  { ssr: false, loading: () => null }
);

export function ClientLayout({ children }: { children: ReactNode }) {
  return <ProvidersInner>{children}</ProvidersInner>;
}
