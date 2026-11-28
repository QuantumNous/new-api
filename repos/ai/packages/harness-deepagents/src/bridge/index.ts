// In-sandbox turn driver on `@ai-sdk/harness/bridge`; third-party imports stay external (tsup) and install in-sandbox from src/bridge/package.json — keep import/externals/deps in sync.

import { randomUUID } from 'node:crypto';
import { argv, env as procEnv } from 'node:process';
import {
  runBridge,
  type BridgeEvent,
  type BridgeTurn,
} from '@ai-sdk/harness/bridge';
import { ChatAnthropic } from '@langchain/anthropic';
import { tool } from '@langchain/core/tools';
import { Command, MemorySaver } from '@langchain/langgraph';
import { createDeepAgent } from 'deepagents';
import type { StartMessage } from '../deepagents-bridge-protocol';
import { buildInterruptOn, collectActionRequests } from './approvals';
import { jsonSchemaToZodObject } from './json-schema-to-zod';
import { createLocalShellBackend } from './local-shell-backend';
import { createBuiltinToolFilteringMiddleware } from './tool-filtering';

// Native Deep Agents tool name -> harness-v1 common name (renames only; grep/glob/ls/task/write_todos forward unchanged).
const NATIVE_TO_COMMON: Readonly<Record<string, string>> = {
  read_file: 'read',
  write_file: 'write',
  edit_file: 'edit',
  execute: 'bash',
};
const HARNESS_CLIENT_APP = procEnv.AI_SDK_HARNESS_CLIENT_APP;

function toCommonName(nativeName: string): string {
  return NATIVE_TO_COMMON[nativeName] ?? nativeName;
}

function parseArgs(rawArgs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      const key = arg
        .slice(2)
        .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      out[key] = rawArgs[i + 1];
      i++;
    }
  }
  return out;
}

// Always drive the Anthropic client. Through the gateway, models keep their
// `creator/model` slug (gateway translates); direct Anthropic wants the bare id.
function buildModel(rawModel: string | undefined) {
  if (!rawModel) return undefined;
  const baseUrl = procEnv.ANTHROPIC_BASE_URL;
  const model = baseUrl ? rawModel : rawModel.replace(/^anthropic[/:]/, '');
  return new ChatAnthropic({
    model,
    ...(procEnv.ANTHROPIC_API_KEY ? { apiKey: procEnv.ANTHROPIC_API_KEY } : {}),
    ...(baseUrl ? { anthropicApiUrl: baseUrl } : {}),
    ...(procEnv.AI_GATEWAY_API_KEY && HARNESS_CLIENT_APP
      ? {
          clientOptions: {
            defaultHeaders: {
              'User-Agent': HARNESS_CLIENT_APP,
              'x-client-app': HARNESS_CLIENT_APP,
            },
          },
        }
      : {}),
  });
}

