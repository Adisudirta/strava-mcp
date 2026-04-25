import { raw } from 'hono/html';
import type { StravaAthlete } from '../../types';

type Props = {
  athlete: StravaAthlete;
  connectorUrl: string;
};

const configJson = (url: string) =>
  JSON.stringify({ mcpServers: { strava: { url } } }, null, 2);

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .card {
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 2.5rem 2rem;
    max-width: 520px;
    width: 100%;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
  }
  .icon {
    width: 64px; height: 64px;
    background: linear-gradient(135deg, #FC4C02, #ff6b35);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 1.25rem;
    font-size: 28px;
  }
  h1 {
    font-size: 1.5rem; font-weight: 700;
    background: linear-gradient(135deg, #FC4C02, #ff6b35);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.4rem;
  }
  .name { color: #e0e0e0; font-size: 1rem; margin-bottom: 1.75rem; }
  .section { text-align: left; margin-top: 1.5rem; }
  .section-label {
    font-size: 0.72rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: #888; margin-bottom: 0.5rem;
  }
  .url-box {
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    font-family: monospace; font-size: 0.78rem;
    color: #e0e0e0; word-break: break-all;
  }
  .copy-btn {
    margin-top: 0.5rem; width: 100%;
    padding: 0.6rem;
    background: linear-gradient(135deg, #FC4C02, #ff6b35);
    color: white; border: none; border-radius: 8px;
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: opacity 0.15s;
  }
  .copy-btn:hover { opacity: 0.88; }
  .config-box {
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    font-family: monospace; font-size: 0.76rem;
    color: #b0c4de; text-align: left;
    white-space: pre-wrap; word-break: break-all;
  }
  .hint {
    margin-top: 1.5rem;
    padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.04);
    border-radius: 10px;
    font-size: 0.8rem; color: #666; text-align: center;
  }
`;

export const SuccessPage = ({ athlete, connectorUrl }: Props) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Strava Connected!</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{raw(styles)}</style>
    </head>
    <body>
      <div class="card">
        <div class="icon">✓</div>
        <h1>Connected to Strava</h1>
        <p class="name">{athlete.firstname} {athlete.lastname}</p>

        <div class="section">
          <p class="section-label">Your MCP Connector URL</p>
          <div class="url-box" id="connector-url">{connectorUrl}</div>
          <button
            class="copy-btn"
            onclick="navigator.clipboard.writeText(document.getElementById('connector-url').innerText).then(()=>this.textContent='Copied ✓').catch(()=>{})"
          >
            Copy URL
          </button>
        </div>

        <div class="section">
          <p class="section-label">Claude Desktop Config</p>
          <div class="config-box">{configJson(connectorUrl)}</div>
        </div>

        <p class="hint">
          Paste the config above into your <code>claude_desktop_config.json</code> under <code>mcpServers</code>.
          Each device needs its own connector URL.
        </p>
      </div>
    </body>
  </html>
);
