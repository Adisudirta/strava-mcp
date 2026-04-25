import { Hono } from 'hono';
import type { Env, StravaTokenResponse, StravaTokenError } from '../types';
import { storeTokens, getStoredTokens, isTokenExpired } from './token';
import { SuccessPage } from './pages/SuccessPage';
import { ErrorPage } from './pages/ErrorPage';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const SCOPES = 'read,activity:read_all,profile:read_all';
const STATE_KV_PREFIX = 'oauth:state:';
const STATE_TTL_SECONDS = 600;

export const authRoutes = new Hono<Env>();

authRoutes.get('/strava', async (c) => {
  const { STRAVA_CLIENT_ID, REDIRECT_URI, STRAVA_KV } = c.env;

  const state = crypto.randomUUID();
  await STRAVA_KV.put(`${STATE_KV_PREFIX}${state}`, '1', {
    expirationTtl: STATE_TTL_SECONDS,
  });

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPES,
    state,
  });

  return c.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
});

authRoutes.get('/callback', async (c) => {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, REDIRECT_URI, STRAVA_KV } = c.env;

  const code = c.req.query('code');
  const error = c.req.query('error');
  const state = c.req.query('state');

  if (error) {
    return c.html(<ErrorPage message={`Strava authorization denied: ${error}`} />, 400);
  }

  if (!code) {
    return c.html(<ErrorPage message="Missing authorization code." />, 400);
  }

  if (!state) {
    return c.html(<ErrorPage message="Missing state parameter." />, 400);
  }

  const storedState = await STRAVA_KV.get(`${STATE_KV_PREFIX}${state}`);
  if (!storedState) {
    return c.html(<ErrorPage message="Invalid or expired state. Please try authenticating again." />, 400);
  }
  await STRAVA_KV.delete(`${STATE_KV_PREFIX}${state}`);

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
    return c.html(<ErrorPage message={`Token exchange failed: ${err.message}`} />, 502);
  }

  const data = (await tokenResponse.json()) as StravaTokenResponse;
  await storeTokens(STRAVA_KV, data);

  return c.html(
    <SuccessPage athlete={data.athlete ?? { id: 0, username: '', firstname: 'Athlete', lastname: '' }} />
  );
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
    athlete: {
      id: record.athlete.id,
      username: record.athlete.username,
      firstname: record.athlete.firstname,
      lastname: record.athlete.lastname,
    },
  });
});
