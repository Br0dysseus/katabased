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
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
