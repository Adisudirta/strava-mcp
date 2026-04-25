import { Hono } from 'hono';
import { StreamableHTTPTransport } from '@hono/mcp';
import type { Env } from './types';
import { authRoutes } from './auth/routes';
import { getValidAccessToken } from './auth/token';
import { createMcpServer, createUnauthenticatedMcpServer } from './mcp/server';

const app = new Hono<Env>();

app.get('/', (c) => c.text('Strava MCP Server'));

app.route('/auth', authRoutes);

app.all('/mcp', async (c) => {
  const token = await getValidAccessToken(
    c.env.STRAVA_KV,
    c.env.STRAVA_CLIENT_ID,
    c.env.STRAVA_CLIENT_SECRET
  );

  const server = token ? createMcpServer(token) : createUnauthenticatedMcpServer(c.env.REDIRECT_URI);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

export default app;
