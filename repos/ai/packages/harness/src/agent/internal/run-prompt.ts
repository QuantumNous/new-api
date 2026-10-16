import {
  getHarnessV1BuiltinToolFilteringDenialReason,
  isHarnessV1BuiltinToolIncluded,
  type HarnessV1,
  type HarnessV1BuiltinToolFiltering,
  type HarnessV1PendingToolApproval,
  type HarnessV1Prompt,
  type HarnessV1PromptControl,
  type HarnessV1Session,
  type HarnessV1StreamPart,
  type HarnessV1ToolSpec,
} from '../../v1';
import { toHarnessStream } from './to-harness-stream';
import {
  executeTool,
  generateId,
  isExecutableTool,
  safeParseJSON,
  type Context,
  type Experimental_SandboxSession as SandboxSession,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import type {
  LanguageModelV4FinishReason,
  LanguageModelV4ToolCall,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { parseToolCall } from 'ai/internal';
import type { ContentPart, TelemetryOptions, TextStreamPart } from 'ai';
import type { HarnessAgentToolApprovalContinuation } from '../harness-agent-tool-approval-continuation';
import type { HarnessAgentToolApprovalConfiguration } from '../harness-agent-settings';
import { HarnessStreamTextResult } from './harness-stream-text-result';
import { translateStreamPart } from './translate-stream-part';
import { stripWorkDir } from './strip-work-dir';
import { createTurnTelemetry, type TurnContentPart } from './turn-telemetry';
import { resolveCustomToolApproval } from './permission-mode';
import { logBridgeError } from '../../utils/bridge-diagnostics';

/**
 * Drive one prompt turn end-to-end:
 *  - call `session.doPromptTurn` via `toHarnessStream`
 *  - translate harness events to AI SDK `TextStreamPart`s and push into the
 *    result object
 *  - execute host-side user tools when their `tool-call` events arrive and
 *    submit results back to the harness
 *  - close the result when the harness signals `finish` (or on error)
 *
 * Returns the result synchronously after the stream is wired up; callers
 * await its `PromiseLike` accessors to observe completion.
 */
export function runPrompt<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
>(input: {
  harness: HarnessV1;
  session: HarnessV1Session;
  /**
   * Turn entry point. `'prompt'` (default) starts a new turn from `prompt`;
   * `'continue'` continues the in-flight turn via `doContinueTurn` and ignores
   * `prompt`/`instructions`.
   */
  mode?: 'prompt' | 'continue';
  /** Required for `mode: 'prompt'`; absent for `mode: 'continue'`. */
  prompt?: HarnessV1Prompt;
  instructions: string | undefined;
  tools: TOOLS;
  activeTools?: ToolSet;
  toolSpecs: HarnessV1ToolSpec[];
  builtinToolFiltering?: HarnessV1BuiltinToolFiltering | undefined;
  sandboxSession: SandboxSession;
  sessionWorkDir: string;
  runtimeContext: RUNTIME_CONTEXT;
  abortSignal: AbortSignal | undefined;
  telemetry?: TelemetryOptions | undefined;
  toolApproval?: HarnessAgentToolApprovalConfiguration | undefined;
  pendingToolApprovals?: readonly HarnessV1PendingToolApproval[];
  toolApprovalContinuations?:
    | readonly HarnessAgentToolApprovalContinuation[]
    | undefined;
  onPendingToolApproval?: (approval: HarnessV1PendingToolApproval) => void;
  onToolApprovalSettled?: (approvalId: string) => void;
  onTurnFinished?: () => void;
}): {
  result: HarnessStreamTextResult<TOOLS, RUNTIME_CONTEXT>;
  done: Promise<void>;
} {
  const result = new HarnessStreamTextResult<TOOLS, RUNTIME_CONTEXT>({
    tools: input.tools,
    runtimeContext: input.runtimeContext,
    // toolsContext is not configurable for harnesses; pass undefined cast.
    toolsContext: undefined as never,
    harnessId: input.harness.harnessId,
    sessionId: input.session.sessionId,
  });
  const pendingToolApprovals = input.pendingToolApprovals ?? [];
  const onPendingToolApproval = input.onPendingToolApproval ?? (() => {});
  const onToolApprovalSettled = input.onToolApprovalSettled ?? (() => {});
  const activeTools = input.activeTools ?? input.tools;

  const telemetry = createTurnTelemetry({
    telemetry: input.telemetry,
    harnessId: input.harness.harnessId,
    modelId: input.session.modelId,
    instructions: input.instructions,
    promptText: input.prompt != null ? promptToText(input.prompt) : '',
    runtimeContext: input.runtimeContext,
  });

  const done = (async () => {
    let bridge: Awaited<ReturnType<typeof toHarnessStream>>;
    try {
      bridge = await toHarnessStream({
        invoke:
          input.mode === 'continue'
            ? emit =>
                input.session.doContinueTurn({
                  tools: input.toolSpecs,
                  abortSignal: input.abortSignal,
                  emit,
                })
            : emit => {
                if (input.prompt == null) {
                  throw new Error(
                    'runPrompt: `prompt` is required for mode "prompt".',
                  );
                }
                return input.session.doPromptTurn({
                  prompt: input.prompt,
                  tools: input.toolSpecs,
                  instructions: input.instructions,
                  abortSignal: input.abortSignal,
                  emit,
                });
              },
      });
    } catch (err) {
      telemetry.error(err);
      logBridgeError({
        harnessId: input.harness.harnessId,
        sessionId: input.session.sessionId,
        context: 'failed to start harness turn',
        error: err,
      });
      result.fail(err);
      return;
    }

    const { stream, control } = bridge;
    const reader = stream.getReader();
    const toolCallsByToolCallId = new Map<string, ToolCallTextStreamPart>();
    const rawToolCallsByToolCallId = new Map<
      string,
      Extract<HarnessV1StreamPart, { type: 'tool-call' }>
    >();
    const pendingApprovalsByApprovalId = new Map(
      pendingToolApprovals.map(approval => [approval.approvalId, approval]),
    );
    const pendingApprovalsByToolCallId = new Map(
      pendingToolApprovals.map(approval => [approval.toolCallId, approval]),
    );
    const continuationsByApprovalId = new Map(
      (input.toolApprovalContinuations ?? []).map(continuation => [
        continuation.approvalResponse.approvalId,
        continuation,
      ]),
    );
    const settledApprovalToolCallIds = new Set<string>();
    let finalFinish:
      | Extract<HarnessV1StreamPart, { type: 'finish' }>
      | undefined;

    // Accumulate the model's output content per step so telemetry can record
    // `gen_ai.output.messages` and reporters can log what was actually said.
    let stepText = '';
    let stepReasoning = '';
    let stepToolCalls: TurnContentPart[] = [];
    const buildStepContent = (): TurnContentPart[] => {
      const parts: TurnContentPart[] = [];
      if (stepText) parts.push({ type: 'text', text: stepText });
      if (stepReasoning) parts.push({ type: 'reasoning', text: stepReasoning });
      parts.push(...stepToolCalls);
      return parts;
    };
    const resetStepContent = (): void => {
      stepText = '';
      stepReasoning = '';
      stepToolCalls = [];
    };
    const zeroUsage: LanguageModelV4Usage = {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
    };
    const toolCallsFinishReason: LanguageModelV4FinishReason = {
      unified: 'tool-calls',
      raw: undefined,
    };
    const finishForToolApprovalPause = async (): Promise<void> => {
      telemetry.stepFinish({
        finishReason: toolCallsFinishReason,
        usage: zeroUsage,
        content: buildStepContent(),
      });
      resetStepContent();
      result.finishStep({
        finishReason: toolCallsFinishReason,
        usage: zeroUsage,
        providerMetadata: undefined,
        warnings: [],
      });
      telemetry.end({
        finishReason: toolCallsFinishReason,
        usage: zeroUsage,
      });
      await result.finish();
    };
    const enqueueApprovalRequest = (approval: {
      approvalId: string;
      toolCall: ToolCallTextStreamPart;
      isAutomatic?: boolean;
    }): void => {
      result.enqueue({
        type: 'tool-approval-request',
        approvalId: approval.approvalId,
        toolCall: approval.toolCall,
        ...(approval.isAutomatic !== undefined
          ? { isAutomatic: approval.isAutomatic }
          : {}),
      } as TextStreamPart<TOOLS>);
    };
    const enqueueAutomaticApprovalResponse = (input: {
      approvalId: string;
      toolCall: ToolCallTextStreamPart;
      approved: boolean;
      reason?: string;
      providerExecuted?: boolean;
    }): void => {
      result.enqueue({
        type: 'tool-approval-response',
        approvalId: input.approvalId,
        toolCall: input.toolCall,
        approved: input.approved,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.providerExecuted !== undefined
          ? { providerExecuted: input.providerExecuted }
          : {}),
      } as TextStreamPart<TOOLS>);
    };
    const enqueueApprovalResponse = (
      approval: HarnessV1PendingToolApproval,
      continuation: HarnessAgentToolApprovalContinuation,
    ): void => {
      result.enqueue({
        type: 'tool-approval-response',
        approvalId: approval.approvalId,
        toolCall: continuation.toolCall,
        approved: continuation.approvalResponse.approved,
        ...(continuation.approvalResponse.reason !== undefined
          ? { reason: continuation.approvalResponse.reason }
          : {}),
        ...(approval.providerExecuted !== undefined
          ? { providerExecuted: approval.providerExecuted }
          : {}),
      } as TextStreamPart<TOOLS>);
    };
    const processPendingApprovalContinuation = async (
      approval: HarnessV1PendingToolApproval,
      continuation: HarnessAgentToolApprovalContinuation,
    ): Promise<void> => {
      enqueueApprovalResponse(approval, continuation);
      onToolApprovalSettled(approval.approvalId);
      pendingApprovalsByApprovalId.delete(approval.approvalId);
      pendingApprovalsByToolCallId.delete(approval.toolCallId);
      settledApprovalToolCallIds.add(approval.toolCallId);

      if (approval.kind === 'builtin') {
        if (control.submitToolApproval == null) {
          throw new Error(
            `Harness '${input.harness.harnessId}' emitted a built-in tool approval request but does not support approval responses.`,
          );
        }
        await control.submitToolApproval({
          approvalId: approval.approvalId,
          approved: continuation.approvalResponse.approved,
          reason: continuation.approvalResponse.reason,
        });
        return;
      }

      if (!continuation.approvalResponse.approved) {
        await control.submitToolResult({
          toolCallId: approval.toolCallId,
          output: {
            type: 'execution-denied',
            reason: continuation.approvalResponse.reason,
          },
        });
        return;
      }

      const rawToolCall =
        rawToolCallsByToolCallId.get(approval.toolCallId) ??
        ({
          type: 'tool-call',
          toolCallId: approval.toolCallId,
          toolName: approval.toolName,
          input: approval.input,
        } satisfies Extract<HarnessV1StreamPart, { type: 'tool-call' }>);

      const outcome = await maybeExecuteHostTool({
        event: rawToolCall,
        tools: activeTools,
        sandboxSession: input.sandboxSession,
        abortSignal: input.abortSignal,
        control,
        onPreliminaryResult: preliminaryOutput => {
          const stripped = stripWorkDir(
            {
              type: 'tool-result',
              toolCallId: rawToolCall.toolCallId,
              toolName: rawToolCall.toolName,
              result: preliminaryOutput as Extract<
                HarnessV1StreamPart,
                { type: 'tool-result' }
              >['result'],
            },
            input.sessionWorkDir,
          ) as Extract<HarnessV1StreamPart, { type: 'tool-result' }>;
          result.enqueue({
            type: 'tool-result',
            toolCallId: rawToolCall.toolCallId,
            toolName: rawToolCall.toolName,
            input: undefined,
            output: stripped.result,
            preliminary: true,
          } as TextStreamPart<TOOLS>);
        },
      });
      telemetry.toolEnd(rawToolCall.toolCallId, outcome);
    };

    try {
      for (const approval of pendingToolApprovals) {
        const continuation = continuationsByApprovalId.get(approval.approvalId);
        if (continuation != null) {
          await processPendingApprovalContinuation(approval, continuation);
        }
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value == null) continue;

        // Begin the operation span on stream-start, using the runtime-resolved
        // model the adapter reports (falling back to the session's model).
        if (value.type === 'stream-start') {
          telemetry.start(value.modelId ?? input.session.modelId);
        }

        // Open a step span lazily before the first content of each step.
        if (
          value.type !== 'stream-start' &&
          value.type !== 'finish-step' &&
          value.type !== 'finish' &&
          value.type !== 'error'
        ) {
          telemetry.ensureStepOpen();
        }

        /*
         * Strip the session working-directory prefix for everything the
         * consumer sees. The original `value` is kept intact for host tool
         * execution below — the tools need the absolute path to resolve
         * against the sandbox root, so the strip is display-only.
         */
        const displayValue = stripWorkDir(value, input.sessionWorkDir);
        const settledApprovalToolCallReplay =
          displayValue.type === 'tool-call' &&
          !displayValue.providerExecuted &&
          settledApprovalToolCallIds.has(displayValue.toolCallId);

        if (settledApprovalToolCallReplay) {
          continue;
        }

        if (displayValue.type === 'tool-approval-request') {
          const toolCall = toolCallsByToolCallId.get(displayValue.toolCallId);
          if (toolCall == null) {
            throw new Error(
              `Harness '${input.harness.harnessId}' emitted approval request '${displayValue.approvalId}' for unknown tool call '${displayValue.toolCallId}'.`,
            );
          }
          const rawToolCall = rawToolCallsByToolCallId.get(
            displayValue.toolCallId,
          );
          const toolName = rawToolCall?.toolName ?? toolCall.toolName;
          if (
            !isHarnessV1BuiltinToolIncluded({
              toolName,
              toolFiltering: input.builtinToolFiltering,
            })
          ) {
            if (control.submitToolApproval == null) {
              throw new Error(
                `Harness '${input.harness.harnessId}' emitted a built-in tool approval request but does not support approval responses.`,
              );
            }
            await control.submitToolApproval({
              approvalId: displayValue.approvalId,
              approved: false,
              reason: getHarnessV1BuiltinToolFilteringDenialReason({
                toolName,
              }),
            });
            continue;
          }
        }

        // Forward to consumer as soon as possible.
        for (const part of translateStreamPart<TOOLS>(displayValue)) {
          result.enqueue(part);
        }

        // Tool-call validation lives here (not in translateStreamPart) because
        // schema parsing is async and needs the merged tool set in scope.
        if (displayValue.type === 'tool-call') {
          const parsed = await validateToolCall<TOOLS>({
            event: displayValue,
            tools: input.tools,
          });
          const parsedToolCall = asToolCallTextStreamPart({ part: parsed });
          rawToolCallsByToolCallId.set(displayValue.toolCallId, displayValue);
          toolCallsByToolCallId.set(displayValue.toolCallId, parsedToolCall);
          result.enqueue(parsed);
        }

        // Accumulate output content for telemetry / reporters.
        if (value.type === 'text-delta') {
          stepText += value.delta;
        } else if (value.type === 'reasoning-delta') {
          stepReasoning += value.delta;
        }

        // Telemetry: a tool execution begins on its `tool-call`.
        if (value.type === 'tool-call') {
          stepToolCalls.push({
            type: 'tool-call',
            toolCallId: value.toolCallId,
            toolName: value.toolName,
            input: value.input,
          });
          telemetry.toolStart({
            toolCallId: value.toolCallId,
            toolName: value.toolName,
            input: value.input,
          });
        }

        // Telemetry: close a tool span when its provider-executed result lands.
        if (value.type === 'tool-result') {
          telemetry.toolEnd(
            value.toolCallId,
            value.isError
              ? { ok: false, error: value.result }
              : { ok: true, output: value.result },
          );
        }

        if (value.type === 'tool-approval-request') {
          const toolCall = toolCallsByToolCallId.get(value.toolCallId);
          if (toolCall == null) {
            throw new Error(
              `Harness '${input.harness.harnessId}' emitted approval request '${value.approvalId}' for unknown tool call '${value.toolCallId}'.`,
            );
          }

          const rawToolCall = rawToolCallsByToolCallId.get(value.toolCallId);
          const pendingApproval =
            pendingApprovalsByApprovalId.get(value.approvalId) ??
            ({
              approvalId: value.approvalId,
              toolCallId: value.toolCallId,
              toolName: toolCall.toolName,
              input: rawToolCall?.input ?? JSON.stringify(toolCall.input),
              kind: 'builtin',
              providerExecuted: rawToolCall?.providerExecuted ?? true,
              ...(rawToolCall?.nativeName !== undefined
                ? { nativeName: rawToolCall.nativeName }
                : {}),
            } satisfies HarnessV1PendingToolApproval);
          pendingApprovalsByApprovalId.set(
            pendingApproval.approvalId,
            pendingApproval,
          );
          pendingApprovalsByToolCallId.set(
            pendingApproval.toolCallId,
            pendingApproval,
          );

          const continuation = continuationsByApprovalId.get(
            pendingApproval.approvalId,
          );
          if (continuation != null) {
            await processPendingApprovalContinuation(
              pendingApproval,
              continuation,
            );
            continue;
          }

          onPendingToolApproval(pendingApproval);
          enqueueApprovalRequest({
            approvalId: pendingApproval.approvalId,
            toolCall,
          });
          await finishForToolApprovalPause();
          return;
        }

        // Drive step boundaries.
        if (value.type === 'finish-step') {
          telemetry.stepFinish({
            finishReason: value.finishReason,
            usage: value.usage,
            providerMetadata: value.harnessMetadata,
            content: buildStepContent(),
          });
          resetStepContent();
          result.finishStep({
            finishReason: value.finishReason,
            usage: value.usage,
            providerMetadata: value.harnessMetadata,
            warnings: [],
          });
        }

        if (value.type === 'finish') {
          finalFinish = value;
          telemetry.end({
            finishReason: value.finishReason,
            usage: value.totalUsage,
          });
        }

        // Execute host-side tools when the harness asks for one.
        if (value.type === 'tool-call' && !value.providerExecuted) {
          const toolCall = value;
          const parsedToolCall = toolCallsByToolCallId.get(toolCall.toolCallId);
          if (parsedToolCall == null) {
            throw new Error(
              `Harness '${input.harness.harnessId}' could not find parsed tool call '${toolCall.toolCallId}' for custom tool approval.`,
            );
          }
          if (!hasTool({ tools: activeTools, toolName: toolCall.toolName })) {
            const output = {
              type: 'execution-denied',
              reason: getHarnessV1BuiltinToolFilteringDenialReason({
                toolName: toolCall.toolName,
              }),
            };
            await control.submitToolResult({
              toolCallId: toolCall.toolCallId,
              output,
            });
            telemetry.toolEnd(toolCall.toolCallId, { ok: true, output });
            continue;
          }
          const customToolApprovalDecision = resolveCustomToolApproval({
            toolName: toolCall.toolName,
            toolApproval: input.toolApproval,
          });
          if (customToolApprovalDecision.type === 'deny') {
            const approvalId = generateId();
            enqueueApprovalRequest({
              approvalId,
              toolCall: parsedToolCall,
              isAutomatic: true,
            });
            enqueueAutomaticApprovalResponse({
              approvalId,
              toolCall: parsedToolCall,
              approved: false,
              reason: customToolApprovalDecision.reason,
              providerExecuted: false,
            });
            const output = {
              type: 'execution-denied',
              reason: customToolApprovalDecision.reason,
            };
            await control.submitToolResult({
              toolCallId: toolCall.toolCallId,
              output,
            });
            telemetry.toolEnd(toolCall.toolCallId, { ok: true, output });
            continue;
          }
          const pendingApproval =
            pendingApprovalsByToolCallId.get(toolCall.toolCallId) ??
            (customToolApprovalDecision.type === 'request'
              ? ({
                  approvalId: generateId(),
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  input: toolCall.input,
                  kind: 'custom',
                  providerExecuted: false,
                  ...(toolCall.nativeName !== undefined
                    ? { nativeName: toolCall.nativeName }
                    : {}),
                } satisfies HarnessV1PendingToolApproval)
              : undefined);
          if (pendingApproval != null) {
            pendingApprovalsByApprovalId.set(
              pendingApproval.approvalId,
              pendingApproval,
            );
            pendingApprovalsByToolCallId.set(
              pendingApproval.toolCallId,
              pendingApproval,
            );
            const continuation = continuationsByApprovalId.get(
              pendingApproval.approvalId,
            );
            if (continuation != null) {
              await processPendingApprovalContinuation(
                pendingApproval,
                continuation,
              );
              continue;
            }
            const pendingParsedToolCall = toolCallsByToolCallId.get(
              pendingApproval.toolCallId,
            );
            if (pendingParsedToolCall == null) {
              throw new Error(
                `Harness '${input.harness.harnessId}' could not find parsed tool call '${pendingApproval.toolCallId}' for approval request '${pendingApproval.approvalId}'.`,
              );
            }
            onPendingToolApproval(pendingApproval);
            enqueueApprovalRequest({
              approvalId: pendingApproval.approvalId,
              toolCall: pendingParsedToolCall,
            });
            await finishForToolApprovalPause();
            return;
          }
          const outcome = await maybeExecuteHostTool({
            event: toolCall,
            tools: activeTools,
            sandboxSession: input.sandboxSession,
            abortSignal: input.abortSignal,
            control,
            onPreliminaryResult: preliminaryOutput => {
              /*
               * Project a `yield`ed value as a preliminary AI SDK
               * `tool-result` part. Unlike the final result — which is
               * submitted to the runtime, echoed back as a `tool-result`
               * event, and stripped on its way through the loop above —
               * preliminary values never reach the runtime, so strip the
               * working directory here to match the final result's projection.
               */
              const stripped = stripWorkDir(
                {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: preliminaryOutput as Extract<
                    HarnessV1StreamPart,
                    { type: 'tool-result' }
                  >['result'],
                },
                input.sessionWorkDir,
              ) as Extract<HarnessV1StreamPart, { type: 'tool-result' }>;
              result.enqueue({
                type: 'tool-result',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: undefined,
                output: stripped.result,
                preliminary: true,
              } as TextStreamPart<TOOLS>);
            },
          });
          telemetry.toolEnd(toolCall.toolCallId, outcome);
        }

        if (value.type === 'error') {
          telemetry.error(value.error);
          logBridgeError({
            harnessId: input.harness.harnessId,
            sessionId: input.session.sessionId,
            context: 'harness stream error',
            error: value.error,
          });
          result.fail(value.error);
          return;
        }
      }
      input.onTurnFinished?.();
      await result.finish(
        finalFinish
          ? {
              finishReason: finalFinish.finishReason,
              totalUsage: finalFinish.totalUsage,
              providerMetadata: finalFinish.harnessMetadata,
            }
          : undefined,
      );
    } catch (err) {
      telemetry.error(err);
      logBridgeError({
        harnessId: input.harness.harnessId,
        sessionId: input.session.sessionId,
        context: 'harness turn failed',
        error: err,
      });
      result.fail(err);
    } finally {
      reader.releaseLock();
    }
  })();

  // Swallow the loop's rejection at the top level — failures are observable
  // via the result's `fullStream` `error` part and rejected promise
  // accessors. We do not want the orphan promise to become an unhandled
  // rejection.
  done.catch(() => {});

  return { result, done };
}

