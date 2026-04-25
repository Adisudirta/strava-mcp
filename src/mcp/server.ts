import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { deleteTokens } from '../auth/token';

const STRAVA_API = 'https://www.strava.com/api/v3';

async function stravaFetch(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${STRAVA_API}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Strava API error ${res.status}: ${err}`);
  }
  return res.json();
}

export function createUnauthenticatedMcpServer(redirectUri: string): McpServer {
  const server = new McpServer({ name: 'strava-mcp', version: '1.0.0' });
  const authUrl = redirectUri.replace('/auth/callback', '/auth/strava');

  server.registerTool(
    'get_auth_url',
    {
      description: 'Get the URL to authenticate with Strava. Call this first — the user must visit the URL in their browser to connect their Strava account.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text', text: `To use this MCP server, please open the following URL in your browser to authenticate with Strava:\n\n${authUrl}` }],
    })
  );

  return server;
}

export function createMcpServer(token: string, sessionId: string, kv: KVNamespace): McpServer {
  const server = new McpServer({
    name: 'strava-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    'logout',
    {
      description: 'Revoke the current session and disconnect from Strava. The user will need to re-authenticate to use Strava tools again.',
      inputSchema: {},
    },
    async () => {
      await deleteTokens(kv, sessionId);
      return {
        content: [{ type: 'text', text: 'You have been logged out. Visit /auth/strava to reconnect your Strava account.' }],
      };
    }
  );

  server.registerTool(
    'get_athlete',
    {
      description: 'Get the authenticated athlete\'s profile information',
      inputSchema: {},
    },
    async () => {
      const data = await stravaFetch('/athlete', token);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    'list_activities',
    {
      description: 'List the authenticated athlete\'s recent activities',
      inputSchema: {
        per_page: z.number().min(1).max(200).default(30).describe('Number of activities per page'),
        page: z.number().min(1).default(1).describe('Page number'),
        before: z.number().optional().describe('Unix timestamp — return activities before this time'),
        after: z.number().optional().describe('Unix timestamp — return activities after this time'),
      },
    },
    async ({ per_page, page, before, after }) => {
      const params: Record<string, string> = {
        per_page: String(per_page),
        page: String(page),
      };
      if (before !== undefined) params.before = String(before);
      if (after !== undefined) params.after = String(after);

      const data = await stravaFetch('/athlete/activities', token, params);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    'get_activity',
    {
      description: 'Get details of a specific activity by ID',
      inputSchema: {
        id: z.number().describe('The activity ID'),
      },
    },
    async ({ id }) => {
      const data = await stravaFetch(`/activities/${id}`, token);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}
