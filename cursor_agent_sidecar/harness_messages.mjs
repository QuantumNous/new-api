import { createHash, randomUUID } from "node:crypto";
import { Agent } from "@cursor/sdk";
import { deleteSdkAgentState } from "./session_state.mjs";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;
const DEFAULT_REPLAY_TTL_MS = 2 * 60 * 1000;
const DEFAULT_FIRST_EVENT_TIMEOUT_MS = 90 * 1000;
const DEFAULT_PARALLEL_COLLECT_MS = 100;
const ROUTED_TOOL_USE_ID_PATTERN = /^toolu_bf_([a-z0-9-]{1,24})_([a-f0-9]{32})$/;

function normalizeInstanceId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (!/^[a-z0-9-]{1,24}$/.test(normalized)) {
    throw new Error("cursor harness instance id must use 1-24 lowercase letters, digits, or hyphens");
  }
  return normalized;
}

function routedToolUseId(instanceId) {
  return `toolu_bf_${instanceId}_${randomUUID().replaceAll("-", "")}`;
}

export function cursorHarnessInstanceFromToolUseId(toolUseId) {
  return String(toolUseId || "").match(ROUTED_TOOL_USE_ID_PATTERN)?.[1] || "";
}

export function cursorHarnessRouteFromRequest(body) {
  const toolResults = extractLatestToolResults(body);
  if (toolResults.length === 0) return "";
  const routes = new Set();
  let legacyCount = 0;
  for (const result of toolResults) {
    const route = cursorHarnessInstanceFromToolUseId(result.toolUseId);
    if (route) routes.add(route);
    else legacyCount += 1;
  }
  if (routes.size > 1 || (routes.size === 1 && legacyCount > 0)) {
    throw Object.assign(new Error("tool results span multiple harness instances"), {
      status: 409,
    });
  }
  return routes.values().next().value || "";
}

export function cursorHarnessRequestHasToolResults(body) {
  return extractLatestToolResults(body).length > 0;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function credentialFingerprint(apiKey) {
  return createHash("sha256").update(String(apiKey || "")).digest("hex");
}

function tenantFingerprint(tenantId) {
  return createHash("sha256").update(String(tenantId || "")).digest("hex");
}

function anthropicEffort(body) {
  const explicit = String(body?.output_config?.effort || "").trim().toLowerCase();
  if (["low", "medium", "high", "xhigh"].includes(explicit)) return explicit;
  const thinking = body?.thinking;
  if (!thinking || !["enabled", "adaptive"].includes(thinking.type)) return "";
  const budget = Number(thinking.budget_tokens || 0);
  if (budget > 0 && budget <= 2048) return "low";
  if (budget > 10000) return "high";
  return "medium";
}

export function cursorSdkModelSelection(model, body = undefined) {
  const normalized = String(model || "").trim();
  const grok = normalized.match(/^cursor-(grok-4\.(?:5|6))-(low|medium|high|xhigh)$/i);
  if (grok) {
    return {
      id: grok[1].toLowerCase(),
      params: [{ id: "effort", value: grok[2].toLowerCase() }],
    };
  }
  const effort = anthropicEffort(body);
  if (effort && /^claude-/i.test(normalized)) {
    return { id: normalized, params: [{ id: "effort", value: effort }] };
  }
  return { id: normalized };
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function serializedContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    } else if (block?.type === "tool_use" && block.id && block.name) {
      parts.push(
        `TOOL_USE id=${String(block.id)} name=${String(block.name)} input=${JSON.stringify(block.input || {})}`,
      );
    } else if (block?.type === "tool_result" && block.tool_use_id) {
      parts.push(
        `TOOL_RESULT tool_use_id=${String(block.tool_use_id)} is_error=${Boolean(block.is_error)} content=${JSON.stringify(textFromContent(block.content) || String(block.content || ""))}`,
      );
    } else if (block?.type === "image") {
      parts.push("IMAGE_ATTACHMENT");
    }
  }
  return parts.join("\n");
}

function imagesFromAnthropicRequest(body) {
  const images = [];
  for (const message of body?.messages || []) {
    if (!Array.isArray(message?.content)) continue;
    for (const block of message.content) {
      if (block?.type !== "image" || !block.source) continue;
      if (
        block.source.type === "base64" &&
        typeof block.source.data === "string" &&
        typeof block.source.media_type === "string"
      ) {
        images.push({ data: block.source.data, mimeType: block.source.media_type });
      } else if (block.source.type === "url" && typeof block.source.url === "string") {
        images.push({ url: block.source.url });
      }
    }
  }
  return images;
}

