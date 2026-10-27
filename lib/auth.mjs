import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'wearon_demo';
export { SESSION_SECONDS } from './policy.mjs';
const AUTH_SECONDS = 8 * 60 * 60;
export const headers = { 'Cache-Control': 'no-store' };
export const configured = () => (process.env.DEMO_ACCESS_CODE?.length >= 12 && process.env.SESSION_SECRET?.length >= 32);

export function safeEqual(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sameOrigin(request) {
  const host = request.headers.get('host') || new URL(request.url).host;
  const origin = process.env.APP_ORIGIN || (/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) ? `http://${host}` : '');
  return !!origin && request.headers.get('origin') === origin
    && (!request.headers.get('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'same-origin');
}

export function issueSession(secret, now = Date.now()) {
  const value = Buffer.from(JSON.stringify({ id: randomBytes(18).toString('hex'), exp: now + AUTH_SECONDS * 1000 })).toString('base64url');
  return `${value}.${createHmac('sha256', secret).update(value).digest('base64url')}`;
}

export function verifySession(token, secret, now = Date.now()) {
  if (!secret || !token || token.length > 1024) return null;
  const [value, signature, extra] = token.split('.');
  if (!value || !signature || extra !== undefined || !safeEqual(signature, createHmac('sha256', secret).update(value).digest('base64url'))) return null;
  try {
    const session = JSON.parse(Buffer.from(value, 'base64url').toString());
    return /^[a-f0-9]{36}$/.test(session.id) && Number.isFinite(session.exp) && session.exp > now ? session : null;
  } catch { return null; }
}

export function sessionFrom(request) {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
  return verifySession(cookie?.slice(COOKIE.length + 1), process.env.SESSION_SECRET);
}

export function cookieHeader(value, clear = false) {
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : AUTH_SECONDS}${process.env.APP_ORIGIN?.startsWith('https:') ? '; Secure' : ''}`;
}
