'use client';

import { usePathname } from 'next/navigation';
import TunnelBackground from './TunnelBackground';

// Persistent tunnel that lives at layout level — never remounts between routes.
// dimOpacity is route-aware: landing = 0.35 (hero), everything else = 0.88 (ambient).
export default function TunnelLayer() {
  const pathname = usePathname();
  const dimOpacity = pathname === '/' ? 0.35 : 0.88;
  return <TunnelBackground dimOpacity={dimOpacity} />;
}
