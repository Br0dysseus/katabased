import { createHmac, timingSafeEqual } from 'crypto';

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is not set');
  return s;
}

export function signSession(userId: string, exp: number): string {
  const payload = `${userId}|${exp}`;
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return `${userId}.${exp}.${sig}`;
}

export function verifySession(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid session');
  const [userId, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) throw new Error('Session expired — reconnect wallet');
  const expected = createHmac('sha256', sessionSecret()).update(`${userId}|${exp}`).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid session');
  }
  return userId;
}
