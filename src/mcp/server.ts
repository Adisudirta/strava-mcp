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
  isError: true,
  content: [{ type: 'text' as const, text: 'Not authenticated. Call the get_auth_url tool to get the Strava login URL, then ask the user to open it in their browser.' }],
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
  'check_strava_connection',
  {
    description: 'Check whether the user is authenticated with Strava. Always call this first before using any other Strava tool. If not connected, it returns the URL the user must open in their browser to authenticate.',
    inputSchema: {},
  },
  async () => {
    const token = await requireToken();
    if (token) {
      const data = await stravaFetch('/athlete', token) as { firstname?: string; lastname?: string };
      const name = [data.firstname, data.lastname].filter(Boolean).join(' ') || 'Athlete';
      return {
        content: [{ type: 'text', text: `Connected to Strava as ${name}. You can now use Strava tools.` }],
      };
    }
    return {
      isError: true,
      content: [{ type: 'text', text: 'Not connected to Strava. Please reconnect this MCP server in Claude\'s settings to start the Strava login flow.' }],
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
    description: 'Get the authenticated athlete\'s profile information. Call check_strava_connection first to verify authentication.',
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
    description: 'List the authenticated athlete\'s recent activities. Call check_strava_connection first to verify authentication.',
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
    description: 'Get details of a specific activity by ID. Call check_strava_connection first to verify authentication.',
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
