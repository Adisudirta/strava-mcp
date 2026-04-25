import { Hono } from 'hono';
import type { Env, StravaTokenResponse, StravaTokenError } from '../types';
import { storeTokens, getStoredTokens, isTokenExpired } from './token';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const SCOPES = 'read,activity:read_all,profile:read_all';

export const authRoutes = new Hono<Env>();

authRoutes.get('/strava', (c) => {
  const { STRAVA_CLIENT_ID, REDIRECT_URI } = c.env;

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPES,
  });

  return c.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
});

authRoutes.get('/callback', async (c) => {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, REDIRECT_URI, STRAVA_KV } = c.env;

  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    return c.json({ error: `Strava authorization denied: ${error}` }, 400);
  }

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  const body = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  });

  const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenResponse.ok) {
    const err = (await tokenResponse.json()) as StravaTokenError;
    return c.json({ error: `Token exchange failed: ${err.message}` }, 502);
  }

  const data = (await tokenResponse.json()) as StravaTokenResponse;
  await storeTokens(STRAVA_KV, data);

  return c.json({
    success: true,
    athlete: data.athlete,
    expires_at: data.expires_at,
  });
});

authRoutes.get('/status', async (c) => {
  const record = await getStoredTokens(c.env.STRAVA_KV);

  if (!record) {
    return c.json({ authenticated: false, reason: 'No tokens stored' });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expired = isTokenExpired(record);

  return c.json({
    authenticated: true,
    expired,
    expires_at: record.expires_at,
    expires_in_seconds: record.expires_at - nowSeconds,
    athlete: record.athlete,
  });
});