// LangChain reports some built-in tool args wrapped as `{ input: "<json>" }`; unwrap to the inner JSON so AI SDK validates the real shape.
function toToolCallInput(raw: unknown): string {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.keys(raw).length === 1 &&
    typeof (raw as { input?: unknown }).input === 'string'
  ) {
    const inner = (raw as { input: string }).input;
    if (/^\s*[[{]/.test(inner)) return inner;
  }
  return JSON.stringify(raw ?? {});
}

const args = parseArgs(argv.slice(2));
const workdir = args.workdir;
const bridgeStateDir = args.bridgeStateDir;
if (!workdir || !bridgeStateDir) {
  // eslint-disable-next-line no-console
  console.error('deepagents bridge: missing --workdir / --bridge-state-dir');
  process.exit(1);
}

// One agent per bridge process, reused across turns; host tools read the live turn via `currentTurn`.
let agent: ReturnType<typeof createDeepAgent> | undefined;
let currentTurn: BridgeTurn | undefined;

// Host tools become LangChain tools that emit a `tool-call` and block on the host's `tool-result`.
function buildHostTools(toolSchemas: StartMessage['tools']) {
  return (toolSchemas ?? []).map(schema =>
    tool(
      async (input: Record<string, unknown>) => {
        const turn = currentTurn;
        if (!turn) throw new Error('no active turn');
        const toolCallId = `${schema.name}-${randomUUID()}`;
        turn.emit({
          type: 'tool-call',
          toolCallId,
          toolName: schema.name,
          input: JSON.stringify(input),
          providerExecuted: false,
        } as BridgeEvent);
        const { output } = await turn.requestToolResult(toolCallId);
        return typeof output === 'string' ? output : JSON.stringify(output);
      },
      {
        name: schema.name,
        description: schema.description ?? '',
        schema: jsonSchemaToZodObject(schema.inputSchema),
      },
    ),
  );
}

async function runTurn(start: StartMessage, turn: BridgeTurn): Promise<void> {
  currentTurn = turn;
  const emit = (event: Record<string, unknown>) =>
    turn.emit(event as BridgeEvent);

  const interruptOn = buildInterruptOn(
    start.permissionMode,
    start.builtinToolFiltering,
  );
  if (!agent) {
    const model = buildModel(start.model);
    const builtinToolFilteringMiddleware = createBuiltinToolFilteringMiddleware(
      {
        builtinToolFiltering: start.builtinToolFiltering,
        emit: event => {
          const turn = currentTurn;
          if (!turn) throw new Error('no active turn');
          turn.emit(event as BridgeEvent);
        },
      },
    );
    agent = createDeepAgent({
      // Defer to Deep Agents's own default when the host configured no model.
      ...(model ? { model } : {}),
      tools: buildHostTools(start.tools),
      backend: createLocalShellBackend({ rootDir: workdir }),
      systemPrompt: start.instructions || undefined,
      // Native skills loaded from the source dirs ($HOME-materialized + <workDir> for repo-provided skills).
      ...(start.skillsPaths?.length ? { skills: start.skillsPaths } : {}),
      ...(builtinToolFilteringMiddleware
        ? { middleware: [builtinToolFilteringMiddleware] }
        : {}),
      // Gate built-in tools behind HITL approval when the permission mode requires it.
      ...(interruptOn ? { interruptOn } : {}),
      // Real instance (LangGraph rejects `true` for root graphs); gives multi-turn memory.
      checkpointer: new MemorySaver(),
    });
  }

  emit({
    type: 'stream-start',
    ...(start.model ? { modelId: start.model } : {}),
  });

  const hostToolNames = new Set((start.tools ?? []).map(t => t.name));
  let textBlockId: string | undefined;
  let reasoningBlockId: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  // Per-call streamed-usage fallback (max over chunks), used only when model-end carries no usage.
  let streamedStepInput = 0;
  let streamedStepOutput = 0;
  // Top-level step usage is buffered at model-end and flushed as finish-step only after the step's tools run.
  let pendingStep: { input: number; output: number } | undefined;
  // Approval-gated tools are announced before execution; these tie the later run back to the approval id and dedup the call.
  const approvedToolQueue = new Map<string, string[]>();
  const approvedRunIds = new Map<string, string>();

  const ensureTextBlock = (): string => {
    if (!textBlockId) {
      textBlockId = `text-${randomUUID()}`;
      emit({ type: 'text-start', id: textBlockId });
    }
    return textBlockId;
  };
  const endTextBlock = () => {
    if (textBlockId) {
      emit({ type: 'text-end', id: textBlockId });
      textBlockId = undefined;
    }
  };
  const endReasoningBlock = () => {
    if (reasoningBlockId) {
      emit({ type: 'reasoning-end', id: reasoningBlockId });
      reasoningBlockId = undefined;
    }
  };
  // Text and reasoning are mutually exclusive open blocks: starting one closes the other.
  const emitText = (delta: string) => {
    endReasoningBlock();
    emit({ type: 'text-delta', id: ensureTextBlock(), delta });
  };
  const emitReasoning = (delta: string) => {
    endTextBlock();
    if (!reasoningBlockId) {
      reasoningBlockId = `reasoning-${randomUUID()}`;
      emit({ type: 'reasoning-start', id: reasoningBlockId });
    }
    emit({ type: 'reasoning-delta', id: reasoningBlockId, delta });
  };
  // Close the buffered top-level step; called when the next step starts and at turn end so finish-step lands after the step's tools.
  const flushStep = () => {
    if (!pendingStep) return;
    emit({
      type: 'finish-step',
      finishReason: { unified: 'stop' },
      usage: {
        inputTokens: { total: pendingStep.input },
        outputTokens: { total: pendingStep.output },
      },
    });
    pendingStep = undefined;
  };

  const config = {
    version: 'v2' as const,
    configurable: { thread_id: 'bridge-session' },
    recursionLimit: start.recursionLimit ?? 100,
    signal: turn.abortSignal,
  };

  // After a stream segment ends, return the tool calls paused by HITL interrupts (empty when the turn is truly done).
  const readPendingApprovals = async () => {
    try {
      const state = (await agent!.getState({
        configurable: { thread_id: 'bridge-session' },
      })) as { tasks?: Array<{ interrupts?: Array<{ value?: unknown }> }> };
      return collectActionRequests(
        (state.tasks ?? []).flatMap(t => t.interrupts ?? []),
      );
    } catch {
      return [];
    }
  };

  let resumeInput: unknown = {
    messages: [{ role: 'user', content: start.prompt }],
  };

  while (true) {
    const stream = await agent.streamEvents(resumeInput as never, config);

    for await (const event of stream) {
      const kind = event.event;
      const data = (event.data ?? {}) as Record<string, unknown>;
      // Subagent (e.g. `task`) events carry a `|`-delimited checkpoint namespace; keep their internals out of the top-level stream.
      const ns =
        (event as { metadata?: { langgraph_checkpoint_ns?: string } }).metadata
          ?.langgraph_checkpoint_ns ?? '';
      const nested = ns.includes('|');

      if (kind === 'on_chat_model_start') {
        // A new top-level model call means the previous step's tools have run; close it now.
        if (!nested) flushStep();
      } else if (kind === 'on_chat_model_stream') {
        if (nested) continue;
        const chunk = data.chunk as
          | {
              content?: unknown;
              usage_metadata?: {
                input_tokens?: number;
                output_tokens?: number;
              };
            }
          | undefined;
        if (!chunk) continue;
        const content = chunk.content;
        if (typeof content === 'string' && content) {
          emitText(content);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block && typeof block === 'object') {
              const b = block as {
                type?: string;
                text?: string;
                thinking?: string;
              };
              if (b.type === 'text' && b.text) emitText(b.text);
              else if (b.type === 'thinking' && b.thinking)
                emitReasoning(b.thinking);
            }
          }
        }
        const usage = chunk.usage_metadata;
        if (usage) {
          streamedStepInput = Math.max(
            streamedStepInput,
            usage.input_tokens ?? 0,
          );
          streamedStepOutput = Math.max(
            streamedStepOutput,
            usage.output_tokens ?? 0,
          );
        }
      } else if (kind === 'on_chat_model_end') {
        // Final usage lands on model-end, not the chunks; each model call is one step.
        const output = data.output as
          | {
              usage_metadata?: {
                input_tokens?: number;
                output_tokens?: number;
              };
            }
          | undefined;
        const usage = output?.usage_metadata;
        // One model call = one step; count its usage exactly once (model-end usage, else the streamed max).
        const stepInput = usage?.input_tokens ?? streamedStepInput;
        const stepOutput = usage?.output_tokens ?? streamedStepOutput;
        inputTokens += stepInput;
        outputTokens += stepOutput;
        streamedStepInput = 0;
        streamedStepOutput = 0;
        // Nested (subagent) calls still count toward total usage, but only top-level calls bound a visible step.
        if (!nested) {
          endTextBlock();
          endReasoningBlock();
          // Buffer the step; flushStep emits finish-step after this step's tools run (next start / turn end).
          pendingStep = { input: stepInput, output: stepOutput };
        }
      } else if (kind === 'on_tool_start') {
        const toolName = (event.name as string) ?? 'unknown';
        const runId = (event.run_id as string) ?? '';
        // Host tools emit their own tool-call; surface only top-level builtin (providerExecuted) tools.
        if (!nested && !hostToolNames.has(toolName)) {
          const queued = approvedToolQueue.get(toolName);
          if (queued && queued.length > 0) {
            // Already announced at approval time; tie this run to that id and don't re-emit the call.
            const approvalId = queued.shift()!;
            if (runId) approvedRunIds.set(runId, approvalId);
          } else {
            endTextBlock();
            endReasoningBlock();
            emit({
              type: 'tool-call',
              toolCallId: runId,
              toolName: toCommonName(toolName),
              input: toToolCallInput(data.input),
              providerExecuted: true,
              nativeName: toolName,
            });
          }
        }
      } else if (kind === 'on_tool_end') {
        const toolName = (event.name as string) ?? 'unknown';
        const runId = (event.run_id as string) ?? '';
        if (!nested && !hostToolNames.has(toolName)) {
          let output: unknown = data.output ?? '';
          if (output && typeof output === 'object' && 'content' in output) {
            output = (output as { content: unknown }).content;
          }
          emit({
            type: 'tool-result',
            toolCallId: approvedRunIds.get(runId) ?? runId,
            toolName: toCommonName(toolName),
            result: output ?? null,
          });
          approvedRunIds.delete(runId);
        }
      }
    }

    const actionRequests = await readPendingApprovals();
    if (actionRequests.length === 0) break;

    // HITL paused the run: announce each gated call, collect host decisions, then resume.
    const decisions: Array<
      { type: 'approve' } | { type: 'reject'; message?: string }
    > = [];
    for (const action of actionRequests) {
      const approvalId = `approval-${randomUUID()}`;
      endTextBlock();
      endReasoningBlock();
      emit({
        type: 'tool-call',
        toolCallId: approvalId,
        toolName: toCommonName(action.name),
        input: JSON.stringify(action.args ?? {}),
        providerExecuted: true,
        nativeName: action.name,
      });
      emit({
        type: 'tool-approval-request',
        approvalId,
        toolCallId: approvalId,
      });
      flushStep();
      const decision = await turn.requestToolApproval(approvalId);
      if (decision.approved) {
        const queue = approvedToolQueue.get(action.name) ?? [];
        queue.push(approvalId);
        approvedToolQueue.set(action.name, queue);
        decisions.push({ type: 'approve' });
      } else {
        // Rejected tools never execute, so surface the outcome as the result now.
        emit({
          type: 'tool-result',
          toolCallId: approvalId,
          toolName: toCommonName(action.name),
          result: decision.reason ?? 'Rejected by user.',
        });
        decisions.push({
          type: 'reject',
          ...(decision.reason ? { message: decision.reason } : {}),
        });
      }
    }

    resumeInput = new Command({ resume: { decisions } });
  }

  endTextBlock();
  endReasoningBlock();
  flushStep();
  emit({
    type: 'finish',
    finishReason: { unified: 'stop' },
    totalUsage: {
      inputTokens: { total: inputTokens },
      outputTokens: { total: outputTokens },
    },
  });
}

await runBridge<StartMessage>({
  bridgeType: 'deepagents',
  bridgeStateDir: bridgeStateDir!,
  onStart: runTurn,
});
