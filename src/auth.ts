import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const SCOPES = 'read,activity:read_all,profile:read_all';
const CALLBACK_PORT = 3000;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const TOKEN_DIR = path.join(os.homedir(), '.strava-mcp');
const TOKEN_FILE = path.join(TOKEN_DIR, 'tokens.json');
const EXPIRY_BUFFER_SECONDS = 300;

export interface Athlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
}

interface TokenRecord {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: Athlete;
}

export function loadTokens(): TokenRecord | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveTokens(record: TokenRecord): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  // mode 0o600 = owner read/write only — protects the secret tokens
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
}

export function clearTokens(): void {
  try { fs.unlinkSync(TOKEN_FILE); } catch { /* already gone */ }
}

function isExpired(record: TokenRecord): boolean {
  return record.expires_at - Math.floor(Date.now() / 1000) < EXPIRY_BUFFER_SECONDS;
}

async function refreshAccessToken(clientId: string, clientSecret: string, record: TokenRecord): Promise<TokenRecord> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: record.refresh_token,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.json() as { message: string };
    throw new Error(`Token refresh failed: ${err.message}`);
  }

  const data = await res.json() as TokenRecord & { athlete?: Athlete };
  const updated: TokenRecord = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete ?? record.athlete,
  };
  saveTokens(updated);
  return updated;
}

export async function getValidToken(clientId: string, clientSecret: string): Promise<string | null> {
  let record = loadTokens();
  if (!record) return null;
  if (isExpired(record)) {
    record = await refreshAccessToken(clientId, clientSecret, record);
  }
  return record.access_token;
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? `open "${url}"`
    : process.platform === 'win32' ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) process.stderr.write(`Browser could not be opened automatically. Visit:\n${url}\n`);
  });
}

function callbackHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#1a1a2e,#0f3460);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}div{text-align:center;padding:2rem}h1{font-size:1.8rem;margin-bottom:1rem;color:#FC4C02}p{color:#ccc}</style>
</head><body><div><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

export function startOAuthFlow(clientId: string, clientSecret: string): Promise<TokenRecord> {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = `${STRAVA_AUTH_URL}?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: SCOPES,
      state,
    })}`;

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) return;

      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      const send = (status: number, title: string, body: string) => {
        res.writeHead(status, { 'Content-Type': 'text/html' });
        res.end(callbackHtml(title, body));
        server.close();
      };

      if (error) {
        send(400, 'Authorization Denied', 'You can close this window.');
        reject(new Error(`Strava authorization denied: ${error}`));
        return;
      }

      if (returnedState !== state || !code) {
        send(400, 'Invalid Response', 'You can close this window.');
        reject(new Error('OAuth state mismatch — possible CSRF. Try again.'));
        return;
      }

      try {
        const tokenRes = await fetch(STRAVA_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
          }).toString(),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json() as { message: string };
          throw new Error(`Token exchange failed: ${err.message}`);
        }

        const data = await tokenRes.json() as TokenRecord & { athlete: Athlete };
        const record: TokenRecord = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          athlete: data.athlete,
        };
        saveTokens(record);

        send(200, 'Connected to Strava!',
          `Welcome, ${record.athlete.firstname}! You can close this window and return to Claude.`);
        resolve(record);
      } catch (err) {
        send(500, 'Something went wrong', 'You can close this window.');
        reject(err);
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      const msg = err.code === 'EADDRINUSE'
        ? `Port ${CALLBACK_PORT} is already in use. Close whatever is running on it and try again.`
        : `Could not start local server: ${err.message}`;
      reject(new Error(msg));
    });

    server.listen(CALLBACK_PORT, () => openBrowser(authUrl));

    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out after 5 minutes.'));
    }, 5 * 60 * 1000);
  });
}
