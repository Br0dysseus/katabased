// Shared Sign-In with Ethereum message builder.
// Imported by both auth.ts (server) and UserContext.tsx (client).
// windowOverride lets the server verify adjacent windows without mocking Date.
export function buildSignMessage(address: string, windowOverride?: number): string {
  // 2-min window (120_000ms) — shorter than 5min to reduce signature replay risk.
  // Attacker who intercepts a signed message can only replay it within 2 minutes
  // instead of 5. Handles reasonable clock skew; auth.ts still checks [now, now-1].
  const w = windowOverride ?? Math.floor(Date.now() / 120_000);
  return `Welcome to kataBased.\n\nProve you own this wallet. No gas. No transaction.\n\nAddress: ${address.toLowerCase()}\nWindow: ${w}`;
}
