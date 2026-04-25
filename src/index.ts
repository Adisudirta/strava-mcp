import { Hono } from 'hono';
import type { Env } from './types';
import { authRoutes } from './auth/routes';
import { mcpServer, mcpTransport, setMcpContext } from './mcp/server';

const app = new Hono<Env>();

app.get('/', (c) => c.text('Strava MCP Server'));

app.route('/auth', authRoutes);

app.all('/mcp', async (c) => {
  const authHeader = c.req.header('Authorization');
  const sessionId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  setMcpContext({
    kv: c.env.STRAVA_KV,
    clientId: c.env.STRAVA_CLIENT_ID,
    clientSecret: c.env.STRAVA_CLIENT_SECRET,
    sessionId,
    redirectUri: c.env.REDIRECT_URI,
  });

  if (!mcpServer.isConnected()) {
    await mcpServer.connect(mcpTransport);
  }

  return mcpTransport.handleRequest(c);
});

export default app;
