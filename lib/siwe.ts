// Shared Sign-In with Ethereum message builder.
// Imported by both auth.ts (server) and UserContext.tsx (client).
// windowOverride lets the server verify adjacent windows without mocking Date.
export function buildSignMessage(address: string, windowOverride?: number): string {
  const w = windowOverride ?? Math.floor(Date.now() / 300_000); // 5-min window
  return `Welcome to kataBased.\n\nProve you own this wallet. No gas. No transaction.\n\nAddress: ${address.toLowerCase()}\nWindow: ${w}`;
}
