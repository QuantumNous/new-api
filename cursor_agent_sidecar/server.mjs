/**
 * Cursor Agent sidecar for new-api.
 *
 * Official @cursor/sdk only — no reverse-engineered api2.cursor.sh client.
 * Surface: Anthropic-compatible /v1/messages (+ /health, /v1/models).
 *
 * Safety defaults:
 * - tools: [] (text only; no shell/fs)
 * - empty workspace cwd
 * - no project/user setting sources
 * - optional force_proxy for development environments that require an egress proxy
 */
// Load before @cursor/sdk. force_proxy is a no-op unless CURSOR_AGENT_FORCE_PROXY
// or CURSOR_AGENT_PROXY is set (see force_proxy.mjs).
import "./force_proxy.mjs";
import http from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Cursor, JsonlLocalAgentStore } from "@cursor/sdk";
import { fetchCursorAccount } from "./cursor_account.mjs";
import {
  CursorHarnessMessagesBridge,
  cursorHarnessRequestHasToolResults,
  cursorHarnessRouteFromRequest,
} from "./harness_messages.mjs";
import { CursorHarnessSessionState, deleteSdkAgentState } from "./session_state.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CURSOR_AGENT_SIDECAR_PORT || 3927);
const HOST = process.env.CURSOR_AGENT_SIDECAR_HOST || "127.0.0.1";
const BUILD_COMMIT = process.env.CURSOR_AGENT_BUILD_COMMIT || "unknown";
const BUILD_TIME = process.env.CURSOR_AGENT_BUILD_TIME || "unknown";
const INSTANCE_ID = String(
  process.env.CURSOR_AGENT_INSTANCE_ID || process.env.HOSTNAME || "local",
)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 24) || "local";
const PEER_BASE_URL_TEMPLATE = String(
  process.env.CURSOR_AGENT_PEER_BASE_URL_TEMPLATE || "",
).trim();
const PEER_INSTANCE_IDS = new Set(
  String(process.env.CURSOR_AGENT_PEER_INSTANCE_IDS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const STATE_DIR = String(process.env.CURSOR_AGENT_STATE_DIR || "").trim();
const WORKSPACE = resolve(
  process.env.CURSOR_AGENT_WORKSPACE || resolve(__dirname, "empty-workspace"),
);

function integerEnv(name, fallback, { min }) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
}

const PARALLEL_TOOL_COLLECT_MS = integerEnv(
  "CURSOR_AGENT_PARALLEL_TOOL_COLLECT_MS",
  100,
  { min: 0 },
);
const MAX_ACTIVE_SESSIONS = integerEnv("CURSOR_AGENT_MAX_ACTIVE_SESSIONS", 256, {
  min: 1,
});
const MAX_SESSIONS_PER_CREDENTIAL = integerEnv(
  "CURSOR_AGENT_MAX_SESSIONS_PER_CREDENTIAL",
  32,
  { min: 1 },
);
mkdirSync(WORKSPACE, { recursive: true });
if (STATE_DIR) mkdirSync(STATE_DIR, { recursive: true });
const sdkStore = STATE_DIR
  ? new JsonlLocalAgentStore(resolve(STATE_DIR, "sdk-store"))
  : undefined;
const sessionState = STATE_DIR
  ? new CursorHarnessSessionState(resolve(STATE_DIR, "bridge-sessions.json"), {
      onExpire: (record) => deleteSdkAgentState(sdkStore, record.agentId),
    })
  : undefined;
const harnessMessagesBridge = new CursorHarnessMessagesBridge({
  workspace: WORKSPACE,
  parallelCollectMs: PARALLEL_TOOL_COLLECT_MS,
  instanceId: INSTANCE_ID,
  sdkStore,
  sessionState,
  maxActiveSessions: MAX_ACTIVE_SESSIONS,
  maxSessionsPerCredential: MAX_SESSIONS_PER_CREDENTIAL,
});

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function extractApiKey(req) {
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const x = req.headers["x-api-key"] || req.headers["x-cursor-api-key"];
  if (typeof x === "string" && x.trim()) return x.trim();
  // Env fallback is opt-in only. Default off so a shared/misbound sidecar
  // cannot serve arbitrary callers with the host CURSOR_API_KEY.
  if (
    process.env.CURSOR_AGENT_ALLOW_ENV_KEY === "1" &&
    process.env.CURSOR_API_KEY
  ) {
    return process.env.CURSOR_API_KEY.trim();
  }
  return "";
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function createAnthropicSSEWriter(res) {
  let started = false;
  let ended = false;
  let streamedText = false;
  let openTextBlock = -1;
  let openThinkingBlock = -1;
  let nextBlockIndex = 0;

  const event = (name, data) => {
    if (ended || res.destroyed) return;
    res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const start = ({ id, model }) => {
    if (started || ended || res.destroyed) return;
    started = true;
    res.socket?.setNoDelay?.(true);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Cursor-Agent-Harness": "cursor-sdk",
    });
    event("message_start", {
      type: "message_start",
      message: {
        id,
        type: "message",
        role: "assistant",
        model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    });
  };

  const closeTextBlock = () => {
    if (openTextBlock < 0) return;
    event("content_block_stop", {
      type: "content_block_stop",
      index: openTextBlock,
    });
    openTextBlock = -1;
  };

  const closeThinkingBlock = () => {
    if (openThinkingBlock < 0) return;
    event("content_block_stop", {
      type: "content_block_stop",
      index: openThinkingBlock,
    });
    openThinkingBlock = -1;
  };

  const thinking = (delta, meta) => {
    if (!delta || ended || res.destroyed) return;
    start(meta);
    closeTextBlock();
    if (openThinkingBlock < 0) {
      openThinkingBlock = nextBlockIndex++;
      event("content_block_start", {
        type: "content_block_start",
        index: openThinkingBlock,
        content_block: { type: "thinking", thinking: "" },
      });
    }
    event("content_block_delta", {
      type: "content_block_delta",
      index: openThinkingBlock,
      delta: { type: "thinking_delta", thinking: String(delta) },
    });
  };

  const text = (delta, meta) => {
    if (!delta || ended || res.destroyed) return;
    start(meta);
    closeThinkingBlock();
    if (openTextBlock < 0) {
      openTextBlock = nextBlockIndex++;
      event("content_block_start", {
        type: "content_block_start",
        index: openTextBlock,
        content_block: { type: "text", text: "" },
      });
    }
    streamedText = true;
    event("content_block_delta", {
      type: "content_block_delta",
      index: openTextBlock,
      delta: { type: "text_delta", text: String(delta) },
    });
  };

  const writeBlock = (block) => {
    if (block.type === "text") {
      if (streamedText) return;
      text(String(block.text || ""), {
        id: currentMessage.id,
        model: currentMessage.model,
      });
      closeTextBlock();
      return;
    }
    closeTextBlock();
    closeThinkingBlock();
    const index = nextBlockIndex++;
    if (block.type === "tool_use") {
      event("content_block_start", {
        type: "content_block_start",
        index,
        content_block: {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: {},
        },
      });
      event("content_block_delta", {
        type: "content_block_delta",
        index,
        delta: {
          type: "input_json_delta",
          partial_json: JSON.stringify(block.input || {}),
        },
      });
    }
    event("content_block_stop", { type: "content_block_stop", index });
  };

  let currentMessage = null;
  const finish = (message) => {
    if (ended || res.destroyed) return;
    currentMessage = message;
    start({ id: message.id, model: message.model });
    for (const block of message.content || []) writeBlock(block);
    closeTextBlock();
    closeThinkingBlock();
    event("message_delta", {
      type: "message_delta",
      delta: { stop_reason: message.stop_reason, stop_sequence: null },
      usage: {
        input_tokens: message.usage?.input_tokens || 0,
        output_tokens: message.usage?.output_tokens || 0,
        cache_read_input_tokens: message.usage?.cache_read_input_tokens || 0,
        cache_creation_input_tokens:
          message.usage?.cache_creation_input_tokens || 0,
      },
    });
    event("message_stop", { type: "message_stop" });
    ended = true;
    res.end();
  };

  const fail = (error) => {
    if (!started || ended || res.destroyed) return;
    closeTextBlock();
    closeThinkingBlock();
    event("error", {
      type: "error",
      error: { type: "api_error", message: error?.message || String(error) },
    });
    ended = true;
    res.end();
  };

  return {
    thinking,
    text,
    finish,
    fail,
    get started() {
      return started;
    },
  };
}

async function handleHarnessMessages(req, res, apiKey) {
  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    return json(res, 400, {
      type: "error",
      error: { type: "invalid_request_error", message: "invalid json body" },
    });
  }
  let routedInstance;
  try {
    routedInstance = cursorHarnessRouteFromRequest(body);
  } catch (error) {
    return json(res, Number(error?.status) || 409, {
      type: "error",
      error: { type: "conflict_error", message: error?.message || String(error) },
    });
  }
  if (routedInstance && routedInstance !== INSTANCE_ID) {
    return proxyHarnessMessages(req, res, raw, apiKey, routedInstance);
  }
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    console.error(
      "[cursor-harness-request]",
      JSON.stringify({
        model: body.model,
        stream: Boolean(body.stream),
        systemLength:
          typeof body.system === "string"
            ? body.system.length
            : JSON.stringify(body.system || "").length,
        maxTokens: body.max_tokens,
        toolChoice: body.tool_choice || null,
        tools: body.tools.map((tool) => String(tool?.name || "")),
        messageRoles: Array.isArray(body.messages)
          ? body.messages.map((message) => String(message?.role || ""))
          : [],
      }),
    );
  }
  const abortController = new AbortController();
  const abortOnDisconnect = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.once("close", abortOnDisconnect);
  const streamWriter = body.stream ? createAnthropicSSEWriter(res) : null;
  try {
    const response = await harnessMessagesBridge.handle(body, apiKey, {
      signal: abortController.signal,
      tenantId: String(req.headers["x-cursor-agent-tenant"] || ""),
      onTextDelta: streamWriter
        ? (text, meta) => streamWriter.text(text, meta)
        : undefined,
      onThinkingDelta: streamWriter
        ? (text, meta) => streamWriter.thinking(text, meta)
        : undefined,
    });
    if (streamWriter) return streamWriter.finish(response);
    return json(res, 200, response);
  } catch (err) {
    if (res.destroyed) return;
    const peerHop = String(req.headers["x-cursor-agent-peer-hop"] || "");
    if (
      !streamWriter?.started &&
      Number(err?.status) === 409 &&
      !routedInstance &&
      cursorHarnessRequestHasToolResults(body) &&
      peerHop !== "1"
    ) {
      const legacyPeer = INSTANCE_ID === "blue" ? "green" : INSTANCE_ID === "green" ? "blue" : "";
      if (legacyPeer) {
        return proxyHarnessMessages(req, res, raw, apiKey, legacyPeer);
      }
    }
    if (streamWriter?.started) return streamWriter.fail(err);
    if (err?.retryAfter) res.setHeader("Retry-After", String(err.retryAfter));
    return json(res, Number(err?.status) || 502, {
      type: "error",
      error: {
        type: Number(err?.status) === 409 ? "conflict_error" : "api_error",
        message: err?.message || String(err),
      },
    });
  } finally {
    res.off("close", abortOnDisconnect);
  }
}

