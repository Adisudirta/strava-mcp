import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { z } from 'zod';
import { deleteTokens, getValidAccessToken } from '../auth/token';

const STRAVA_API = 'https://www.strava.com/api/v3';

export type McpContext = {
  kv: KVNamespace;
  clientId: string;
  clientSecret: string;
  sessionId: string | null;
  redirectUri: string;
};

// Single mutable context per isolate — safe because Cloudflare Workers are single-threaded
let ctx: McpContext | null = null;

export function setMcpContext(context: McpContext) {
  ctx = context;
}

const NOT_AUTHENTICATED = {
  content: [{ type: 'text' as const, text: 'Not authenticated. Call get_auth_url to get the link to connect your Strava account.' }],
};

async function requireToken(): Promise<string | null> {
  if (!ctx?.sessionId) return null;
  return getValidAccessToken(ctx.kv, ctx.sessionId, ctx.clientId, ctx.clientSecret);
}

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

// Module-level server and transport — persists across requests within the same isolate
export const mcpServer = new McpServer({ name: 'strava-mcp', version: '1.0.0' });
export const mcpTransport = new StreamableHTTPTransport();

mcpServer.registerTool(
  'get_auth_url',
  {
    description: 'Get the URL to authenticate with Strava. Call this first if not authenticated — the user must open the URL in their browser.',
    inputSchema: {},
  },
  async () => {
    const authUrl = ctx?.redirectUri.replace('/auth/callback', '/auth/strava') ?? '/auth/strava';
    return {
      content: [{ type: 'text', text: `To use Strava tools, open this URL in your browser:\n\n${authUrl}` }],
    };
  }
);

mcpServer.registerTool(
  'logout',
  {
    description: 'Revoke the current session and disconnect from Strava.',
    inputSchema: {},
  },
  async () => {
    if (!ctx?.sessionId) return NOT_AUTHENTICATED;
    await deleteTokens(ctx.kv, ctx.sessionId);
    return {
      content: [{ type: 'text', text: 'You have been logged out. Call get_auth_url to reconnect your Strava account.' }],
    };
  }
);

mcpServer.registerTool(
  'get_athlete',
  {
    description: 'Get the authenticated athlete\'s profile information',
    inputSchema: {},
  },
  async () => {
    const token = await requireToken();
    if (!token) return NOT_AUTHENTICATED;
    const data = await stravaFetch('/athlete', token);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

mcpServer.registerTool(
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
    const token = await requireToken();
    if (!token) return NOT_AUTHENTICATED;
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

mcpServer.registerTool(
  'get_activity',
  {
    description: 'Get details of a specific activity by ID',
    inputSchema: {
      id: z.number().describe('The activity ID'),
    },
  },
  async ({ id }) => {
    const token = await requireToken();
    if (!token) return NOT_AUTHENTICATED;
    const data = await stravaFetch(`/activities/${id}`, token);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);