type HostToolOutcome =
  | { ok: true; output: unknown }
  | { ok: false; error: unknown };

function asToolCallTextStreamPart<TOOLS extends ToolSet>(input: {
  part: TextStreamPart<TOOLS>;
}): ToolCallTextStreamPart {
  if (input.part.type !== 'tool-call') {
    throw new Error(
      `Expected parsed tool-call stream part, got '${input.part.type}'.`,
    );
  }
  return input.part as ToolCallTextStreamPart;
}

type ToolCallTextStreamPart = {
  readonly type: 'tool-call';
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly providerExecuted?: boolean;
  readonly providerMetadata?: unknown;
  readonly dynamic?: boolean;
  readonly invalid?: boolean;
  readonly error?: unknown;
  readonly title?: string;
};

function hasTool(input: { tools: ToolSet; toolName: string }): boolean {
  return Object.prototype.hasOwnProperty.call(input.tools, input.toolName);
}

async function maybeExecuteHostTool<TOOLS extends ToolSet>(input: {
  event: { toolCallId: string; toolName: string; input: string };
  tools: TOOLS;
  sandboxSession: SandboxSession;
  abortSignal: AbortSignal | undefined;
  control: HarnessV1PromptControl;
  /**
   * Called for each value a generator `execute` `yield`s before its last. The
   * caller surfaces these as preliminary `tool-result` parts on the consumer
   * stream. Never called for a plain (non-generator) `execute`.
   */
  onPreliminaryResult: (output: unknown) => void;
}): Promise<HostToolOutcome> {
  const tool = input.tools[input.event.toolName];

  if (!isExecutableTool(tool)) return { ok: true, output: undefined };

  const parsed = await safeParseJSON({ text: input.event.input });
  const args = parsed.success ? parsed.value : input.event.input;

  try {
    /*
     * Normalize the tool's return value through `executeTool`, the same helper
     * the non-harness AI SDK uses, so generator `execute` functions behave
     * identically here: each `yield`ed value arrives as a `preliminary` part
     * and the last `yield` is re-emitted as the `final` part; a plain value or
     * Promise arrives as a single `final` part. The underlying runtimes accept
     * exactly one tool result per call, so only the final value is submitted
     * back to the model — preliminary values are surfaced to the consumer
     * stream alone, matching how the AI SDK treats `onPreliminaryToolResult`.
     */
    let output: unknown;
    const stream = executeTool({
      tool,
      input: args as never,
      options: {
        toolCallId: input.event.toolCallId,
        messages: [],
        abortSignal: input.abortSignal,
        context: undefined as never,
        experimental_sandbox: input.sandboxSession,
      },
    });
    for await (const part of stream) {
      if (part.type === 'preliminary') {
        input.onPreliminaryResult(part.output);
      } else {
        output = part.output;
      }
    }

    await input.control.submitToolResult({
      toolCallId: input.event.toolCallId,
      output,
    });
    return { ok: true, output };
  } catch (err) {
    await input.control.submitToolResult({
      toolCallId: input.event.toolCallId,
      output: { error: String(err) },
      isError: true,
    });
    return { ok: false, error: err };
  }
}