function peerBaseURL(instanceId) {
  if (!PEER_BASE_URL_TEMPLATE.includes("{instance}")) {
    throw Object.assign(new Error("cursor harness peer routing is not configured"), {
      status: 503,
    });
  }
  if (!/^[a-z0-9-]{1,24}$/.test(instanceId)) {
    throw new Error("invalid cursor harness peer instance id");
  }
  if (!PEER_INSTANCE_IDS.has(instanceId)) {
    throw Object.assign(new Error("cursor harness peer instance is not allowlisted"), {
      status: 503,
    });
  }
  return PEER_BASE_URL_TEMPLATE.replaceAll("{instance}", instanceId).replace(/\/$/, "");
}

async function proxyHarnessMessages(req, res, raw, apiKey, instanceId) {
  const abortController = new AbortController();
  const abortOnDisconnect = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.once("close", abortOnDisconnect);
  try {
    const upstream = await fetch(`${peerBaseURL(instanceId)}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "x-cursor-agent-peer-hop": "1",
        ...(typeof req.headers["x-cursor-agent-tenant"] === "string"
          ? { "x-cursor-agent-tenant": req.headers["x-cursor-agent-tenant"] }
          : {}),
        ...(typeof req.headers["anthropic-version"] === "string"
          ? { "anthropic-version": req.headers["anthropic-version"] }
          : {}),
        ...(typeof req.headers["anthropic-beta"] === "string"
          ? { "anthropic-beta": req.headers["anthropic-beta"] }
          : {}),
      },
      body: raw,
      signal: abortController.signal,
    });
    const headers = {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": upstream.headers.get("cache-control") || "no-cache, no-transform",
      "X-Cursor-Agent-Harness": "cursor-sdk",
      "X-Cursor-Agent-Routed-Instance": instanceId,
    };
    res.writeHead(upstream.status, headers);
    if (upstream.body) {
      for await (const chunk of upstream.body) {
        if (res.destroyed) break;
        res.write(chunk);
      }
    }
    if (!res.writableEnded && !res.destroyed) res.end();
  } catch (error) {
    if (res.destroyed) return;
    if (!res.headersSent) {
      return json(res, 502, {
        type: "error",
        error: {
          type: "api_error",
          message: `cursor harness instance ${instanceId} is unavailable`,
        },
      });
    }
    res.end();
  } finally {
    res.off("close", abortOnDisconnect);
  }
}

async function handleModels(req, res, apiKey) {
  try {
    const models = await Cursor.models.list({ apiKey });
    const data = (models || []).map((m) => {
      const id = typeof m === "string" ? m : m.id || m.name;
      return {
        // Bare Cursor catalog SKU — same names as other channels (no prefix).
        id: String(id),
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "cursor",
      };
    });
    return json(res, 200, { object: "list", data });
  } catch (err) {
    return json(res, 502, {
      error: { message: err?.message || String(err), type: "upstream_error" },
    });
  }
}

async function handleAccount(req, res, apiKey) {
  try {
    return json(res, 200, await fetchCursorAccount(apiKey));
  } catch (err) {
    return json(res, 502, {
      error: { message: err?.message || String(err), type: "upstream_error" },
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const path = url.pathname;

    if (req.method === "GET" && (path === "/health" || path === "/")) {
      const sessionStatus = harnessMessagesBridge.status();
      return json(res, 200, {
        ok: true,
        service: "cursor-agent-sidecar",
        instance_id: INSTANCE_ID || null,
        build_commit: BUILD_COMMIT,
        build_time: BUILD_TIME,
        accepting: sessionStatus.accepting,
        sessions: {
          live: sessionStatus.liveSessions,
          persisted: sessionStatus.persistedSessions,
          drain: sessionStatus.drainSessions,
          awaiting: sessionStatus.persisted.awaiting,
          replay: sessionStatus.persisted.replay,
        },
        // Capability matrix for the native SDK harness bridge. Assistant text
        // is forwarded incrementally; tool args arrive complete from SDK MCP.
        capabilities: {
          messages_text: true,
          messages_streaming: true,
          thinking_streaming: true,
          tools: true,
          tools_streaming: false,
          parallel_tool_calls: true,
          sequential_tool_turns: true,
          tool_result_replay: true,
          process_restart_recovery: Boolean(STATE_DIR),
          active_session_drain: true,
          session_idle_ttl_seconds: 900,
          count_tokens: false,
          responses: false,
          generation_controls: {
            effort: true,
            max_tokens: false,
            temperature: false,
            top_p: false,
            stop_sequences: false,
          },
        },
      });
    }

    if (req.method === "GET" && path === "/v1/models") {
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        return json(res, 401, {
          error: { message: "missing api key", type: "authentication_error" },
        });
      }
      return handleModels(req, res, apiKey);
    }

    if (req.method === "GET" && path === "/v1/account") {
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        return json(res, 401, {
          error: { message: "missing api key", type: "authentication_error" },
        });
      }
      return handleAccount(req, res, apiKey);
    }

    if (req.method === "POST" && path.endsWith("/messages")) {
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        return json(res, 401, {
          type: "error",
          error: { type: "authentication_error", message: "missing api key" },
        });
      }
      return handleHarnessMessages(req, res, apiKey);
    }

    return json(res, 404, {
      error: { message: `not found: ${path}`, type: "invalid_request_error" },
    });
  } catch (err) {
    if (!res.headersSent) {
      return json(res, 500, {
        error: { message: err?.message || String(err), type: "server_error" },
      });
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[cursor-agent-sidecar] listening on http://${HOST}:${PORT} workspace=${WORKSPACE}`,
  );
});

let shutdownStarted = false;
async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`[cursor-agent-sidecar] ${signal}: draining harness sessions`);
  harnessMessagesBridge.beginDrain();
  const drained = await harnessMessagesBridge.waitForDrain(25_000);
  await new Promise((resolveClose) => server.close(resolveClose));
  await harnessMessagesBridge.shutdown({ preserveState: !drained });
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGUSR2", () => {
  console.log("[cursor-agent-sidecar] SIGUSR2: refusing new sessions and draining");
  harnessMessagesBridge.beginDrain();
});
