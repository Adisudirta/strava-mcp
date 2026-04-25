import { Hono } from 'hono';
import type { Env } from './types';
import { authRoutes } from './auth/routes';

const app = new Hono<Env>();

app.get('/', (c) => c.text('Strava MCP Server'));

app.route('/auth', authRoutes);

export default app;
