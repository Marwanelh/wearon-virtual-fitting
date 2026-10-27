import { configured, sameOrigin, issueSession, sessionFrom, cookieHeader, safeEqual, headers } from '../../../lib/auth.mjs';
import { consume } from '../../../lib/usage.mjs';

export const runtime = 'nodejs';
export async function GET(request) {
  return Response.json({ unlocked: !!(configured() && sessionFrom(request)), configured: !!configured() }, { headers });
}

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Open the demo in its original tab.' }, { status: 403, headers });
  if (!configured()) return Response.json({ error: 'The private demo is not configured yet. Please contact your host.' }, { status: 503, headers });
  try {
    if (!consume('login', 'global', 30, 600000)) return Response.json({ error: 'Too many attempts. Please wait ten minutes.' }, { status: 429, headers });
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Empty request');
    let body = '', bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024) { await reader.cancel(); throw new Error('Too large'); }
      body += decoder.decode(value, { stream: true });
    }
    const { code } = JSON.parse(body + decoder.decode());
    if (typeof code !== 'string' || !safeEqual(code, process.env.DEMO_ACCESS_CODE)) return Response.json({ error: 'That access code isn’t right. Please try again.' }, { status: 401, headers });
    return Response.json({ unlocked: true }, { headers: { ...headers, 'Set-Cookie': cookieHeader(issueSession(process.env.SESSION_SECRET)) } });
  } catch { return Response.json({ error: 'Could not open the studio. Please try again.' }, { status: 400, headers }); }
}

export async function DELETE(request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403, headers });
  return Response.json({ unlocked: false }, { headers: { ...headers, 'Set-Cookie': cookieHeader('', true) } });
}
