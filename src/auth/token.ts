import type { StravaTokenRecord, StravaTokenResponse, StravaTokenError } from '../types';

const TOKEN_EXPIRY_BUFFER_SECONDS = 300;

const sessionKey = (sessionId: string) => `session:${sessionId}:tokens`;

export async function getStoredTokens(
  kv: KVNamespace,
  sessionId: string
): Promise<StravaTokenRecord | null> {
  const raw = await kv.get(sessionKey(sessionId), 'json');
  return (raw as StravaTokenRecord) ?? null;
}

export async function storeTokens(
  kv: KVNamespace,
  sessionId: string,
  tokenResponse: StravaTokenResponse
): Promise<void> {
  const record: StravaTokenRecord = {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: tokenResponse.expires_at,
    token_type: tokenResponse.token_type,
    athlete: tokenResponse.athlete ?? { id: 0, username: '', firstname: '', lastname: '' },
  };
  await kv.put(sessionKey(sessionId), JSON.stringify(record));
}

export async function deleteTokens(kv: KVNamespace, sessionId: string): Promise<void> {
  await kv.delete(sessionKey(sessionId));
}

export function isTokenExpired(record: StravaTokenRecord): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return record.expires_at - nowSeconds < TOKEN_EXPIRY_BUFFER_SECONDS;
}

export async function refreshAccessToken(
  kv: KVNamespace,
  sessionId: string,
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
  await storeTokens(kv, sessionId, data);
  return (await getStoredTokens(kv, sessionId))!;
}

export async function getValidAccessToken(
  kv: KVNamespace,
  sessionId: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const record = await getStoredTokens(kv, sessionId);
  if (!record) return null;

  if (isTokenExpired(record)) {
    const refreshed = await refreshAccessToken(kv, sessionId, clientId, clientSecret, record.refresh_token);
    return refreshed.access_token;
  }

  return record.access_token;
}
