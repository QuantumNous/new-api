import {
  runBridge,
  type BridgeEvent,
  type BridgeTurn,
} from '@ai-sdk/harness/bridge';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { argv, env as procEnv } from 'node:process';
import type { StartMessage } from '../opencode-bridge-protocol';

import {
  createOpencodeClient,
  createOpencodeServer,
} from '@opencode-ai/sdk/v2';
import {
  emitMissingFinalDelta,
  getOpenCodeEventSessionId,
  isStepSettlementEvent,
  type OpenCodeEvent,
  unwrapOpenCodeEvent,
} from './opencode-events';
import { prependOpenCodeBinToPath } from './opencode-path';
import {
  addUsage,
  defaultUsage,
  extractSessionTokens,
  mapUsage,
  subtractSessionTokens,
  type HarnessUsage,
  type OpenCodeTokenUsage,
} from './opencode-usage';
import {
  ToolRelayAuthorizer,
  isToolRelayRequestFromAllowedProcess,
  type ToolRelayCall,
} from './tool-relay-auth';

type Emit = (msg: Record<string, unknown>) => void;

type OpenCodeClient = ReturnType<typeof createOpencodeClient>;
type OpenCodeServer = Awaited<ReturnType<typeof createOpencodeServer>>;
type ToolRelay = {
  port: number;
  close(): void;
  authorizeToolCall(call: ToolRelayCall): void;
};

type RuntimeState = {
  server?: OpenCodeServer;
  client?: OpenCodeClient;
  sessionId?: string;
  relay?: ToolRelay;
  toolNames: Set<string>;
};

type CommonBuiltinToolName =
  | 'read'
  | 'write'
  | 'edit'
  | 'bash'
  | 'glob'
  | 'grep';

const NATIVE_TO_COMMON: Readonly<Record<string, CommonBuiltinToolName>> = {
  view: 'read',
  read: 'read',
  write: 'write',
  edit: 'edit',
  bash: 'bash',
  glob: 'glob',
  grep: 'grep',
};

const OPENCODE_TO_WIRE: Readonly<Record<string, string>> = {
  list: 'ls',
  ls: 'ls',
  webfetch: 'webfetch',
  task: 'agent',
  agent: 'agent',
  subtask: 'agent',
};

const PUBLIC_TO_NATIVE: Readonly<Record<string, string>> = {
  read: 'view',
  write: 'write',
  edit: 'edit',
  bash: 'bash',
  glob: 'glob',
  grep: 'grep',
  ls: 'list',
  webfetch: 'webfetch',
  skill: 'skill',
  todowrite: 'todowrite',
  agent: 'agent',
};

const TOOL_KIND: Readonly<Record<string, 'readonly' | 'edit' | 'bash'>> = {
  read: 'readonly',
  glob: 'readonly',
  grep: 'readonly',
  ls: 'readonly',
  webfetch: 'readonly',
  write: 'edit',
  edit: 'edit',
  bash: 'bash',
  agent: 'bash',
  skill: 'edit',
  todowrite: 'edit',
};

const args = parseArgs(argv.slice(2));
const workdir = args.workdir ?? emitFatal('Missing --workdir argument.');
const bridgeStateDir =
  args.bridgeStateDir ?? emitFatal('Missing --bridge-state-dir argument.');
const bootstrapDir = args.bootstrapDir ?? workdir;
const skillsDir = args.skillsDir;
const runtime: RuntimeState = { toolNames: new Set() };
prependOpenCodeBinToPath({ bootstrapDir, env: procEnv });

mkdirSync(process.env.HOME ?? '/tmp/opencode-home', { recursive: true });

await runBridge<StartMessage>({
  bridgeType: 'opencode',
  bridgeStateDir,
  onStart: runTurn,
  onDetach: () =>
    runtime.sessionId ? { openCodeSessionId: runtime.sessionId } : {},
});

async function runTurn(start: StartMessage, turn: BridgeTurn): Promise<void> {
  const emit: Emit = msg => turn.emit(msg as BridgeEvent);
  let totalUsage: HarnessUsage | undefined;
  try {
    await ensureRuntime({ start, turn, emit });
    const client = runtime.client!;
    const sessionId = await ensureSession({ client, start, emit });

    if (start.operation === 'compact') {
      await runCompaction({ client, sessionId, start, turn, emit });
    } else {
      totalUsage = await runPrompt({ client, sessionId, start, turn, emit });
    }
  } catch (err) {
    emit({ type: 'error', error: serialiseError(err) });
  } finally {
    emit({
      type: 'finish',
      finishReason: { unified: 'stop', raw: 'stop' },
      totalUsage: totalUsage ?? defaultUsage(),
    });
  }
}

async function ensureRuntime({
  start,
  turn,
  emit,
}: {
  start: StartMessage;
  turn: BridgeTurn;
  emit: Emit;
}): Promise<void> {
  if (runtime.client) return;

  if (start.tools && start.tools.length > 0) {
    runtime.toolNames = new Set(start.tools.map(tool => tool.name));
    runtime.relay = await startToolRelay({
      allowedScriptPaths: [`${bootstrapDir}/host-tool-mcp.mjs`],
      tools: start.tools,
      emit,
      requestToolResult: turn.requestToolResult,
    });
  }

  const server = await createOpencodeServer({
    hostname: '127.0.0.1',
    port: 0,
    timeout: 30_000,
    config: buildOpenCodeConfig({
      start,
      relayPort: runtime.relay?.port,
    }) as never,
  });
  runtime.server = server;
  runtime.client = createOpencodeClient({
    baseUrl: server.url,
    directory: workdir,
  });
}

function buildOpenCodeConfig({
  start,
  relayPort,
}: {
  start: StartMessage;
  relayPort: number | undefined;
}): Record<string, unknown> {
  const config: Record<string, unknown> = {
    share: 'disabled',
    autoupdate: false,
    permission: {
      read: 'allow',
      glob: 'allow',
      grep: 'allow',
      list: 'allow',
      edit: 'ask',
      bash: 'ask',
      external_directory: 'ask',
      webfetch: 'ask',
      doom_loop: 'ask',
      task: 'ask',
    },
  };
  if (start.model) config.model = start.model;
  if (skillsDir) config.skills = { paths: [skillsDir] };
  const inactiveToolNames = resolveInactiveBuiltinToolNames(start);
  const permission = config.permission as Record<string, unknown>;
  for (const toolName of inactiveToolNames) {
    const permissionName = toPermissionToolName(
      PUBLIC_TO_NATIVE[toolName] ?? toolName,
    );
    if (permissionName === 'ls') {
      permission.list = 'ask';
    } else {
      permission[permissionName] = 'ask';
    }
  }
  const provider = buildProviderConfig(start);
  if (provider) config.provider = provider;
  if (relayPort && start.tools && start.tools.length > 0) {
    config.mcp = {
      'harness-tools': {
        type: 'local',
        enabled: true,
        command: ['node', `${bootstrapDir}/host-tool-mcp.mjs`],
        environment: {
          TOOL_SCHEMAS: JSON.stringify(
            start.tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          ),
          TOOL_RELAY_URL: `http://127.0.0.1:${relayPort}`,
        },
      },
    };
  }
  return config;
}

