import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getValidToken, loadTokens, clearTokens, startOAuthFlow } from './auth.js';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? '';

if (!CLIENT_ID || !CLIENT_SECRET) {
  process.stderr.write(
    'Error: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set as environment variables.\n'
  );
  process.exit(1);
}

const server = new McpServer({
  name: 'strava-mcp',
  version: '1.0.0',
});

async function stravaGet(path: string): Promise<unknown> {
  const token = await getValidToken(CLIENT_ID, CLIENT_SECRET);
  if (!token) {
    throw new Error('Not connected to Strava. Use the connect_strava tool first.');
  }
  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? `Strava API error: ${res.status}`);
  }
  return res.json();
}

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

server.registerTool(
  'connect_strava',
  {
    description: 'Connect to Strava via OAuth. Opens a browser window to authorize. Must be called before using other tools.',
  },
  async () => {
    const existing = loadTokens();
    if (existing) {
      return ok(`Already connected as ${existing.athlete.firstname} ${existing.athlete.lastname} (@${existing.athlete.username}).`);
    }
    const record = await startOAuthFlow(CLIENT_ID, CLIENT_SECRET);
    return ok(`Connected as ${record.athlete.firstname} ${record.athlete.lastname} (@${record.athlete.username}).`);
  }
);

server.registerTool(
  'disconnect_strava',
  {
    description: 'Disconnect from Strava and delete the stored tokens.',
  },
  async () => {
    clearTokens();
    return ok('Disconnected from Strava. Stored tokens have been deleted.');
  }
);

server.registerTool(
  'get_athlete',
  {
    description: "Get the authenticated athlete's full profile.",
  },
  async () => ok(JSON.stringify(await stravaGet('/athlete'), null, 2))
);

server.registerTool(
  'list_activities',
  {
    description: "List the athlete's activities, newest first.",
    inputSchema: {
      per_page: z.number().min(1).max(200).optional().describe('Number of activities per page (default 30, max 200)'),
      page: z.number().min(1).optional().describe('Page number, starting at 1'),
      before: z.number().optional().describe('Return only activities before this Unix timestamp'),
      after: z.number().optional().describe('Return only activities after this Unix timestamp'),
    },
  },
  async ({ per_page, page, before, after }) => {
    const params = new URLSearchParams();
    if (per_page !== undefined) params.set('per_page', String(per_page));
    if (page !== undefined) params.set('page', String(page));
    if (before !== undefined) params.set('before', String(before));
    if (after !== undefined) params.set('after', String(after));
    return ok(JSON.stringify(await stravaGet(`/athlete/activities?${params}`), null, 2));
  }
);

server.registerTool(
  'get_activity',
  {
    description: 'Get detailed information about a specific activity.',
    inputSchema: {
      id: z.number().describe('The numeric activity ID'),
    },
  },
  async ({ id }) => ok(JSON.stringify(await stravaGet(`/activities/${id}`), null, 2))
);

server.registerTool(
  'get_athlete_stats',
  {
    description: "Get the athlete's all-time and recent totals for runs, rides, and swims.",
  },
  async () => {
    const athlete = await stravaGet('/athlete') as { id: number };
    return ok(JSON.stringify(await stravaGet(`/athletes/${athlete.id}/stats`), null, 2));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
