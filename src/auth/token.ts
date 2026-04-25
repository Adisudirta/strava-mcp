import type { StravaTokenRecord, StravaTokenResponse, StravaTokenError } from '../types';

const KV_TOKEN_KEY = 'strava:tokens';
const TOKEN_EXPIRY_BUFFER_SECONDS = 300;

export async function getStoredTokens(
  kv: KVNamespace
): Promise<StravaTokenRecord | null> {
  const raw = await kv.get(KV_TOKEN_KEY, 'json');
  return (raw as StravaTokenRecord) ?? null;
}

export async function storeTokens(
  kv: KVNamespace,
  tokenResponse: StravaTokenResponse
): Promise<void> {
  const record: StravaTokenRecord = {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: tokenResponse.expires_at,
    token_type: tokenResponse.token_type,
    athlete: tokenResponse.athlete ?? { id: 0, username: '', firstname: '', lastname: '' },
  };
  await kv.put(KV_TOKEN_KEY, JSON.stringify(record));
}

export function isTokenExpired(record: StravaTokenRecord): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return record.expires_at - nowSeconds < TOKEN_EXPIRY_BUFFER_SECONDS;
}

export async function refreshAccessToken(
  kv: KVNamespace,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<StravaTokenRecord> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = (await response.json()) as StravaTokenError;
    throw new Error(`Strava token refresh failed: ${err.message}`);
  }

  const data = (await response.json()) as StravaTokenResponse;
  await storeTokens(kv, data);
  return (await getStoredTokens(kv))!;
}

export async function getValidAccessToken(
  kv: KVNamespace,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const record = await getStoredTokens(kv);
  if (!record) return null;

  if (isTokenExpired(record)) {
    const refreshed = await refreshAccessToken(kv, clientId, clientSecret, record.refresh_token);
    return refreshed.access_token;
  }

  return record.access_token;
}