function promptFromAnthropicRequest(body) {
  const parts = [];
  const system = textFromContent(body?.system);
  if (system) parts.push(`SYSTEM:\n${system}`);
  for (const message of body?.messages || []) {
    const content = serializedContent(message?.content);
    if (content) parts.push(`${String(message.role || "user").toUpperCase()}:\n${content}`);
  }
  const tools = Array.isArray(body?.tools) ? body.tools : [];
  const toolChoice = body?.tool_choice;
  if (tools.length > 0 && toolChoice?.type === "tool" && toolChoice.name) {
    parts.push(
      `HARNESS:\nYou must call the custom MCP tool ${String(toolChoice.name)} before answering.`,
    );
  } else if (
    tools.length > 0 &&
    toolChoice?.type === "any" &&
    toolChoice.disable_parallel_tool_use === true
  ) {
    parts.push(
      "HARNESS:\nYou must call exactly one available custom MCP tool before answering. Do not call tools in parallel.",
    );
  } else if (tools.length > 0 && toolChoice?.type === "any") {
    parts.push(
      "HARNESS:\nYou must call at least one available custom MCP tool before answering. If the task needs multiple independent tools, call all of them together in the same turn so they can run in parallel.",
    );
  }
  return parts.join("\n\n");
}

function extractLatestToolResults(body) {
  const results = [];
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const latestUserMessage = [...messages].reverse().find((message) => message?.role === "user");
  if (!Array.isArray(latestUserMessage?.content)) return results;
  for (const block of latestUserMessage.content) {
    if (block?.type !== "tool_result" || !block.tool_use_id) continue;
    const text = textFromContent(block.content);
    results.push({
      toolUseId: String(block.tool_use_id),
      isError: Boolean(block.is_error),
      content: text || (typeof block.content === "string" ? block.content : ""),
    });
  }
  return results;
}

function latestUserHasMixedToolResultContent(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const latestUserMessage = [...messages].reverse().find((message) => message?.role === "user");
  if (!Array.isArray(latestUserMessage?.content)) return false;
  const hasToolResult = latestUserMessage.content.some(
    (block) => block?.type === "tool_result" && block.tool_use_id,
  );
  return (
    hasToolResult &&
    latestUserMessage.content.some((block) => {
      if (block?.type === "tool_result") return false;
      if (block?.type === "text") return Boolean(String(block.text || "").trim());
      return block != null;
    })
  );
}

function customToolsFromAnthropic(tools, onCall) {
  const customTools = {};
  for (const tool of tools || []) {
    const name = String(tool?.name || "").trim();
    if (!name || customTools[name]) continue;
    customTools[name] = {
      description: String(tool?.description || ""),
      inputSchema:
        tool?.input_schema && typeof tool.input_schema === "object"
          ? tool.input_schema
          : { type: "object", properties: {} },
      execute: (args, context) => onCall(name, args || {}, context || {}),
    };
  }
  return customTools;
}

function anthropicUsage(usage) {
  return {
    input_tokens: Number(usage?.inputTokens ?? usage?.input_tokens ?? 0) || 0,
    output_tokens: Number(usage?.outputTokens ?? usage?.output_tokens ?? 0) || 0,
    cache_read_input_tokens:
      Number(usage?.cacheReadTokens ?? usage?.cache_read_input_tokens ?? 0) || 0,
    cache_creation_input_tokens:
      Number(usage?.cacheWriteTokens ?? usage?.cache_creation_input_tokens ?? 0) || 0,
  };
}