function buildProviderConfig(
  start: StartMessage,
): Record<string, unknown> | undefined {
  const model = splitModel(start.model, start.provider);
  const providerID =
    model.providerID ?? start.provider ?? procEnv.OPENAI_NAME ?? 'anthropic';
  const modelID = model.modelID;

  if (procEnv.AI_GATEWAY_API_KEY && procEnv.AI_GATEWAY_BASE_URL) {
    return {
      [providerID]: {
        options: {
          apiKey: procEnv.AI_GATEWAY_API_KEY,
          baseURL: toOpenCodeGatewayBaseUrl(procEnv.AI_GATEWAY_BASE_URL),
        },
        ...(modelID
          ? {
              models: {
                [modelID]: { id: modelID, name: modelID },
              },
            }
          : {}),
      },
    };
  }

  if (
    (procEnv.OPENAI_NAME ||
      (providerID !== 'anthropic' && providerID !== 'openai')) &&
    (procEnv.OPENAI_API_KEY || procEnv.OPENAI_BASE_URL)
  ) {
    const openAICompatibleProviderID = procEnv.OPENAI_NAME ?? providerID;
    return {
      [openAICompatibleProviderID]: {
        options: {
          ...(procEnv.OPENAI_API_KEY ? { apiKey: procEnv.OPENAI_API_KEY } : {}),
          ...(procEnv.OPENAI_BASE_URL
            ? { baseURL: procEnv.OPENAI_BASE_URL }
            : {}),
          ...parseOpenAIQueryParams(),
        },
        ...(modelID
          ? {
              models: {
                [modelID]: { id: modelID, name: modelID },
              },
            }
          : {}),
      },
    };
  }

  if (
    providerID === 'anthropic' &&
    (procEnv.ANTHROPIC_API_KEY ||
      procEnv.ANTHROPIC_AUTH_TOKEN ||
      procEnv.ANTHROPIC_BASE_URL)
  ) {
    return {
      anthropic: {
        options: {
          ...(procEnv.ANTHROPIC_API_KEY
            ? { apiKey: procEnv.ANTHROPIC_API_KEY }
            : {}),
          ...(procEnv.ANTHROPIC_AUTH_TOKEN
            ? { authToken: procEnv.ANTHROPIC_AUTH_TOKEN }
            : {}),
          ...(procEnv.ANTHROPIC_BASE_URL
            ? { baseURL: procEnv.ANTHROPIC_BASE_URL }
            : {}),
        },
      },
    };
  }

  if (
    providerID === 'openai' &&
    (procEnv.OPENAI_API_KEY || procEnv.OPENAI_BASE_URL)
  ) {
    return {
      openai: {
        options: {
          ...(procEnv.OPENAI_API_KEY ? { apiKey: procEnv.OPENAI_API_KEY } : {}),
          ...(procEnv.OPENAI_BASE_URL
            ? { baseURL: procEnv.OPENAI_BASE_URL }
            : {}),
          ...(procEnv.OPENAI_ORGANIZATION
            ? { organization: procEnv.OPENAI_ORGANIZATION }
            : {}),
          ...(procEnv.OPENAI_PROJECT
            ? { project: procEnv.OPENAI_PROJECT }
            : {}),
          ...parseOpenAIQueryParams(),
        },
      },
    };
  }

  return undefined;
}

function parseOpenAIQueryParams(): Record<string, unknown> {
  if (!procEnv.OPENAI_QUERY_PARAMS_JSON) return {};
  try {
    const parsed = JSON.parse(procEnv.OPENAI_QUERY_PARAMS_JSON);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { queryParams: parsed };
    }
  } catch {}
  return {};
}

function toOpenCodeGatewayBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

async function legacySessionGet({
  client,
  sessionId,
}: {
  client: OpenCodeClient;
  sessionId: string;
}): Promise<{ error?: unknown; data?: unknown }> {
  const session = (client as any).session;
  if (!session?.get) return client.v2.session.get({ sessionID: sessionId });
  return session.get({ sessionID: sessionId });
}

async function legacySessionCreate({
  client,
}: {
  client: OpenCodeClient;
}): Promise<{ error?: unknown; data?: unknown }> {
  return (client as any).session.create({});
}

async function legacySessionPrompt({
  client,
  sessionId,
  start,
}: {
  client: OpenCodeClient;
  sessionId: string;
  start: StartMessage;
}): Promise<{ error?: unknown; data?: unknown }> {
  return (client as any).session.prompt({
    sessionID: sessionId,
    ...(start.instructions ? { system: start.instructions } : {}),
    ...(start.variant ? { variant: start.variant } : {}),
    parts: [{ type: 'text', text: start.prompt }],
  });
}

async function legacySessionSummarize({
  client,
  sessionId,
  model,
}: {
  client: OpenCodeClient;
  sessionId: string;
  model: OpenCodeModelRef;
}): Promise<{ error?: unknown; data?: unknown }> {
  return (client as any).session.summarize({
    sessionID: sessionId,
    auto: false,
    providerID: model.providerID,
    modelID: model.modelID,
  });
}

async function subscribeLegacyEvents({
  client,
  signal,
}: {
  client: OpenCodeClient;
  signal: AbortSignal;
}): Promise<AsyncIterable<unknown> | null> {
  const subscribed = await (client as any).event.subscribe(undefined, {
    signal,
    sseMaxRetryAttempts: 0,
  });
  return getEventStream(subscribed);
}

function readSessionId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as { id?: unknown; data?: { id?: unknown } };
  if (typeof record.id === 'string') return record.id;
  if (typeof record.data?.id === 'string') return record.data.id;
  return undefined;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === 'object' && value !== null && Symbol.asyncIterator in value
  );
}

function getEventStream(source: unknown): AsyncIterable<unknown> | null {
  if (!source || typeof source !== 'object') return null;
  const candidate = source as { stream?: unknown; data?: unknown };
  if (isAsyncIterable(candidate.stream)) return candidate.stream;
  if (isAsyncIterable(candidate.data)) return candidate.data;
  return null;
}

function legacyStatusType(event: OpenCodeEvent): string | undefined {
  const status = event.properties?.status;
  return status && typeof status === 'object'
    ? String((status as { type?: unknown }).type ?? '')
    : undefined;
}

