# Strava MCP

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for Strava, built on [Cloudflare Workers](https://workers.cloudflare.com) with [Hono](https://hono.dev).

---

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough)
- A [Strava API application](https://www.strava.com/settings/api)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/strava-mcp.git
cd strava-mcp
npm install
```

### 2. Create a Strava API application

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Fill in the form — the **Authorization Callback Domain** must be:
   - `localhost` for local development
   - Your workers subdomain (e.g. `strava-mcp.yourname.workers.dev`) for production
3. Copy your **Client ID** and **Client Secret**

### 3. Configure local environment

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and fill in your credentials:

```
REDIRECT_URI=http://localhost:8787/auth/callback
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
```

> `.dev.vars` is gitignored and only used by `wrangler dev`. Never commit it.

### 4. Create a KV namespace

```bash
npx wrangler kv namespace create STRAVA_KV
```

Copy the printed `id` into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "STRAVA_KV",
    "id": "paste-your-id-here"
  }
]
```

### 5. Update the production redirect URI

In `wrangler.jsonc`, set `REDIRECT_URI` to your deployed worker URL:

```jsonc
"vars": {
  "REDIRECT_URI": "https://strava-mcp.yourname.workers.dev/auth/callback"
}
```

### 6. Set production secrets

```bash
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET
```

You will be prompted to enter the values — they are stored encrypted in Cloudflare and never in source code.

---

## Development

```bash
npm run dev
```

The server starts at `http://localhost:8787`.

### Authenticate locally

1. Open `http://localhost:8787/auth/strava` in your browser
2. Authorize the app on Strava
3. You will be redirected back with a success response:
   ```json
   { "success": true, "athlete": { "id": 123, "firstname": "..." }, "expires_at": 1234567890 }
   ```
4. Check token status at `http://localhost:8787/auth/status`

---

## Deployment

```bash
npm run deploy
```

The GitHub Actions workflow in `.github/workflows/deploy.yml` also deploys automatically when you push a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Set the `CLOUDFLARE_API_TOKEN` secret in your GitHub repository settings for the workflow to work.

---

## Environment variables

| Variable | Where to set | Description |
|---|---|---|
| `REDIRECT_URI` | `wrangler.jsonc` (prod), `.dev.vars` (local) | OAuth callback URL |
| `STRAVA_CLIENT_ID` | `wrangler secret put` (prod), `.dev.vars` (local) | Strava API client ID |
| `STRAVA_CLIENT_SECRET` | `wrangler secret put` (prod), `.dev.vars` (local) | Strava API client secret |

---

## API reference

### `GET /auth/strava`

Redirects the user to Strava's OAuth authorization page.

### `GET /auth/callback`

Handles the OAuth callback from Strava. Exchanges the authorization code for tokens and stores them in KV. Returns:

```json
{
  "success": true,
  "athlete": { "id": 123, "username": "...", "firstname": "...", "lastname": "..." },
  "expires_at": 1234567890
}
```

### `GET /auth/status`

Returns the current authentication state without triggering a token refresh.

```json
{
  "authenticated": true,
  "expired": false,
  "expires_at": 1234567890,
  "expires_in_seconds": 18000,
  "athlete": { "id": 123, "username": "...", "firstname": "...", "lastname": "..." }
}
```

---

## Security

- **CSRF protection** — each authorization request generates a one-time `state` nonce stored in KV with a 10-minute TTL. The callback validates and immediately deletes it before exchanging the code.
- **Secrets** — `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are stored as encrypted Cloudflare Worker secrets, never in source code or `wrangler.jsonc`.
- **Token storage** — access and refresh tokens are stored in Cloudflare KV (not exposed via any public endpoint).

---

## License

MIT
