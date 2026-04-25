import { raw } from 'hono/html';
import type { StravaAthlete } from '../../types';

type Props = {
  athlete: StravaAthlete;
  sessionToken: string;
  mcpUrl: string;
};

export const SuccessPage = ({ athlete, sessionToken, mcpUrl }: Props) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Strava MCP — Connected</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{raw(`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', sans-serif;
          background: #f5f5f5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 2.5rem 2rem;
          max-width: 480px;
          width: 100%;
          text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .icon {
          width: 64px;
          height: 64px;
          background: #FC4C02;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }
        h1 { font-size: 1.5rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
        .name { font-size: 1.1rem; color: #FC4C02; font-weight: 600; margin-bottom: 1rem; }
        p { color: #666; font-size: 0.95rem; line-height: 1.5; }
        .section {
          margin-top: 1.5rem;
          text-align: left;
        }
        .section-label {
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #999;
          margin-bottom: 0.5rem;
        }
        .token-box {
          background: #f5f5f5;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          font-family: monospace;
          font-size: 0.82rem;
          color: #111;
          word-break: break-all;
          position: relative;
        }
        .copy-btn {
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.5rem;
          background: #FC4C02;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .copy-btn:hover { background: #e04300; }
        .config-box {
          background: #1a1a1a;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          font-family: monospace;
          font-size: 0.78rem;
          color: #e5e5e5;
          text-align: left;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .hint {
          margin-top: 1.5rem;
          padding: 0.75rem 1rem;
          background: #f5f5f5;
          border-radius: 8px;
          font-size: 0.85rem;
          color: #888;
          text-align: center;
        }
      `)}</style>
    </head>
    <body>
      <div class="card">
        <div class="icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M7 16l7 7 11-11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h1>Connected to Strava</h1>
        <p class="name">{athlete.firstname} {athlete.lastname}</p>
        <p>Your session token is unique to this device. Add it to your MCP config below.</p>

        <div class="section">
          <p class="section-label">Your Session Token</p>
          <div class="token-box" id="token">{sessionToken}</div>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('token').innerText).then(()=>this.textContent='Copied!')">
            Copy Token
          </button>
        </div>

        <div class="section">
          <p class="section-label">Claude Desktop Config</p>
          <div class="config-box">{`{
  "mcpServers": {
    "strava": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${sessionToken}"
      }
    }
  }
}`}</div>
        </div>

        <p class="hint">Each device or Claude instance should authenticate separately to get its own token.</p>
      </div>
    </body>
  </html>
);