function newAnthropicMessageId() {
  return `msg_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function anthropicMessage({ id, model, content, stopReason, usage }) {
  return {
    id: id || newAnthropicMessageId(),
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: anthropicUsage(usage),
  };
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function toolResultDigest(toolResult) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: toolResult.toolUseId,
        content: toolResult.content,
        isError: toolResult.isError,
      }),
    )
    .digest("hex");
}

function toolResultRequestDigest(toolResults) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        toolResults
          .map((result) => ({ id: result.toolUseId, digest: toolResultDigest(result) }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
    )
    .digest("hex");
}

function recoveredToolResultPrompt(record, toolResults) {
  const names = new Map((record.pending || []).map((item) => [item.toolUseId, item.name]));
  const lines = toolResults.map((result) =>
    `TOOL_RESULT tool_use_id=${result.toolUseId} tool=${names.get(result.toolUseId) || "unknown"} is_error=${result.isError} content=${JSON.stringify(result.content)}`,
  );
  return [
    "HOST_RECOVERY:",
    "The host process restarted while your external tool calls were waiting for results.",
    "Continue the same task from the persisted agent checkpoint using these exact results.",
    "Do not repeat the completed tool calls. You may call other tools only if the task still requires them.",
    ...lines,
  ].join("\n");
}

export class CursorHarnessMessagesBridge {
  constructor(options = {}) {
    this.workspace = options.workspace;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.replayTtlMs = options.replayTtlMs ?? DEFAULT_REPLAY_TTL_MS;
    this.firstEventTimeoutMs =
      options.firstEventTimeoutMs ?? DEFAULT_FIRST_EVENT_TIMEOUT_MS;
    this.parallelCollectMs = options.parallelCollectMs ?? DEFAULT_PARALLEL_COLLECT_MS;
    this.maxActiveSessions = options.maxActiveSessions ?? 256;
    this.maxSessionsPerCredential = options.maxSessionsPerCredential ?? 32;
    this.instanceId = normalizeInstanceId(options.instanceId || "");
    this.agentFactory = options.agentFactory || ((agentOptions) => Agent.create(agentOptions));
    this.agentResumer =
      options.agentResumer || ((agentId, agentOptions) => Agent.resume(agentId, agentOptions));
    this.sdkStore = options.sdkStore;
    this.sessionState = options.sessionState;
    this.sessionsByToolUseId = new Map();
    this.sessions = new Set();
    this.persistedRecoveries = new Map();
    this.accepting = true;
  }

  async handle(body, apiKey, options = {}) {
    const toolResults = extractLatestToolResults(body);
    if (toolResults.length > 0) {
      if (latestUserHasMixedToolResultContent(body)) {
        throw Object.assign(
          new Error("tool_result blocks and new user content require separate turns"),
          { status: 422 },
        );
      }
      return this.#resume(toolResults, body, apiKey, options);
    }
    if (!this.accepting) {
      throw Object.assign(new Error("cursor harness sidecar is draining"), {
        status: 503,
        retryAfter: 2,
      });
    }
    return this.#start(body, apiKey, options);
  }

  async #start(body, apiKey, options) {
    const signal = options.signal;
    const model = String(body?.model || "").trim();
    const prompt = promptFromAnthropicRequest(body);
    const images = imagesFromAnthropicRequest(body);
    if (!model) throw Object.assign(new Error("model is required"), { status: 400 });
    if (!prompt) throw Object.assign(new Error("messages are required"), { status: 400 });
    const hasTools = Array.isArray(body?.tools) && body.tools.length > 0;
    const fingerprint = credentialFingerprint(apiKey);
    if (this.sessions.size >= this.maxActiveSessions) {
      throw Object.assign(new Error("cursor harness active session limit reached"), {
        status: 429,
        retryAfter: 2,
      });
    }
    let credentialSessions = 0;
    for (const active of this.sessions) {
      if (active.credentialFingerprint === fingerprint) credentialSessions += 1;
    }
    if (credentialSessions >= this.maxSessionsPerCredential) {
      throw Object.assign(new Error("cursor harness credential session limit reached"), {
        status: 429,
        retryAfter: 2,
      });
    }
    const session = this.#newSession(model, fingerprint, options);
    session.usesSdkStore = Boolean(hasTools && this.sdkStore);
    this.sessions.add(session);
    if (signal) {
      this.#bindAbort(session, signal);
      if (signal.aborted) {
        const error = Object.assign(new Error("cursor harness client disconnected"), {
          status: 499,
        });
        await this.#closeSession(session, error);
        throw error;
      }
    }

    const customTools = this.#customTools(session, body.tools);
    try {
      session.agent = await this.agentFactory({
        apiKey,
        model: cursorSdkModelSelection(model, body),
        tools: hasTools ? ["mcp"] : [],
        disallowedTools: ["shell", "read", "edit", "task", "webSearch", "webFetch"],
        local: {
          cwd: this.workspace,
          settingSources: [],
          ...(session.usesSdkStore ? { store: this.sdkStore } : {}),
          // This bridge exposes only deferred host callbacks through MCP; all
          // filesystem, shell, task, and web tools are denied above. The slim
          // production container intentionally does not ship Cursor's sandbox
          // binary, so requesting SDK sandboxing would fail before inference.
          sandboxOptions: { enabled: false },
          ...(hasTools ? { customTools } : {}),
        },
      });
      if (session.closed) {
        try {
          session.agent?.close?.();
        } catch {
          // Best effort: the session was closed while Agent.create was pending.
        }
        throw Object.assign(new Error("cursor harness client disconnected"), {
          status: 499,
        });
      }
      const run = await session.agent.send(
        images.length > 0 ? { text: prompt, images } : prompt,
        {
          onDelta: ({ update }) => this.#handleInteractionUpdate(session, update),
        },
      );
      if (session.closed) {
        try {
          if (run?.status === "running") await run.cancel();
        } catch {
          // Best effort: the session is already closed and forgotten.
        }
        throw Object.assign(new Error("cursor harness client disconnected"), {
          status: 499,
        });
      }
      session.run = run;
      this.#drainRun(session);
    } catch (error) {
      await this.#closeSession(session, error);
      throw error;
    }

    let next;
    try {
      await withTimeout(
        Promise.race([
          session.firstSemanticEvent.promise,
          session.closeSignal.promise.then((error) => Promise.reject(error)),
        ]),
        this.firstEventTimeoutMs,
        hasTools
          ? "cursor harness timed out before tool call or final response"
          : "cursor harness timed out before final response",
      );
      next = await withTimeout(
        this.#nextToolBatchOrDone(session),
        Math.max(
          this.sessionTtlMs,
          this.firstEventTimeoutMs + this.parallelCollectMs,
        ),
        "cursor harness timed out after the first response event",
      );
    } catch (error) {
      await this.#closeSession(session, error);
      throw Object.assign(error, { status: error?.status || 504 });
    }

    if (next.kind === "tools") {
      this.#armExpiry(session);
      const response = this.#toolUseMessage(session, next.pending);
      session.onTextDelta = null;
      session.onThinkingDelta = null;
      return response;
    }

    try {
      const response = this.#finalMessage(session);
      await this.#closeSession(session);
      return response;
    } catch (error) {
      await this.#closeSession(session, error);
      throw error;
    }
  }

  async #resume(toolResults, body, apiKey, options) {
    const signal = options.signal;
    const located = toolResults.map((result) => this.sessionsByToolUseId.get(result.toolUseId));
    const liveCount = located.filter(Boolean).length;
    if (liveCount === 0 && this.sessionState) {
      const persisted = this.sessionState.findByToolUseIds(
        toolResults.map((result) => result.toolUseId),
      );
      if (persisted) {
        return this.#resumePersistedSingleflight(persisted, toolResults, body, apiKey, options);
      }
    }
    if (liveCount > 0 && liveCount !== located.length) {
      throw Object.assign(new Error("tool results span live and missing harness sessions"), {
        status: 409,
      });
    }
    const sessions = new Set();
    for (const toolResult of toolResults) {
      const session = this.sessionsByToolUseId.get(toolResult.toolUseId);
      if (!session || (session.closed && !session.retainedForReplay)) {
        throw Object.assign(
          new Error(`unknown or expired tool_use_id: ${toolResult.toolUseId}`),
          { status: 409 },
        );
      }
      const pending = session.pending.get(toolResult.toolUseId);
      if (!pending) {
        throw Object.assign(
          new Error(`unknown tool result in harness session: ${toolResult.toolUseId}`),
          { status: 409 },
        );
      }
      sessions.add(session);
    }
    if (sessions.size !== 1) {
      throw Object.assign(new Error("tool results span multiple harness sessions"), {
        status: 409,
      });
    }

    const session = sessions.values().next().value;
    if (credentialFingerprint(apiKey) !== session.credentialFingerprint) {
      throw Object.assign(new Error("credential changed while resuming harness session"), {
        status: 409,
      });
    }
    if (tenantFingerprint(options.tenantId) !== session.tenantFingerprint) {
      throw Object.assign(new Error("tenant changed while resuming harness session"), {
        status: 409,
      });
    }
    const requestModel = String(body?.model || "").trim();
    if (requestModel && requestModel !== session.model) {
      throw Object.assign(new Error("model changed while resuming harness session"), {
        status: 409,
      });
    }

    const requestDigest = toolResultRequestDigest(toolResults);
    this.sessionState?.touch(session.sessionId, Date.now() + this.sessionTtlMs);
    const cached = session.replay.get(requestDigest);
    if (cached) return cached;
    if (!session.closed && signal) {
      this.#bindAbort(session, signal);
      if (signal.aborted) {
        const error = Object.assign(new Error("cursor harness client disconnected"), {
          status: 499,
        });
        await this.#closeSession(session, error);
        throw error;
      }
    }
    const inflight = session.inflightReplay.get(requestDigest);
    if (inflight) return inflight;

    const onTextDelta =
      typeof options.onTextDelta === "function" ? options.onTextDelta : null;
    const onThinkingDelta =
      typeof options.onThinkingDelta === "function"
        ? options.onThinkingDelta
        : null;
    session.onTextDelta = onTextDelta;
    session.onThinkingDelta = onThinkingDelta;
    const resumePromise = this.#resumeOnce(session, toolResults, requestDigest);
    session.inflightReplay.set(requestDigest, resumePromise);
    try {
      return await resumePromise;
    } finally {
      if (session.onTextDelta === onTextDelta) session.onTextDelta = null;
      if (session.onThinkingDelta === onThinkingDelta) {
        session.onThinkingDelta = null;
      }
      session.inflightReplay.delete(requestDigest);
    }
  }

  #newSession(model, fingerprint, options = {}, sessionId = randomUUID()) {
    return {
      sessionId,
      agent: null,
      run: null,
      model,
      credentialFingerprint: fingerprint,
      tenantFingerprint: tenantFingerprint(options.tenantId),
      lastActivityAt: Date.now(),
      pending: new Map(),
      awaitingToolUseIds: new Set(),
      toolCallQueue: [],
      toolCallWaiters: [],
      replay: new Map(),
      inflightReplay: new Map(),
      turnMessageId: newAnthropicMessageId(),
      finalText: "",
      sawAssistantText: false,
      sawTextDelta: false,
      usage: null,
      runError: null,
      onTextDelta:
        typeof options.onTextDelta === "function" ? options.onTextDelta : null,
      onThinkingDelta:
        typeof options.onThinkingDelta === "function" ? options.onThinkingDelta : null,
      firstSemanticEvent: deferred(),
      firstSemanticEventSeen: false,
      done: deferred(),
      closeSignal: deferred(),
      closed: false,
      retainedForReplay: false,
      preserveStateOnAbort: false,
      usesSdkStore: false,
    };
  }

  #customTools(session, tools) {
    return customToolsFromAnthropic(tools, (name, args, context) => {
      if (session.closed) throw new Error("cursor harness session is closed");
      const toolUseId = this.instanceId
        ? routedToolUseId(this.instanceId)
        : String(context.toolCallId || randomUUID());
      if (session.pending.has(toolUseId) || this.sessionsByToolUseId.has(toolUseId)) {
        throw new Error(`duplicate cursor harness tool call id: ${toolUseId}`);
      }
      const result = deferred();
      const pending = {
        toolUseId,
        name,
        args,
        result,
        settled: false,
        resultDigest: "",
      };
      session.pending.set(toolUseId, pending);
      this.sessionsByToolUseId.set(toolUseId, session);
      session.lastActivityAt = Date.now();
      this.#markFirstSemanticEvent(session);
      const waiter = session.toolCallWaiters.shift();
      if (waiter) waiter.resolve(pending);
      else session.toolCallQueue.push(pending);
      return result.promise;
    });
  }

  async #resumePersisted(record, toolResults, body, apiKey, options) {
    const fingerprint = credentialFingerprint(apiKey);
    if (fingerprint !== record.credentialFingerprint) {
      throw Object.assign(new Error("credential changed while recovering harness session"), {
        status: 409,
      });
    }
    if (
      record.tenantFingerprint &&
      tenantFingerprint(options.tenantId) !== record.tenantFingerprint
    ) {
      throw Object.assign(new Error("tenant changed while recovering harness session"), {
        status: 409,
      });
    }
    const requestModel = String(body?.model || "").trim();
    if (requestModel && requestModel !== record.model) {
      throw Object.assign(new Error("model changed while recovering harness session"), {
        status: 409,
      });
    }
    const requestedIds = toolResults.map((result) => result.toolUseId).sort();
    const persistedIds = [...record.toolUseIds].sort();
    if (JSON.stringify(requestedIds) !== JSON.stringify(persistedIds)) {
      throw Object.assign(new Error("tool results must exactly match persisted harness batch"), {
        status: 409,
      });
    }
    const requestDigest = toolResultRequestDigest(toolResults);
    if (record.kind === "replay") {
      if (record.requestDigest !== requestDigest) {
        throw Object.assign(new Error("conflicting duplicate persisted tool result"), {
          status: 409,
        });
      }
      return record.response;
    }
    if (!this.sdkStore || !record.agentId) {
      throw Object.assign(new Error("cursor harness recovery store is unavailable"), {
        status: 409,
      });
    }
    if (!Array.isArray(body?.tools) || body.tools.length === 0) {
      throw Object.assign(new Error("cursor harness recovery requires the request tool catalog"), {
        status: 409,
      });
    }

    const session = this.#newSession(record.model, fingerprint, options, record.sessionId);
    session.preserveStateOnAbort = true;
    session.usesSdkStore = true;
    this.sessionState.pin(record.sessionId);
    this.sessionState.touch(record.sessionId, Date.now() + this.sessionTtlMs);
    this.sessions.add(session);
    if (options.signal) {
      this.#bindAbort(session, options.signal);
      if (options.signal.aborted) {
        const error = Object.assign(new Error("cursor harness client disconnected"), {
          status: 499,
        });
        await this.#closeSession(session, error, { preserveState: true });
        throw error;
      }
    }
    const customTools = this.#customTools(session, body.tools);
    try {
      session.agent = await this.agentResumer(record.agentId, {
        apiKey,
        model: cursorSdkModelSelection(record.model, body),
        tools: ["mcp"],
        disallowedTools: ["shell", "read", "edit", "task", "webSearch", "webFetch"],
        local: {
          cwd: this.workspace,
          settingSources: [],
          store: this.sdkStore,
          sandboxOptions: { enabled: false },
          customTools,
        },
      });
      session.run = await session.agent.send(recoveredToolResultPrompt(record, toolResults), {
        onDelta: ({ update }) => this.#handleInteractionUpdate(session, update),
        local: { force: true, customTools },
      });
      this.#drainRun(session);
      await withTimeout(
        Promise.race([
          session.firstSemanticEvent.promise,
          session.closeSignal.promise.then((error) => Promise.reject(error)),
        ]),
        this.firstEventTimeoutMs,
        "cursor harness recovery timed out before a response event",
      );
      const next = await withTimeout(
        this.#nextToolBatchOrDone(session),
        this.sessionTtlMs,
        "cursor harness recovery timed out after tool result",
      );
      let response;
      if (next.kind === "tools") {
        response = this.#toolUseMessage(session, next.pending);
        this.#armExpiry(session);
      } else {
        response = this.#finalMessage(session);
        this.#persistReplay(session, toolResults, requestDigest, response);
        await this.#closeSession(session, null, { retainReplay: true });
      }
      session.replay.set(requestDigest, response);
      return response;
    } catch (error) {
      // A transient SDK/network failure must not destroy the only persisted
      // continuation handle. The journal TTL remains the fail-closed bound.
      await this.#closeSession(session, error, { preserveState: true });
      throw Object.assign(error, { status: error?.status || 502 });
    }
  }

  #resumePersistedSingleflight(record, toolResults, body, apiKey, options) {
    const fingerprint = credentialFingerprint(apiKey);
    if (fingerprint !== record.credentialFingerprint) {
      throw Object.assign(new Error("credential changed while recovering harness session"), {
        status: 409,
      });
    }
    if (
      record.tenantFingerprint &&
      tenantFingerprint(options.tenantId) !== record.tenantFingerprint
    ) {
      throw Object.assign(new Error("tenant changed while recovering harness session"), {
        status: 409,
      });
    }
    const requestModel = String(body?.model || "").trim();
    if (requestModel && requestModel !== record.model) {
      throw Object.assign(new Error("model changed while recovering harness session"), {
        status: 409,
      });
    }
    const requestedIds = toolResults.map((result) => result.toolUseId).sort();
    const persistedIds = [...record.toolUseIds].sort();
    if (JSON.stringify(requestedIds) !== JSON.stringify(persistedIds)) {
      throw Object.assign(new Error("tool results must exactly match persisted harness batch"), {
        status: 409,
      });
    }
    const requestDigest = toolResultRequestDigest(toolResults);
    const inflight = this.persistedRecoveries.get(record.sessionId);
    if (inflight) {
      if (inflight.requestDigest !== requestDigest) {
        throw Object.assign(new Error("conflicting concurrent persisted tool result"), {
          status: 409,
        });
      }
      return inflight.promise;
    }
    const promise = this.#resumePersisted(record, toolResults, body, apiKey, options);
    const entry = { requestDigest, promise };
    this.persistedRecoveries.set(record.sessionId, entry);
    void promise.finally(() => {
      if (this.persistedRecoveries.get(record.sessionId) === entry) {
        this.persistedRecoveries.delete(record.sessionId);
      }
    }).catch(() => {});
    return promise;
  }

  #bindAbort(session, signal) {
    if (session.abortListener) {
      session.abortSignal?.removeEventListener?.("abort", session.abortListener);
    }
    session.abortSignal = signal;
    session.abortListener = () => {
      void this.#closeSession(
        session,
        Object.assign(new Error("cursor harness client disconnected"), { status: 499 }),
        { preserveState: session.preserveStateOnAbort },
      );
    };
    signal.addEventListener("abort", session.abortListener, { once: true });
  }

  async #resumeOnce(session, toolResults, requestDigest) {
    session.lastActivityAt = Date.now();
    const resultIds = toolResults.map((result) => result.toolUseId);
    const uniqueResultIds = new Set(resultIds);
    if (
      !session.closed &&
      (resultIds.length !== uniqueResultIds.size ||
        uniqueResultIds.size !== session.awaitingToolUseIds.size ||
        [...uniqueResultIds].some((id) => !session.awaitingToolUseIds.has(id)))
    ) {
      throw Object.assign(
        new Error("tool results must exactly match the current harness tool batch"),
        { status: 409 },
      );
    }
    let submittedNewResult = false;
    for (const toolResult of toolResults) {
      const pending = session.pending.get(toolResult.toolUseId);
      const digest = toolResultDigest(toolResult);
      if (pending.settled) {
        if (pending.resultDigest !== digest) {
          throw Object.assign(
            new Error(`conflicting duplicate tool result: ${toolResult.toolUseId}`),
            { status: 409 },
          );
        }
        continue;
      }
      pending.settled = true;
      pending.resultDigest = digest;
      submittedNewResult = true;
      pending.result.resolve({
        content: [{ type: "text", text: toolResult.content }],
        isError: toolResult.isError,
      });
    }
    session.awaitingToolUseIds.clear();

    if (!submittedNewResult) {
      throw Object.assign(new Error("stale tool result retry has no cached response"), {
        status: 409,
      });
    }

    let next;
    try {
      next = await withTimeout(
        this.#nextToolBatchOrDone(session),
        this.sessionTtlMs,
        "cursor harness timed out after tool result",
      );
    } catch (error) {
      await this.#closeSession(session, error);
      throw Object.assign(error, { status: error?.status || 504 });
    }

    let response;
    try {
      if (next.kind === "tools") {
        response = this.#toolUseMessage(session, next.pending);
        this.#armExpiry(session);
      } else {
        response = this.#finalMessage(session);
        this.#persistReplay(session, toolResults, requestDigest, response);
        await this.#closeSession(session, null, { retainReplay: true });
      }
    } catch (error) {
      await this.#closeSession(session, error);
      throw error;
    }
    session.replay.set(requestDigest, response);
    return response;
  }

  #toolUseMessage(session, pendingCalls) {
    session.awaitingToolUseIds = new Set(pendingCalls.map((pending) => pending.toolUseId));
    const turnText = session.finalText;
    session.finalText = "";
    const response = anthropicMessage({
      id: session.turnMessageId,
      model: session.model,
      content: [
        ...(turnText.trim() ? [{ type: "text", text: turnText }] : []),
        ...pendingCalls.map((pending) => ({
          type: "tool_use",
          id: pending.toolUseId,
          name: pending.name,
          input: pending.args,
        })),
      ],
      stopReason: "tool_use",
      usage: session.usage,
    });
    session.turnMessageId = newAnthropicMessageId();
    this.#persistAwaiting(session, pendingCalls);
    return response;
  }

  #persistAwaiting(session, pendingCalls) {
    if (!this.sessionState) return;
    this.sessionState.upsert({
      kind: "awaiting",
      sessionId: session.sessionId,
      instanceId: this.instanceId,
      model: session.model,
      credentialFingerprint: session.credentialFingerprint,
      tenantFingerprint: session.tenantFingerprint,
      agentId: session.agent?.agentId,
      runId: session.run?.id,
      toolUseIds: pendingCalls.map((pending) => pending.toolUseId),
      pending: pendingCalls.map((pending) => ({
        toolUseId: pending.toolUseId,
        name: pending.name,
      })),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.sessionTtlMs,
    });
    this.sessionState.pin(session.sessionId);
  }

  #persistReplay(session, toolResults, requestDigest, response) {
    if (!this.sessionState) return;
    this.sessionState.upsert({
      kind: "replay",
      sessionId: session.sessionId,
      instanceId: this.instanceId,
      model: session.model,
      credentialFingerprint: session.credentialFingerprint,
      tenantFingerprint: session.tenantFingerprint,
      agentId: session.agent?.agentId,
      runId: session.run?.id,
      toolUseIds: toolResults.map((result) => result.toolUseId),
      pending: toolResults.map((result) => ({ toolUseId: result.toolUseId })),
      requestDigest,
      response,
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.replayTtlMs,
    });
  }

  #finalMessage(session) {
    if (session.runError) {
      throw Object.assign(new Error(session.runError), { status: 502 });
    }
    if (!session.finalText.trim()) {
      throw Object.assign(new Error("cursor harness returned an empty final turn"), {
        status: 502,
      });
    }
    return anthropicMessage({
      id: session.turnMessageId,
      model: session.model,
      content: [{ type: "text", text: session.finalText }],
      stopReason: "end_turn",
      usage: session.usage,
    });
  }

  async #nextToolBatchOrDone(session) {
    const queued = session.toolCallQueue.shift();
    if (queued) return this.#collectToolBatch(session, queued);
    if (session.doneSettled) return { kind: "done" };
    const waiter = deferred();
    session.toolCallWaiters.push(waiter);
    const first = await Promise.race([
      waiter.promise.then((pending) => ({ kind: "first-tool", pending })),
      session.done.promise.then(() => ({ kind: "done" })),
      session.closeSignal.promise.then((error) => Promise.reject(error)),
    ]).finally(() => {
      const index = session.toolCallWaiters.indexOf(waiter);
      if (index >= 0) session.toolCallWaiters.splice(index, 1);
    });
    if (first.kind === "done") return first;
    return this.#collectToolBatch(session, first.pending);
  }

  async #collectToolBatch(session, first) {
    if (this.parallelCollectMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.parallelCollectMs));
    }
    if (session.closed) {
      throw Object.assign(new Error("cursor harness session closed"), { status: 499 });
    }
    return {
      kind: "tools",
      pending: [first, ...session.toolCallQueue.splice(0)],
    };
  }

  async #drainRun(session) {
    try {
      for await (const event of session.run.stream()) {
        session.lastActivityAt = Date.now();
        if (event?.type === "assistant") {
          const text = (event.message?.content || [])
            .filter((block) => block?.type === "text")
            .map((block) => block.text || "")
            .join("");
          // `onDelta` is the Cursor SDK's token-level stream. The legacy
          // assistant event can contain the same text again as a completed
          // compatibility frame, so only use it when no text delta arrived.
          if (text && !session.sawTextDelta) {
            session.sawAssistantText = true;
            session.finalText += text;
            this.#markFirstSemanticEvent(session);
            session.onTextDelta?.(text, {
              id: session.turnMessageId,
              model: session.model,
            });
          }
        } else if (event?.type === "usage") {
          session.usage = event.usage;
        } else if (event?.type === "status" && event.status === "ERROR") {
          session.runError = event.message || "cursor harness run failed";
        }
      }
      const waited = await session.run.wait();
      if (waited?.usage) session.usage = waited.usage;
      if (waited?.status === "error") {
        session.runError = waited.error?.message || "cursor harness run failed";
      }
      if (
        !session.sawAssistantText &&
        !session.finalText.trim() &&
        typeof waited?.result === "string"
      ) {
        session.finalText = waited.result;
      }
    } catch (error) {
      session.runError = error?.message || String(error);
    } finally {
      this.#markFirstSemanticEvent(session);
      session.doneSettled = true;
      session.done.resolve();
    }
  }

  #handleInteractionUpdate(session, update) {
    if (session.closed) return;
    if (update?.type === "thinking-delta") {
      const thinking = String(update.text || "");
      if (!thinking) return;
      session.lastActivityAt = Date.now();
      this.#markFirstSemanticEvent(session);
      session.onThinkingDelta?.(thinking, {
        id: session.turnMessageId,
        model: session.model,
      });
      return;
    }
    if (update?.type !== "text-delta") return;
    const text = String(update.text || "");
    if (!text) return;
    session.sawTextDelta = true;
    session.sawAssistantText = true;
    session.finalText += text;
    session.lastActivityAt = Date.now();
    this.#markFirstSemanticEvent(session);
    session.onTextDelta?.(text, {
      id: session.turnMessageId,
      model: session.model,
    });
  }

  #markFirstSemanticEvent(session) {
    if (session.firstSemanticEventSeen) return;
    session.firstSemanticEventSeen = true;
    session.firstSemanticEvent.resolve();
  }

  #armExpiry(session) {
    clearTimeout(session.expiryTimer);
    session.expiryTimer = setTimeout(async () => {
      const idleMs = Date.now() - session.lastActivityAt;
      if (idleMs < this.sessionTtlMs) {
        this.#armExpiry(session);
        return;
      }
      await this.#closeSession(session, new Error("cursor harness session expired"));
    }, this.sessionTtlMs);
    session.expiryTimer.unref?.();
  }

  async #closeSession(session, error, options = {}) {
    if (session.closed) {
      if (session.retainedForReplay && !options.retainReplay) this.#forgetSession(session);
      return;
    }
    session.closed = true;
    if (error) session.runError = error?.message || String(error);
    session.closeSignal.resolve(error || new Error("cursor harness session closed"));
    if (session.abortListener) {
      session.abortSignal?.removeEventListener?.("abort", session.abortListener);
    }
    clearTimeout(session.expiryTimer);
    for (const waiter of session.toolCallWaiters.splice(0)) {
      waiter.reject(error || new Error("cursor harness session closed"));
    }
    for (const pending of session.pending.values()) {
      if (!options.retainReplay) this.sessionsByToolUseId.delete(pending.toolUseId);
      if (!pending.settled) {
        pending.settled = true;
        pending.result.reject(error || new Error("cursor harness session closed"));
      }
    }
    try {
      if (session.run?.status === "running") await session.run.cancel();
    } catch {
      // Best effort; agent.close below releases local resources.
    }
    try {
      session.agent?.close?.();
    } catch {
      // Best effort.
    }
    if (options.retainReplay) {
      this.sessionState?.unpin(session.sessionId);
      session.retainedForReplay = true;
      session.replayTimer = setTimeout(() => {
        this.sessionState?.remove(session.sessionId);
        this.#forgetSession(session);
        void deleteSdkAgentState(
          session.usesSdkStore ? this.sdkStore : undefined,
          session.agent?.agentId,
        ).catch((cleanupError) => {
          console.error(
            `[cursor-harness] failed to clean replay agent state session=${session.sessionId}: ${cleanupError?.message || cleanupError}`,
          );
        });
      }, this.replayTtlMs);
      session.replayTimer.unref?.();
    } else {
      try {
        if (!options.preserveState) {
          this.sessionState?.remove(session.sessionId);
          await deleteSdkAgentState(
            session.usesSdkStore ? this.sdkStore : undefined,
            session.agent?.agentId,
          );
        }
      } catch (cleanupError) {
        console.error(
          `[cursor-harness] failed to clean agent state session=${session.sessionId}: ${cleanupError?.message || cleanupError}`,
        );
      } finally {
        this.#forgetSession(session);
      }
    }
  }

  #forgetSession(session) {
    this.sessionState?.unpin(session.sessionId);
    clearTimeout(session.replayTimer);
    for (const pending of session.pending.values()) {
      this.sessionsByToolUseId.delete(pending.toolUseId);
    }
    this.sessions.delete(session);
  }

  async shutdown(options = {}) {
    await Promise.allSettled(
      [...this.sessions].map((session) =>
        this.#closeSession(session, new Error("cursor harness sidecar shutting down"), {
          preserveState: Boolean(options.preserveState),
        }),
      ),
    );
  }

  beginDrain() {
    this.accepting = false;
    return this.status();
  }

  status() {
    const liveIds = new Set([...this.sessions].map((session) => session.sessionId));
    const persistedIds = new Set(this.sessionState?.sessionIds?.() || []);
    return {
      accepting: this.accepting,
      liveSessions: liveIds.size,
      persistedSessions: persistedIds.size,
      drainSessions: new Set([...liveIds, ...persistedIds]).size,
      persisted: this.sessionState?.counts?.() || { awaiting: 0, replay: 0, total: 0 },
    };
  }

  async waitForDrain(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (this.status().drainSessions > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return this.status().drainSessions === 0;
  }
}
