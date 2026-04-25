import { raw } from 'hono/html';

export const ErrorPage = ({ message }: { message: string }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Strava MCP — Error</title>
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
          max-width: 400px;
          width: 100%;
          text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .icon {
          width: 64px;
          height: 64px;
          background: #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }
        h1 { font-size: 1.5rem; font-weight: 700; color: #111; margin-bottom: 1rem; }
        p { color: #666; font-size: 0.95rem; line-height: 1.5; }
        code {
          display: block;
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: #f5f5f5;
          border-radius: 8px;
          font-size: 0.82rem;
          color: #ef4444;
          word-break: break-word;
        }
      `)}</style>
    </head>
    <body>
      <div class="card">
        <div class="icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M10 10l12 12M22 10L10 22" stroke="white" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </div>
        <h1>Authentication Failed</h1>
        <p>Something went wrong while connecting your Strava account.</p>
        <code>{message}</code>
      </div>
    </body>
  </html>
);
