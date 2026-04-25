import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authRoutes } from "./auth/routes";
import { decryptSessionId } from "./auth/crypto";
import { mcpServer, mcpTransport, setMcpContext } from "./mcp/server";

const app = new Hono<Env>();

app.get("/", (c) => c.redirect("/auth/connect"));

app.route("/auth", authRoutes);

app.all("/mcp", async (c) => {
  const authHeader = c.req.header("Authorization");
  let sessionId: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    sessionId = authHeader.slice(7);
  } else {
    const urlToken = c.req.query("token");
    if (urlToken) {
      sessionId = await decryptSessionId(urlToken, c.env.ENCRYPTION_KEY);
    }
  }

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