function legacyStatusMessage(event: OpenCodeEvent): string | undefined {
  const status = event.properties?.status;
  if (!status || typeof status !== 'object') return undefined;
  const message = (status as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

async function ensureSession({
  client,
  start,
  emit,
}: {
  client: OpenCodeClient;
  start: StartMessage;
  emit: Emit;
}): Promise<string> {
  if (runtime.sessionId) return runtime.sessionId;
  if (start.resumeSessionId) {
    const existing = await legacySessionGet({
      client,
      sessionId: start.resumeSessionId,
    }).catch(() => undefined);
    if (existing && !existing.error) {
      runtime.sessionId = start.resumeSessionId;
      emit({ type: 'bridge-thread', threadId: runtime.sessionId });
      return runtime.sessionId;
    }
  }
  const created = await legacySessionCreate({ client });
  if (created.error) {
    throw new Error(
      `OpenCode session create failed: ${formatError(created.error)}`,
    );
  }
  const id = readSessionId(created.data);
  if (!id) throw new Error('OpenCode session create returned no id.');
  runtime.sessionId = id;
  emit({ type: 'bridge-thread', threadId: id });
  return id;
}

async function runPrompt({
  client,
  sessionId,
  start,
  turn,
  emit,
}: {
  client: OpenCodeClient;
  sessionId: string;
  start: StartMessage;
  turn: BridgeTurn;
  emit: Emit;
}): Promise<HarnessUsage | undefined> {
  const eventsAbort = new AbortController();
  const turnSettled = createDeferred<void>();
  let sawContent = false;
  let sawFinishStep = false;
  let sawBusy = false;
  let terminalError: string | undefined;
  const initialSessionTokens = await readSessionTokens({
    client,
    sessionId,
  }).catch(() => undefined);
  let stepUsage: HarnessUsage | undefined;
  let latestSessionTokens: OpenCodeTokenUsage | undefined;
  const eventLoop = consumeEvents({
    client,
    sessionId,
    permissionMode: start.permissionMode,
    builtinToolFiltering: start.builtinToolFiltering,
    turn,
    emit: msg => {
      if (msg.type === 'text-delta' || msg.type === 'reasoning-delta') {
        sawContent = true;
      }
      if (msg.type === 'finish-step') {
        sawFinishStep = true;
        stepUsage = addUsage({
          left: stepUsage,
          right: msg.usage as HarnessUsage,
        });
      }
      emit(msg);
    },
    signal: eventsAbort.signal,
    onEvent: event => {
      if (event.type === 'session.updated') {
        latestSessionTokens =
          extractSessionTokens(event.properties) ?? latestSessionTokens;
      }
      if (isStepSettlementEvent(event)) {
        turnSettled.resolve();
        return true;
      }
      const status = legacyStatusType(event);
      if (status === 'busy') {
        sawBusy = true;
      } else if (status === 'retry') {
        sawBusy = true;
        terminalError = legacyStatusMessage(event) ?? 'Session retry';
        turnSettled.resolve();
        return true;
      } else if (sawBusy && status === 'idle') {
        turnSettled.resolve();
        return true;
      }
      if (event.type === 'session.error') {
        terminalError = formatError(event.properties?.error ?? event);
        turnSettled.resolve();
        return true;
      }
    },
  }).finally(() => turnSettled.resolve());
  emit({
    type: 'stream-start',
    ...(start.model ? { modelId: start.model } : {}),
  });
  const prompted = await legacySessionPrompt({
    client,
    sessionId,
    start,
  });
  if (prompted.error) {
    eventsAbort.abort();
    throw new Error(`OpenCode prompt failed: ${formatError(prompted.error)}`);
  }
  await turnSettled.promise;
  eventsAbort.abort();
  await eventLoop.catch(() => {});
  if (terminalError) throw new Error(terminalError);
  if (!sawFinishStep) {
    const emittedFallback = await emitContextFallback({
      client,
      sessionId,
      emit,
      emitContent: !sawContent,
    }).catch(() => false);
    if (!emittedFallback) {
      emit({
        type: 'finish-step',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: defaultUsage(),
        harnessMetadata: { opencode: { fallback: true, missingContext: true } },
      });
    }
  }
  const finalSessionTokens =
    (await readSessionTokens({ client, sessionId }).catch(() => undefined)) ??
    latestSessionTokens;
  if (initialSessionTokens && finalSessionTokens) {
    return mapUsage(
      subtractSessionTokens({
        before: initialSessionTokens,
        after: finalSessionTokens,
      }),
    );
  }
  return stepUsage;
}

async function runCompaction({
  client,
  sessionId,
  start,
  turn,
  emit,
}: {
  client: OpenCodeClient;
  sessionId: string;
  start: StartMessage;
  turn: BridgeTurn;
  emit: Emit;
}): Promise<void> {
  const eventsAbort = new AbortController();
  const compactionSettled = createDeferred<void>();
  let sawCompaction = false;
  let sawBusy = false;
  let terminalError: string | undefined;
  const model = await resolveCompactionModel({
    client,
    sessionId,
    start,
  });
  if (!model) {
    throw new Error(
      'OpenCode compaction requires a previous turn or an explicit model.',
    );
  }
  const eventLoop = consumeEvents({
    client,
    sessionId,
    permissionMode: start.permissionMode,
    builtinToolFiltering: start.builtinToolFiltering,
    turn,
    emit: msg => {
      if (msg.type === 'compaction') sawCompaction = true;
      emit(msg);
    },
    signal: eventsAbort.signal,
    onEvent: event => {
      if (
        event.type === 'session.next.compaction.ended' ||
        event.type === 'session.compacted'
      ) {
        compactionSettled.resolve();
        return true;
      }
      const status = legacyStatusType(event);
      if (status === 'busy') {
        sawBusy = true;
      } else if (status === 'retry') {
        sawBusy = true;
        terminalError = legacyStatusMessage(event) ?? 'Session retry';
        compactionSettled.resolve();
        return true;
      } else if (sawBusy && status === 'idle') {
        compactionSettled.resolve();
        return true;
      }
      if (event.type === 'session.error') {
        terminalError = formatError(event.properties?.error ?? event);
        compactionSettled.resolve();
        return true;
      }
    },
  });
  const compacted = await legacySessionSummarize({
    client,
    sessionId,
    model,
  });
  if (compacted.error) {
    eventsAbort.abort();
    throw new Error(
      `OpenCode compaction failed: ${formatError(compacted.error)}`,
    );
  }
  await Promise.race([compactionSettled.promise, sleep(250)]);
  eventsAbort.abort();
  await eventLoop.catch(() => {});
  if (terminalError) throw new Error(terminalError);
  if (!sawCompaction) {
    emit({
      type: 'compaction',
      trigger: 'manual',
      summary: '',
      harnessMetadata: {
        opencode: { missingSummary: true },
      },
    });
  }
}

async function consumeEvents({
  client,
  sessionId,
  permissionMode,
  builtinToolFiltering,
  turn,
  emit,
  signal,
  onEvent,
}: {
  client: OpenCodeClient;
  sessionId: string;
  permissionMode: StartMessage['permissionMode'];
  builtinToolFiltering: StartMessage['builtinToolFiltering'];
  turn: BridgeTurn;
  emit: Emit;
  signal: AbortSignal;
  onEvent?: (event: OpenCodeEvent) => boolean | void;
}): Promise<void> {
  const stream = await subscribeLegacyEvents({ client, signal });
  if (!stream) return;
  const state = createTranslationState();
  for await (const rawEvent of stream) {
    if (signal.aborted || turn.abortSignal.aborted) break;
    const event = unwrapOpenCodeEvent(rawEvent);
    const eventSessionId = event ? getOpenCodeEventSessionId(event) : undefined;
    if (!event || (eventSessionId && eventSessionId !== sessionId)) continue;
    await translateAndEmit({
      event,
      state,
      sessionId,
      permissionMode,
      builtinToolFiltering,
      client,
      turn,
      emit,
    });
    if (onEvent?.(event)) break;
  }
}

type TranslationState = {
  textDeltas: Map<string, string>;
  reasoningDeltas: Map<string, string>;
  toolInputs: Map<string, string>;
  toolNames: Map<string, { rawToolName: string; toolName: string }>;
  toolCallsEmitted: Set<string>;
  toolResultsEmitted: Set<string>;
  hostToolCallsAuthorized: Set<string>;
  shellCommands: Map<string, string>;
  messageRoles: Map<string, string>;
  turnUsage: Record<string, unknown> | undefined;
  legacyTextPartIds: Set<string>;
  legacyReasoningPartIds: Set<string>;
};

function createTranslationState(): TranslationState {
  return {
    textDeltas: new Map(),
    reasoningDeltas: new Map(),
    toolInputs: new Map(),
    toolNames: new Map(),
    toolCallsEmitted: new Set(),
    toolResultsEmitted: new Set(),
    hostToolCallsAuthorized: new Set(),
    shellCommands: new Map(),
    messageRoles: new Map(),
    turnUsage: undefined,
    legacyTextPartIds: new Set(),
    legacyReasoningPartIds: new Set(),
  };
}

async function translateAndEmit({
  event,
  state,
  sessionId,
  permissionMode,
  builtinToolFiltering,
  client,
  turn,
  emit,
}: {
  event: OpenCodeEvent;
  state: TranslationState;
  sessionId: string;
  permissionMode: StartMessage['permissionMode'];
  builtinToolFiltering: StartMessage['builtinToolFiltering'];
  client: OpenCodeClient;
  turn: BridgeTurn;
  emit: Emit;
}): Promise<void> {
  const type = event.type;
  const props = event.properties ?? {};

  if (type === 'message.updated') {
    const info = props.info;
    if (isRecord(info)) {
      const id = stringValue(info.id);
      const role = stringValue(info.role);
      if (id && role) state.messageRoles.set(id, role);
    }
    return;
  }

  if (type === 'message.part.delta') {
    const field = String(props.field ?? '');
    const delta = String(props.delta ?? '');
    if (!delta) return;
    const messageID = stringValue(props.messageID);
    if (messageID && state.messageRoles.get(messageID) === 'user') return;
    if (field === 'text') {
      const id = legacyPartId({ value: props, fallback: 'legacy-text' });
      startLegacyPart({ ids: state.legacyTextPartIds, id, emit, type: 'text' });
      state.textDeltas.set(id, `${state.textDeltas.get(id) ?? ''}${delta}`);
      emit({ type: 'text-delta', id, delta });
      return;
    }
    if (field === 'reasoning') {
      const id = legacyPartId({ value: props, fallback: 'legacy-reasoning' });
      startLegacyPart({
        ids: state.legacyReasoningPartIds,
        id,
        emit,
        type: 'reasoning',
      });
      state.reasoningDeltas.set(
        id,
        `${state.reasoningDeltas.get(id) ?? ''}${delta}`,
      );
      emit({ type: 'reasoning-delta', id, delta });
    }
    return;
  }

  if (type === 'message.part.updated') {
    if (emitLegacyTextPartUpdate({ part: props.part, state, emit })) return;
    emitLegacyToolPart({ part: props.part, state, emit });
    return;
  }

  if (type === 'session.next.text.started') {
    emit({ type: 'text-start', id: String(props.textID ?? event.id) });
    return;
  }
  if (type === 'session.next.text.delta') {
    const id = String(props.textID ?? event.id);
    state.textDeltas.set(
      id,
      `${state.textDeltas.get(id) ?? ''}${String(props.delta ?? '')}`,
    );
    emit({
      type: 'text-delta',
      id,
      delta: String(props.delta ?? ''),
    });
    return;
  }
  if (type === 'session.next.text.ended') {
    const id = String(props.textID ?? event.id);
    emitMissingFinalDelta({
      id,
      fullText: typeof props.text === 'string' ? props.text : undefined,
      emittedText: state.textDeltas.get(id) ?? '',
      emit,
      type: 'text-delta',
    });
    emit({ type: 'text-end', id });
    return;
  }
  if (type === 'session.next.reasoning.started') {
    emit({
      type: 'reasoning-start',
      id: String(props.reasoningID ?? event.id),
    });
    return;
  }
  if (type === 'session.next.reasoning.delta') {
    const id = String(props.reasoningID ?? event.id);
    state.reasoningDeltas.set(
      id,
      `${state.reasoningDeltas.get(id) ?? ''}${String(props.delta ?? '')}`,
    );
    emit({
      type: 'reasoning-delta',
      id,
      delta: String(props.delta ?? ''),
    });
    return;
  }
  if (type === 'session.next.reasoning.ended') {
    const id = String(props.reasoningID ?? event.id);
    emitMissingFinalDelta({
      id,
      fullText: typeof props.text === 'string' ? props.text : undefined,
      emittedText: state.reasoningDeltas.get(id) ?? '',
      emit,
      type: 'reasoning-delta',
    });
    emit({ type: 'reasoning-end', id });
    return;
  }
  if (type === 'session.next.shell.started') {
    const callID = String(props.callID ?? event.id);
    const command = String(props.command ?? '');
    state.shellCommands.set(callID, command);
    emit({
      type: 'tool-call',
      toolCallId: callID,
      toolName: 'bash',
      nativeName: 'bash',
      input: JSON.stringify({ command }),
      providerExecuted: true,
    });
    return;
  }
  if (type === 'session.next.shell.ended') {
    const callID = String(props.callID ?? event.id);
    emit({
      type: 'tool-result',
      toolCallId: callID,
      toolName: 'bash',
      result: {
        command: state.shellCommands.get(callID) ?? '',
        output: String(props.output ?? ''),
      },
    });
    return;
  }
  if (type === 'session.next.tool.input.delta') {
    const callID = String(props.callID ?? event.id);
    state.toolInputs.set(
      callID,
      `${state.toolInputs.get(callID) ?? ''}${String(props.delta ?? '')}`,
    );
    return;
  }
  if (type === 'session.next.tool.input.ended') {
    state.toolInputs.set(
      String(props.callID ?? event.id),
      String(props.text ?? ''),
    );
    return;
  }
  if (type === 'session.next.tool.called') {
    const callID = String(props.callID ?? event.id);
    const rawToolName = String(props.tool ?? 'unknown');
    const toolName = toWireToolName(rawToolName);
    state.toolNames.set(callID, { rawToolName, toolName });
    const hostToolName = getHostToolName(toolName, props.tool);
    if (hostToolName) {
      authorizeHostToolCall({
        callID,
        toolName: hostToolName,
        input: props.input ?? parseToolInput(state, props),
        state,
      });
      return;
    }
    emit({
      type: 'tool-call',
      toolCallId: callID,
      toolName,
      ...nativeNameField({ nativeName: rawToolName, toolName }),
      input: JSON.stringify(props.input ?? parseToolInput(state, props)),
      providerExecuted: true,
      ...(props.provider?.metadata
        ? { providerMetadata: props.provider.metadata }
        : {}),
    });
    return;
  }
  if (
    type === 'session.next.tool.success' ||
    type === 'session.next.tool.failed'
  ) {
    const callID = String(props.callID ?? event.id);
    const cachedTool = state.toolNames.get(callID);
    const rawToolName =
      cachedTool?.rawToolName ??
      String((props as { tool?: unknown }).tool ?? '');
    const toolName =
      cachedTool?.toolName ?? toWireToolName(rawToolName || 'unknown');
    if (getHostToolName(toolName, rawToolName)) return;
    emit({
      type: 'tool-result',
      toolCallId: callID,
      toolName,
      result:
        props.result ??
        props.structured ??
        ('content' in props ? props.content : null) ??
        null,
      ...(type === 'session.next.tool.failed' ? { isError: true } : {}),
    });
    return;
  }
  if (type === 'session.next.step.ended') {
    closeLegacyOpenParts({ state, emit });
    state.turnUsage = mapUsage(props.tokens);
    emit({
      type: 'finish-step',
      finishReason: {
        unified: mapFinishReason(String(props.finish ?? 'stop')),
        raw: String(props.finish ?? 'stop'),
      },
      usage: state.turnUsage,
      ...(typeof props.cost === 'number'
        ? { harnessMetadata: { opencode: { cost: props.cost } } }
        : {}),
    });
    return;
  }
  if (type === 'session.next.compaction.ended') {
    emit({
      type: 'compaction',
      trigger: props.reason === 'auto' ? 'auto' : 'manual',
      summary: String(props.text ?? ''),
      harnessMetadata: {
        opencode: {
          recent: String(props.recent ?? ''),
        },
      },
    });
    return;
  }
  if (type === 'file.edited') {
    emit({
      type: 'file-change',
      event: 'modify',
      path: stripWorkDir(String(props.file ?? '')),
    });
    return;
  }
  if (type === 'session.error' || type === 'session.next.step.failed') {
    emit({ type: 'error', error: formatError(props.error ?? event) });
    return;
  }
  if (type === 'permission.v2.asked') {
    await handlePermissionV2({
      client,
      sessionId,
      permissionMode,
      builtinToolFiltering,
      turn,
      emit,
      event,
    });
    return;
  }
  if (type === 'permission.asked') {
    await handlePermission({
      client,
      sessionId,
      permissionMode,
      builtinToolFiltering,
      turn,
      emit,
      event,
    });
  }
}

function legacyPartId({
  value,
  fallback,
}: {
  value: Record<string, unknown>;
  fallback: string;
}): string {
  return stringValue(value.partID) ?? stringValue(value.id) ?? fallback;
}

function startLegacyPart({
  ids,
  id,
  emit,
  type,
}: {
  ids: Set<string>;
  id: string;
  emit: Emit;
  type: 'text' | 'reasoning';
}): void {
  if (ids.has(id)) return;
  ids.add(id);
  emit({ type: `${type}-start`, id });
}

function emitLegacyTextPartUpdate({
  part,
  state,
  emit,
}: {
  part: unknown;
  state: TranslationState;
  emit: Emit;
}): boolean {
  if (!isRecord(part)) return false;
  if (part.type !== 'text' && part.type !== 'reasoning') return false;
  const id = stringValue(part.id);
  if (!id) return true;

  const messageID = stringValue(part.messageID);
  if (messageID && state.messageRoles.get(messageID) === 'user') return true;

  const isReasoning = part.type === 'reasoning';
  const ids = isReasoning
    ? state.legacyReasoningPartIds
    : state.legacyTextPartIds;
  const deltaMap = isReasoning ? state.reasoningDeltas : state.textDeltas;
  const deltaType = isReasoning ? 'reasoning-delta' : 'text-delta';
  const text = typeof part.text === 'string' ? part.text : undefined;

  startLegacyPart({
    ids,
    id,
    emit,
    type: isReasoning ? 'reasoning' : 'text',
  });

  if (text !== undefined) {
    emitMissingFinalDelta({
      id,
      fullText: text,
      emittedText: deltaMap.get(id) ?? '',
      emit,
      type: deltaType,
    });
    deltaMap.set(id, text);
  }

  if (legacyPartEnded(part)) {
    ids.delete(id);
    deltaMap.delete(id);
    emit({ type: isReasoning ? 'reasoning-end' : 'text-end', id });
  }

  return true;
}

function legacyPartEnded(part: Record<string, unknown>): boolean {
  return isRecord(part.time) && part.time.end != null;
}

function closeLegacyOpenParts({
  state,
  emit,
}: {
  state: TranslationState;
  emit: Emit;
}): void {
  for (const id of state.legacyReasoningPartIds) {
    emit({ type: 'reasoning-end', id });
    state.reasoningDeltas.delete(id);
  }
  state.legacyReasoningPartIds.clear();
  for (const id of state.legacyTextPartIds) {
    emit({ type: 'text-end', id });
    state.textDeltas.delete(id);
  }
  state.legacyTextPartIds.clear();
}

function emitLegacyToolPart({
  part,
  state,
  emit,
}: {
  part: unknown;
  state: TranslationState;
  emit: Emit;
}): void {
  if (!part || typeof part !== 'object') return;
  const toolPart = part as Record<string, any>;
  if (toolPart.type !== 'tool') return;
  const status = legacyToolPartStatus(toolPart);
  if (status !== 'running' && status !== 'completed' && status !== 'error') {
    return;
  }
  if (
    typeof toolPart.tool !== 'string' ||
    typeof toolPart.callID !== 'string'
  ) {
    return;
  }
  const callID = toolPart.callID;
  const rawToolName = toolPart.tool;
  const toolName = toWireToolName(rawToolName);
  state.toolNames.set(callID, { rawToolName, toolName });
  const hostToolName = getHostToolName(toolName, rawToolName);
  if (hostToolName) {
    if (status === 'running') {
      authorizeHostToolCall({
        callID,
        toolName: hostToolName,
        input: legacyToolPartInput(toolPart),
        state,
      });
    }
    return;
  }
  if (!state.toolCallsEmitted.has(callID)) {
    state.toolCallsEmitted.add(callID);
    emit({
      type: 'tool-call',
      toolCallId: callID,
      toolName,
      ...nativeNameField({ nativeName: rawToolName, toolName }),
      input: JSON.stringify(legacyToolPartInput(toolPart)),
      providerExecuted: true,
      ...(toolPart.provider?.metadata
        ? { providerMetadata: toolPart.provider.metadata }
        : {}),
    });
  }
  if (
    (status === 'completed' || status === 'error') &&
    !state.toolResultsEmitted.has(callID)
  ) {
    state.toolResultsEmitted.add(callID);
    emit({
      type: 'tool-result',
      toolCallId: callID,
      toolName,
      result: legacyToolPartOutput(toolPart),
      ...(status === 'error' ? { isError: true } : {}),
    });
  }
}

function legacyToolPartStatus(part: Record<string, any>): string | undefined {
  return typeof part.state === 'string'
    ? part.state
    : typeof part.state === 'object' && part.state !== null
      ? String(part.state.status ?? '')
      : undefined;
}

function legacyToolPartInput(
  part: Record<string, any>,
): Record<string, unknown> {
  const state =
    typeof part.state === 'object' && part.state !== null
      ? (part.state as Record<string, any>)
      : undefined;
  return {
    ...(isRecord(part.metadata) ? part.metadata : {}),
    ...(isRecord(state?.metadata) ? state.metadata : {}),
    ...(isRecord(state?.input) ? state.input : {}),
  };
}

function legacyToolPartOutput(part: Record<string, any>): unknown {
  const state =
    typeof part.state === 'object' && part.state !== null
      ? (part.state as Record<string, any>)
      : undefined;
  if (state?.status === 'error') {
    return state.error ?? part.error ?? state.result ?? 'tool failed';
  }
  return (
    state?.output ??
    state?.result ??
    state?.structured ??
    state?.content ??
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseToolInput(
  state: TranslationState,
  props: Record<string, any>,
): unknown {
  const text = state.toolInputs.get(String(props.callID ?? ''));
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { input: text };
  }
}

async function handlePermissionV2({
  client,
  sessionId,
  permissionMode,
  builtinToolFiltering,
  turn,
  emit,
  event,
}: {
  client: OpenCodeClient;
  sessionId: string;
  permissionMode: StartMessage['permissionMode'];
  builtinToolFiltering: StartMessage['builtinToolFiltering'];
  turn: BridgeTurn;
  emit: Emit;
  event: OpenCodeEvent;
}): Promise<void> {
  const props = event.properties ?? {};
  const requestID = String(props.id ?? '');
  if (!requestID) return;
  const reply = await selectPermissionReply({
    action: String(props.action ?? ''),
    resources: Array.isArray(props.resources)
      ? props.resources.map(String)
      : [],
    requestID,
    toolCallId:
      typeof props.source === 'object' &&
      props.source !== null &&
      'callID' in props.source
        ? String((props.source as { callID?: unknown }).callID)
        : requestID,
    permissionMode,
    builtinToolFiltering,
    turn,
    emit,
  });
  await client.v2.session.permission.reply({
    sessionID: sessionId,
    requestID,
    reply: reply.reply,
    ...(reply.message ? { message: reply.message } : {}),
  });
}

async function handlePermission({
  client,
  sessionId,
  permissionMode,
  builtinToolFiltering,
  turn,
  emit,
  event,
}: {
  client: OpenCodeClient;
  sessionId: string;
  permissionMode: StartMessage['permissionMode'];
  builtinToolFiltering: StartMessage['builtinToolFiltering'];
  turn: BridgeTurn;
  emit: Emit;
  event: OpenCodeEvent;
}): Promise<void> {
  const props = event.properties ?? {};
  const requestID = String(props.id ?? '');
  if (!requestID) return;
  const reply = await selectPermissionReply({
    action: String(props.permission ?? ''),
    resources: Array.isArray(props.patterns) ? props.patterns.map(String) : [],
    requestID,
    toolCallId:
      typeof props.tool === 'object' &&
      props.tool !== null &&
      'callID' in props.tool
        ? String((props.tool as { callID?: unknown }).callID)
        : requestID,
    permissionMode,
    builtinToolFiltering,
    turn,
    emit,
  });
  await client.permission.reply({
    requestID,
    directory: workdir,
    reply: reply.reply,
    ...(reply.message ? { message: reply.message } : {}),
  });
  void sessionId;
}

async function selectPermissionReply({
  action,
  resources,
  requestID,
  toolCallId,
  permissionMode,
  builtinToolFiltering,
  turn,
  emit,
}: {
  action: string;
  resources: string[];
  requestID: string;
  toolCallId: string;
  permissionMode: StartMessage['permissionMode'];
  builtinToolFiltering: StartMessage['builtinToolFiltering'];
  turn: BridgeTurn;
  emit: Emit;
}): Promise<{ reply: 'once' | 'always' | 'reject'; message?: string }> {
  const toolName = toPermissionToolName(action);
  if (resources.some(resource => isExternalPath(resource))) {
    return { reply: 'reject', message: 'External directory access rejected.' };
  }
  if (
    isBuiltinToolInactive({ toolName, toolFiltering: builtinToolFiltering })
  ) {
    emit({
      type: 'tool-approval-request',
      approvalId: requestID,
      toolCallId,
    });
    const decision = await turn.requestToolApproval(requestID);
    return decision.approved
      ? { reply: 'once' }
      : {
          reply: 'reject',
          ...(decision.reason ? { message: decision.reason } : {}),
        };
  }
  if (!permissionMode || permissionMode === 'allow-all') {
    return { reply: 'always' };
  }
  const kind = TOOL_KIND[toolName] ?? 'bash';
  const allowed =
    permissionMode === 'allow-edits'
      ? kind === 'readonly' || kind === 'edit'
      : kind === 'readonly';
  if (allowed) return { reply: 'always' };

  emit({
    type: 'tool-approval-request',
    approvalId: requestID,
    toolCallId,
  });
  const decision = await turn.requestToolApproval(requestID);
  return decision.approved
    ? { reply: 'once' }
    : {
        reply: 'reject',
        ...(decision.reason ? { message: decision.reason } : {}),
      };
}

function toPermissionToolName(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes('bash') || normalized.includes('shell'))
    return 'bash';
  if (normalized.includes('edit')) return 'edit';
  if (normalized.includes('write')) return 'write';
  if (normalized.includes('webfetch')) return 'webfetch';
  if (normalized.includes('task') || normalized.includes('agent'))
    return 'agent';
  if (normalized.includes('list')) return 'ls';
  if (normalized.includes('grep')) return 'grep';
  if (normalized.includes('glob')) return 'glob';
  if (normalized.includes('read')) return 'read';
  return toWireToolName(normalized);
}

function resolveInactiveBuiltinToolNames(
  start: StartMessage,
): ReadonlyArray<string> {
  const toolFiltering = start.builtinToolFiltering;
  if (toolFiltering == null) return [];
  return toolFiltering.mode === 'allow'
    ? Object.keys(PUBLIC_TO_NATIVE).filter(
        name => !toolFiltering.toolNames.includes(name),
      )
    : toolFiltering.toolNames;
}

function isBuiltinToolInactive(input: {
  toolName: string;
  toolFiltering: StartMessage['builtinToolFiltering'];
}): boolean {
  if (input.toolFiltering == null) return false;
  return input.toolFiltering.mode === 'allow'
    ? !input.toolFiltering.toolNames.includes(input.toolName)
    : input.toolFiltering.toolNames.includes(input.toolName);
}

function isExternalPath(resource: string): boolean {
  if (!path.isAbsolute(resource)) return false;
  const normalized = path.resolve(resource);
  return (
    !isPathInsideOrEqual(normalized, workdir) &&
    (!skillsDir || !isPathInsideOrEqual(normalized, skillsDir))
  );
}

function isPathInsideOrEqual(file: string, root: string): boolean {
  const normalizedRoot = path.resolve(root);
  return file === normalizedRoot || file.startsWith(`${normalizedRoot}/`);
}

function toWireToolName(nativeName: string): string {
  return (
    NATIVE_TO_COMMON[nativeName] ?? OPENCODE_TO_WIRE[nativeName] ?? nativeName
  );
}

function nativeNameField({
  nativeName,
  toolName,
}: {
  nativeName: string;
  toolName: string;
}): { nativeName?: string } {
  if (!nativeName || nativeName === toolName || toolName === 'agent') return {};
  return { nativeName };
}

function getHostToolName(
  toolName: string,
  rawToolName: unknown,
): string | undefined {
  if (runtime.toolNames.has(toolName)) return toolName;
  if (typeof rawToolName === 'string' && runtime.toolNames.has(rawToolName)) {
    return rawToolName;
  }
  if (
    typeof rawToolName === 'string' &&
    rawToolName.startsWith('harness-tools_') &&
    runtime.toolNames.has(rawToolName.slice('harness-tools_'.length))
  ) {
    return rawToolName.slice('harness-tools_'.length);
  }
  return undefined;
}

function authorizeHostToolCall({
  callID,
  toolName,
  input,
  state,
}: {
  callID: string;
  toolName: string;
  input: unknown;
  state: TranslationState;
}): void {
  if (state.hostToolCallsAuthorized.has(callID)) return;
  state.hostToolCallsAuthorized.add(callID);
  runtime.relay?.authorizeToolCall({ toolName, input });
}

async function emitContextFallback({
  client,
  sessionId,
  emit,
  emitContent,
}: {
  client: OpenCodeClient;
  sessionId: string;
  emit: Emit;
  emitContent: boolean;
}): Promise<boolean> {
  const assistant = await latestAssistantSnapshot({ client, sessionId });
  if (!assistant) return false;
  if (emitContent && Array.isArray(assistant.contentParts)) {
    for (const part of assistant.contentParts) {
      emitAssistantContentPart(part, emit);
    }
  }
  const rawFinish =
    typeof assistant.finish === 'string'
      ? assistant.finish
      : assistant.error
        ? 'error'
        : 'stop';
  emit({
    type: 'finish-step',
    finishReason: {
      unified: mapFinishReason(rawFinish),
      raw: rawFinish,
    },
    usage: mapUsage(assistant.tokens),
    ...(typeof assistant.cost === 'number'
      ? {
          harnessMetadata: {
            opencode: { cost: assistant.cost, fallback: true },
          },
        }
      : { harnessMetadata: { opencode: { fallback: true } } }),
  });
  return true;
}

async function readSessionTokens({
  client,
  sessionId,
}: {
  client: OpenCodeClient;
  sessionId: string;
}): Promise<OpenCodeTokenUsage | undefined> {
  const session = await legacySessionGet({ client, sessionId });
  if (session.error) return undefined;
  return extractSessionTokens(session.data);
}

type AssistantSnapshot = {
  contentParts?: unknown[];
  metadata?: unknown;
  model?: unknown;
  modelID?: unknown;
  providerID?: unknown;
  tokens?: unknown;
  finish?: unknown;
  cost?: unknown;
  error?: unknown;
};

async function latestAssistantSnapshot({
  client,
  sessionId,
}: {
  client: OpenCodeClient;
  sessionId: string;
}): Promise<AssistantSnapshot | undefined> {
  const legacy = await (client as any).session
    .messages({ sessionID: sessionId, limit: 20 })
    .catch(() => undefined);
  const legacyAssistant = latestLegacyAssistantMessage(legacy?.data);
  if (legacyAssistant) return legacyAssistant;

  const context = await client.v2.session
    .context({ sessionID: sessionId })
    .catch(() => undefined);
  if (!context || context.error) return undefined;
  return latestV2AssistantMessage(context.data);
}

function latestLegacyAssistantMessage(
  data: unknown,
): AssistantSnapshot | undefined {
  const messages = Array.isArray(data) ? data : [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const item = messages[i];
    if (!item || typeof item !== 'object') continue;
    const record = item as { info?: unknown; parts?: unknown };
    const info = record.info;
    if (
      info &&
      typeof info === 'object' &&
      (info as { role?: unknown }).role === 'assistant'
    ) {
      return {
        ...(info as Record<string, unknown>),
        contentParts: Array.isArray(record.parts) ? record.parts : undefined,
      };
    }
  }
  return undefined;
}

function latestV2AssistantMessage(
  data: unknown,
): AssistantSnapshot | undefined {
  const messages =
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : Array.isArray(data)
        ? data
        : [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message &&
      typeof message === 'object' &&
      (message as { type?: unknown }).type === 'assistant'
    ) {
      const record = message as Record<string, unknown>;
      return {
        ...record,
        contentParts: Array.isArray(record.content)
          ? record.content
          : undefined,
      };
    }
  }
  return undefined;
}

function emitAssistantContentPart(part: unknown, emit: Emit): void {
  if (!part || typeof part !== 'object') return;
  const value = part as { type?: unknown; id?: unknown; text?: unknown };
  if (value.type !== 'text' && value.type !== 'reasoning') return;
  const id =
    typeof value.id === 'string' && value.id.length > 0
      ? value.id
      : `${value.type}-${randomUUID()}`;
  const text = typeof value.text === 'string' ? value.text : '';
  if (value.type === 'text') {
    emit({ type: 'text-start', id });
    if (text) emit({ type: 'text-delta', id, delta: text });
    emit({ type: 'text-end', id });
    return;
  }
  emit({ type: 'reasoning-start', id });
  if (text) emit({ type: 'reasoning-delta', id, delta: text });
  emit({ type: 'reasoning-end', id });
}

function mapFinishReason(
  reason: string,
): 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' {
  const normalized = reason.toLowerCase();
  if (normalized.includes('length')) return 'length';
  if (normalized.includes('filter')) return 'content-filter';
  if (normalized.includes('tool')) return 'tool-calls';
  if (normalized.includes('error') || normalized.includes('fail'))
    return 'error';
  if (normalized === 'stop' || normalized === 'end') return 'stop';
  return 'other';
}

