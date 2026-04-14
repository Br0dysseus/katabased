'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useReconnect } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { UserProvider } from '@/lib/UserContext';
import { useState, useEffect } from 'react';

const config = getDefaultConfig({
  appName: 'kataBased',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [mainnet, polygon, optimism, arbitrum, base],
  ssr: false,
});

// Restores wallet connection from localStorage on every mount.
// Required because Providers loads with { ssr: false } — Wagmi doesn't
// auto-reconnect without an explicit call in this setup.
function AutoReconnect() {
  const { reconnect } = useReconnect();
  useEffect(() => { reconnect(); }, [reconnect]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#6B9FD4',
            accentColorForeground: 'white',
            borderRadius: 'none',
          })}
        >
          <AutoReconnect />
          <UserProvider>
            {children}
          </UserProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
