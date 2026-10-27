import { MODEL } from '../../../lib/policy.mjs';
import { configured, sameOrigin, sessionFrom, SESSION_SECONDS, headers } from '../../../lib/auth.mjs';
import { consume } from '../../../lib/usage.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Open the studio in its original tab.' }, { status: 403, headers });
  const session = sessionFrom(request);
  if (!configured() || !session) return Response.json({ error: 'Your access has expired. Reload and enter the demo code.' }, { status: 401, headers });
  const endpoint = process.env.FITTING_TOKEN_URL?.trim(), serverKey = process.env.FITTING_SERVER_KEY?.trim();
  if (!endpoint || !serverKey) return Response.json({ error: 'The demo is not ready. Please contact your host.' }, { status: 503, headers });
  try {
    const allowance = Number(process.env.DEMO_DAILY_SESSIONS || 6);
    if (!Number.isInteger(allowance) || allowance < 1 || allowance > 100) throw new Error('Invalid allowance');
    if (!consume('token', session.id, 1, 10000)) return Response.json({ error: 'Please wait ten seconds before starting another fitting.' }, { status: 429, headers });
    if (!consume('daily', 'global', allowance, 86400000)) return Response.json({ error: 'Today’s demo allowance has been used. Please contact your host for another fitting.' }, { status: 429, headers });
    const response = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${serverKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ expiresInSeconds: 10, model: MODEL, allowedOrigin: request.headers.get('origin'), maxSessionSeconds: SESSION_SECONDS }),
    });
    if (!response.ok) throw new Error('Fitting service rejected token');
    const token = await response.json();
    if (typeof token.token !== 'string' || token.maxSessionSeconds !== SESSION_SECONDS) throw new Error('Session cap not confirmed');
    return Response.json({ token: token.token, duration: SESSION_SECONDS }, { headers });
  } catch {
    return Response.json({ error: 'The fitting service could not start this session. Please ask your host to check credits and service access.' }, { status: 502, headers });
  }
}
