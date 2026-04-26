import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';

function httpsPost(url: string, body: string): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    const req = https.request(
      { hostname, path: pathname + search, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          resolve({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0, json: () => Promise.resolve(JSON.parse(text)) });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const SCOPES = 'read,activity:read_all,profile:read_all';
const CALLBACK_PORT = 3000;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const TOKEN_DIR = path.join(os.homedir(), '.strava-mcp');
const TOKEN_FILE = path.join(TOKEN_DIR, 'tokens.json');
const EXPIRY_BUFFER_SECONDS = 300;
const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

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

// Keeps the background callback server alive between tool calls
let pendingServer: http.Server | null = null;

export function loadTokens(): TokenRecord | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveTokens(record: TokenRecord): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
}

export function clearTokens(): void {
  pendingServer?.close();
  pendingServer = null;
  try { fs.unlinkSync(TOKEN_FILE); } catch { /* already gone */ }
}

function isExpired(record: TokenRecord): boolean {
  return record.expires_at - Math.floor(Date.now() / 1000) < EXPIRY_BUFFER_SECONDS;
}

async function refreshAccessToken(clientId: string, clientSecret: string, record: TokenRecord): Promise<TokenRecord> {
  const res = await httpsPost(STRAVA_TOKEN_URL, new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: record.refresh_token,
  }).toString());

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
    if (err) process.stderr.write(`Could not open browser automatically.\n`);
  });
}

function callbackHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      color: #fff;
    }
    .icon { font-size: 48px; margin-bottom: 1rem; }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      background: linear-gradient(135deg, #FC4C02, #ff6b35);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p { color: #a0a0b0; font-size: 0.95rem; line-height: 1.6; margin-bottom: 0.5rem; }
    .footer {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.8rem;
      color: #555;
    }
    .footer a { color: #FC4C02; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🏃</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <div class="footer">
      Thank you for using Strava MCP &mdash;
      <a href="https://github.com/Adisudirta/strava-mcp" target="_blank" rel="noopener">
        open source on GitHub
      </a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Starts the OAuth flow. Returns the authorization URL immediately and
 * handles the callback in the background — no blocking.
 */
export function startOAuthFlow(clientId: string, clientSecret: string): Promise<string> {
  // Clean up any previously pending auth server
  pendingServer?.close();
  pendingServer = null;

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
        pendingServer = null;
      };

      if (error) {
        send(400, 'Authorization Denied', 'You can close this window and return to Claude.');
        return;
      }

      if (returnedState !== state || !code) {
        send(400, 'Invalid Response', 'State mismatch — try connect_strava again.');
        return;
      }

      try {
        const tokenRes = await httpsPost(STRAVA_TOKEN_URL, new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }).toString());

        if (!tokenRes.ok) {
          const err = await tokenRes.json() as { message: string };
          throw new Error(`Token exchange failed: ${err.message}`);
        }

        const data = await tokenRes.json() as TokenRecord & { athlete: Athlete };
        saveTokens({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          athlete: data.athlete,
        });

        send(200, 'Connected to Strava!',
          `Welcome, ${data.athlete.firstname}! You can close this window and return to Claude.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(500, 'Something went wrong', `${msg} — fix the issue and try connect_strava again.`);
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      const msg = err.code === 'EADDRINUSE'
        ? `Port ${CALLBACK_PORT} is already in use. Close whatever is running on it and try again.`
        : `Could not start local server: ${err.message}`;
      reject(new Error(msg));
    });

    server.listen(CALLBACK_PORT, () => {
      pendingServer = server;
      openBrowser(authUrl);
      resolve(authUrl);
    });

    // Auto-cleanup after timeout
    setTimeout(() => {
      if (pendingServer === server) {
        server.close();
        pendingServer = null;
      }
    }, AUTH_TIMEOUT_MS);
  });
}