/*
 * Validate an inbound `tool-call` event against the merged tool set's schema
 * using the AI SDK's canonical `parseToolCall`. Returns an AI SDK `tool-call`
 * stream part with parsed input on success, or a `dynamic + invalid: true`
 * part on failure (unknown tool, schema mismatch, malformed JSON).
 *
 * The harness `tool-call` event is structurally a `LanguageModelV4ToolCall`
 * (plus an optional harness-only `nativeName`). `providerExecuted` already
 * lives on the V4 type — `true` for adapter builtins (Claude Code's `Bash`,
 * Codex's `shell`), false/undefined for host tools — and is passed through
 * to the AI SDK part by `parseToolCall`.
 */
export async function validateToolCall<TOOLS extends ToolSet>(args: {
  event: Extract<HarnessV1StreamPart, { type: 'tool-call' }>;
  tools: TOOLS;
}): Promise<TextStreamPart<TOOLS>> {
  const { event, tools } = args;
  const toolCall: LanguageModelV4ToolCall = {
    type: 'tool-call',
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    input: event.input,
    ...(event.providerExecuted !== undefined
      ? { providerExecuted: event.providerExecuted }
      : {}),
    ...(event.providerMetadata !== undefined
      ? { providerMetadata: event.providerMetadata }
      : {}),
  };

  const parsed = await parseToolCall<TOOLS>({
    toolCall,
    tools,
    repairToolCall: undefined,
    refineToolInput: undefined,
    instructions: undefined,
    messages: [],
  });

  return parsed as TextStreamPart<TOOLS>;
}

/** Best-effort plain text of the turn's prompt, for telemetry input messages. */
function promptToText(prompt: HarnessV1Prompt): string {
  if (typeof prompt === 'string') return prompt;
  const content = (prompt as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { type: 'text'; text: string } =>
          typeof part === 'object' &&
          part != null &&
          (part as { type?: unknown }).type === 'text',
      )
      .map(part => part.text)
      .join('');
  }
  return '';
}

// keep import bound so unused-but-needed type stays cited
export type _ContentPartMarker<T extends ToolSet> = ContentPart<T>;