async function startToolRelay({
  allowedScriptPaths,
  tools,
  emit,
  requestToolResult,
}: {
  allowedScriptPaths: ReadonlyArray<string>;
  tools: ReadonlyArray<{ name: string }>;
  emit: Emit;
  requestToolResult: (
    toolCallId: string,
  ) => Promise<{ output: unknown; isError?: boolean }>;
}): Promise<ToolRelay> {
  const toolNames = new Set(tools.map(t => t.name));
  const allowedScriptPathSet = new Set(allowedScriptPaths);
  const authorizer = new ToolRelayAuthorizer();
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'POST' || req.url !== '/') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized tool relay request' }));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      const { requestId, toolName, input } = JSON.parse(body) as {
        requestId: string;
        toolName: string;
        input: unknown;
      };

      if (!toolNames.has(toolName)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: `Tool "${toolName}" is not available` }),
        );
        return;
      }
      const authorized =
        authorizer.consumeToolCall({ toolName, input }) ||
        (await isToolRelayRequestFromAllowedProcess({
          socket: req.socket,
          allowedScriptPaths: allowedScriptPathSet,
        }));
      if (!authorized) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized tool relay request' }));
        return;
      }

      emit({
        type: 'tool-call',
        toolCallId: requestId,
        toolName,
        input: JSON.stringify(input ?? {}),
        providerExecuted: false,
      });

      const { output, isError } = await requestToolResult(requestId);
      emit({
        type: 'tool-result',
        toolCallId: requestId,
        toolName,
        result: output ?? null,
        isError: !!isError,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: output }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  await new Promise<void>(resolve =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('tool relay did not expose a numeric port');
  }
  return {
    port: address.port,
    close: () => closeServer(server),
    authorizeToolCall: call => authorizer.authorizeToolCall(call),
  };
}

