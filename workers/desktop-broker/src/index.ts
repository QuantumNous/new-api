// BoxAI desktop connector broker — api-desktop.you-box.com.
//
// Holds the OAuth client secrets so the desktop app does not have to ship them, and mints GitHub
// installation tokens. Connector access/refresh tokens pass through to the desktop's loopback
// listener and are never stored here; see schema.sql.
import type { Env } from "./env";
import { HttpError, json } from "./http";
import {
  handleCallback,
  handleConnections,
  handleDisconnect,
  handleGithubDisconnect,
  handleGithubToken,
  handleMe,
  handleRefresh,
  handleSlackUninstall,
  handleStart,
} from "./routes";

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "GET" && (path === "/" || path === "/health")) {
    return json({ ok: true, service: "boxai-desktop-broker" });
  }
  if (method === "GET" && path === "/v1/me") return handleMe(request, env);
  if (method === "GET" && path === "/v1/connections") return handleConnections(request, env);

  const oauth = /^\/v1\/oauth\/([a-z0-9_]+)\/(start|callback|refresh)$/.exec(path);
  if (oauth) {
    const [, provider, action] = oauth;
    if (action === "start" && method === "POST") return handleStart(request, env, provider);
    if (action === "callback" && method === "GET") return handleCallback(request, env, provider);
    if (action === "refresh" && method === "POST") return handleRefresh(request, env, provider);
  }

  if (method === "POST" && path === "/v1/github/token") return handleGithubToken(request, env);
  if (method === "POST" && path === "/v1/relay/github/disconnect") return handleGithubDisconnect(request, env);
  if (method === "POST" && path === "/v1/relay/slack/uninstall") return handleSlackUninstall(request, env);

  const disconnect = /^\/v1\/connections\/([A-Za-z0-9_-]+)\/disconnect$/.exec(path);
  if (disconnect && method === "POST") return handleDisconnect(request, env, disconnect[1]);

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error("unhandled broker error", err);
      return json({ error: "internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
