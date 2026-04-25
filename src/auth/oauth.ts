import { Hono } from 'hono';
import type { Env } from '../types';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_SCOPES = 'read,activity:read_all,profile:read_all';

export const STATE_KV_PREFIX = 'oauth:state:';
export const MCP_PENDING_PREFIX = 'mcp:pending:';
export const MCP_CODE_PREFIX = 'mcp:code:';
const STATE_TTL = 600;
export const CODE_TTL = 60;

export type McpPendingRecord = {
  codeChallenge: string;
  claudeRedirectUri: string;
  clientId: string;
  claudeState: string | null;
};

export type McpCodeRecord = {
  sessionId: string;
  codeChallenge: string;
};

async function verifyPkce(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const data = new TextEncoder().encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  let binary = '';
  for (const byte of new Uint8Array(hashBuffer)) binary += String.fromCharCode(byte);
  const b64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return b64url === codeChallenge;
}

// Mounted at /.well-known
export const wellKnownRoutes = new Hono<Env>();

wellKnownRoutes.get('/oauth-protected-resource', (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json({ resource: origin, authorization_servers: [origin] });
});

wellKnownRoutes.get('/oauth-authorization-server', (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  });
});

// Mounted at /oauth
export const oauthRoutes = new Hono<Env>();

oauthRoutes.get('/authorize', async (c) => {
  const { STRAVA_CLIENT_ID, REDIRECT_URI, STRAVA_KV } = c.env;

  const responseType = c.req.query('response_type');
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');
  const codeChallenge = c.req.query('code_challenge');
  const codeChallengeMethod = c.req.query('code_challenge_method');
  const claudeState = c.req.query('state') ?? null;

  if (responseType !== 'code')
    return c.json({ error: 'unsupported_response_type' }, 400);
  if (!clientId)
    return c.json({ error: 'invalid_request', error_description: 'client_id required' }, 400);
  if (!redirectUri)
    return c.json({ error: 'invalid_request', error_description: 'redirect_uri required' }, 400);
  if (!codeChallenge)
    return c.json({ error: 'invalid_request', error_description: 'code_challenge required (PKCE S256)' }, 400);
  if (codeChallengeMethod !== 'S256')
    return c.json({ error: 'invalid_request', error_description: 'code_challenge_method must be S256' }, 400);

  const stravaState = crypto.randomUUID();

  await Promise.all([
    STRAVA_KV.put(`${STATE_KV_PREFIX}${stravaState}`, '1', { expirationTtl: STATE_TTL }),
    STRAVA_KV.put(
      `${MCP_PENDING_PREFIX}${stravaState}`,
      JSON.stringify({ codeChallenge, claudeRedirectUri: redirectUri, clientId, claudeState } satisfies McpPendingRecord),
      { expirationTtl: STATE_TTL }
    ),
  ]);

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
    state: stravaState,
  });

  return c.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
});

oauthRoutes.post('/token', async (c) => {
  const { STRAVA_KV } = c.env;

  const contentType = c.req.header('content-type') ?? '';
  let body: Record<string, string>;
  if (contentType.includes('application/json')) {
    body = await c.req.json();
  } else {
    const form = await c.req.formData();
    body = Object.fromEntries(form.entries()) as Record<string, string>;
  }

  const { grant_type, code, code_verifier } = body;

  if (grant_type !== 'authorization_code')
    return c.json({ error: 'unsupported_grant_type' }, 400);
  if (!code)
    return c.json({ error: 'invalid_request', error_description: 'code required' }, 400);
  if (!code_verifier)
    return c.json({ error: 'invalid_request', error_description: 'code_verifier required' }, 400);

  const codeKey = `${MCP_CODE_PREFIX}${code}`;
  const record = await STRAVA_KV.get(codeKey, 'json') as McpCodeRecord | null;

  if (!record)
    return c.json({ error: 'invalid_grant', error_description: 'Authorization code not found or expired' }, 400);

  await STRAVA_KV.delete(codeKey);

  const valid = await verifyPkce(code_verifier, record.codeChallenge);
  if (!valid)
    return c.json({ error: 'invalid_grant', error_description: 'code_verifier mismatch' }, 400);

  return c.json({ access_token: record.sessionId, token_type: 'bearer' });
});
