import { raw } from 'hono/html';

type Props = { authUrl: string };

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
    max-width: 420px;
    width: 100%;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
  }
  .logo { font-size: 56px; margin-bottom: 1.25rem; }
  h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
    background: linear-gradient(135deg, #FC4C02, #ff6b35);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  p {
    color: #a0a0b0;
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 1.75rem;
  }
  .btn {
    display: block;
    width: 100%;
    padding: 0.9rem 1.5rem;
    background: linear-gradient(135deg, #FC4C02, #ff6b35);
    color: white;
    text-decoration: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px -4px rgba(252,76,2,0.45);
  }
  .note {
    margin-top: 1.25rem;
    font-size: 0.8rem;
    color: #666;
  }
  .note a { color: #FC4C02; text-decoration: none; }
  .note a:hover { text-decoration: underline; }
`;

export const ConnectPage = ({ authUrl }: Props) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Connect Strava to Claude</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{raw(styles)}</style>
    </head>
    <body>
      <div class="card">
        <div class="logo">🏃</div>
        <h1>Connect to Strava</h1>
        <p>
          Authorize Claude to read your Strava activities, profile, and performance data.
          You'll get a connector URL to paste into your Claude Desktop config.
        </p>
        <a href={authUrl} class="btn">Connect with Strava →</a>
        <p class="note">
          Need a Strava API app first?{' '}
          <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">
            Create one here
          </a>
        </p>
      </div>
    </body>
  </html>
);