function closeServer(server: Server): void {
  try {
    server.close();
  } catch {}
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitModel(
  model: string | undefined,
  provider: string | undefined,
): { providerID?: string; modelID?: string } {
  if (!model) return {};
  if (model.includes('/')) {
    const [providerID, ...rest] = model.split('/');
    return { providerID, modelID: rest.join('/') };
  }
  return { providerID: provider, modelID: model };
}

type OpenCodeModelRef = { providerID: string; modelID: string };

async function resolveCompactionModel({
  client,
  sessionId,
  start,
}: {
  client: OpenCodeClient;
  sessionId: string;
  start: StartMessage;
}): Promise<OpenCodeModelRef | undefined> {
  const assistant = await latestAssistantSnapshot({ client, sessionId }).catch(
    () => undefined,
  );
  const assistantModel = modelRefFromAssistantSnapshot(assistant);
  if (assistantModel) return assistantModel;

  const session = await legacySessionGet({ client, sessionId }).catch(
    () => undefined,
  );
  const sessionModel = modelRefFromSessionInfo(session?.data);
  if (sessionModel) return sessionModel;

  return modelRefFromStart(start);
}

function modelRefFromAssistantSnapshot(
  assistant: AssistantSnapshot | undefined,
): OpenCodeModelRef | undefined {
  if (!assistant) return undefined;
  const model = modelRefFromValue(assistant.model);
  if (model) return model;

  const direct = modelRefFromValue(assistant);
  if (direct) return direct;

  if (isRecord(assistant.metadata)) {
    return modelRefFromValue(assistant.metadata.assistant);
  }
  return undefined;
}

function modelRefFromSessionInfo(data: unknown): OpenCodeModelRef | undefined {
  if (!isRecord(data)) return undefined;
  return modelRefFromValue(data.model) ?? modelRefFromValue(data);
}

function modelRefFromStart(start: StartMessage): OpenCodeModelRef | undefined {
  const model = splitModel(start.model, start.provider);
  if (!model.modelID) return undefined;
  return {
    providerID:
      model.providerID ?? start.provider ?? procEnv.OPENAI_NAME ?? 'anthropic',
    modelID: model.modelID,
  };
}

function modelRefFromValue(value: unknown): OpenCodeModelRef | undefined {
  if (!isRecord(value)) return undefined;
  const providerID = stringValue(value.providerID);
  const modelID = stringValue(value.modelID ?? value.id);
  if (!providerID || !modelID) return undefined;
  return { providerID, modelID };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stripWorkDir(file: string): string {
  if (!file) return file;
  const normalized = path.resolve(file);
  const root = path.resolve(workdir);
  return normalized.startsWith(`${root}/`)
    ? normalized.slice(root.length + 1)
    : file;
}

function parseArgs(args: string[]): {
  workdir?: string;
  bridgeStateDir?: string;
  bootstrapDir?: string;
  skillsDir?: string;
} {
  const out: {
    workdir?: string;
    bridgeStateDir?: string;
    bootstrapDir?: string;
    skillsDir?: string;
  } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--workdir' && i + 1 < args.length) {
      out.workdir = args[++i];
    } else if (args[i] === '--bridge-state-dir' && i + 1 < args.length) {
      out.bridgeStateDir = args[++i];
    } else if (args[i] === '--bootstrap-dir' && i + 1 < args.length) {
      out.bootstrapDir = args[++i];
    } else if (args[i] === '--skills-dir' && i + 1 < args.length) {
      out.skillsDir = args[++i];
    }
  }
  return out;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function serialiseError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}

function emitFatal(message: string): never {
  process.stderr.write(`[opencode bridge] ${message}\n`);
  process.exit(1);
}
