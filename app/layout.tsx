import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from './client-layout';

export const metadata: Metadata = {
  title: "kataBased — κατάβασις",
  description: "Anonymous workplace truth, verified on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://relay.walletconnect.com" crossOrigin="" />
        <link rel="preconnect" href="https://rpc.walletconnect.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cloud.reown.com" />
        <link rel="preload" href="/fonts/kataGlyph-Stele-v03.otf" as="font" type="font/otf" crossOrigin="" />
      </head>
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
