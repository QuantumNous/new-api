import { generateId, type ModelMessage } from '@ai-sdk/provider-utils';
import { createTelemetryDispatcher } from 'ai/internal';
import type { TelemetryOptions } from 'ai';

/*
 * Drives AI SDK's pluggable `Telemetry` lifecycle from a harness turn.
 *
 * A harness turn is not a `streamText` call — it has no language model, prompt
 * standardization, or sampling settings — but the AI SDK telemetry contract is
 * shaped around `generateText`/`streamText` events, and `@ai-sdk/otel` (the
 * main integration) only produces spans when the full lifecycle fires. So we
 * map the turn onto that contract: turn = operation, each `finish-step` = a
 * step boundary, tool-calls = tool executions, `finish` = operation end. The
 * model-call-only event fields the harness has no value for (sampling params,
 * standardized prompt) are left `undefined` / cast; the fields the integrations
 * actually read (`callId`, `operationId`, `provider`, `modelId`, `messages`,
 * `toolCall`, `usage`, `finishReason`) carry real values.
 *
 * Telemetry is opt-in: the framework only drives it when `settings.telemetry`
 * is set (the dispatcher then also honours globally-registered integrations).
 */

type Dispatcher = ReturnType<typeof createTelemetryDispatcher>;
type EventArg<K extends keyof Dispatcher> = Dispatcher[K] extends
  | ((event: infer E) => unknown)
  | undefined
  ? E
  : never;

/**
 * An output content part accumulated over a step — the model's assistant turn.
 * Shaped for the gen_ai output-message conventions `@ai-sdk/otel` reads.
 */
export type TurnContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown };

export interface TurnTelemetry {
  /**
   * Begin the operation span. Called on `stream-start`, optionally with the
   * model the runtime resolved to (overriding the session's configured id).
   * Idempotent — the first call wins.
   */
  start(modelId?: string): void;
  /** Open a step span lazily, before the first content of a step. */
  ensureStepOpen(): void;
  /** Close the current step (on a harness `finish-step`). */
  stepFinish(info: {
    finishReason: unknown;
    usage: unknown;
    providerMetadata?: unknown;
    /** The model's output content for this step (text/reasoning/tool-calls). */
    content?: TurnContentPart[];
  }): void;
  /** A tool execution began (on a `tool-call`). */
  toolStart(call: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  }): void;
  /**
   * A tool execution completed (on its `tool-result` or after host execution).
   * Idempotent per `toolCallId` — the first caller wins, so provider-executed
   * and host-executed paths can both call it without double-counting.
   */
  toolEnd(
    toolCallId: string,
    output: { ok: true; output: unknown } | { ok: false; error: unknown },
  ): void;
  /** The turn ended (on a harness `finish`). */
  end(info: { finishReason: unknown; usage: unknown }): void;
  /** The turn failed. */
  error(err: unknown): void;
}

const NOOP: TurnTelemetry = {
  start() {},
  ensureStepOpen() {},
  stepFinish() {},
  toolStart() {},
  toolEnd() {},
  end() {},
  error() {},
};

export function createTurnTelemetry(opts: {
  telemetry: TelemetryOptions | undefined;
  harnessId: string;
  modelId: string | undefined;
  instructions: string | undefined;
  promptText: string;
  runtimeContext: unknown;
}): TurnTelemetry {
  // Opt-in: with no telemetry settings we do no work and construct no events.
  if (opts.telemetry == null) return NOOP;

  const dispatcher = createTelemetryDispatcher({ telemetry: opts.telemetry });

  const callId = generateId();
  const provider = opts.harnessId;
  // The configured session model; `start(modelId)` may override it with the
  // model the runtime actually resolved to.
  let modelId = opts.modelId ?? '';
  const runtimeContext = opts.runtimeContext;
  const inputMessages: ModelMessage[] = [
    { role: 'user', content: opts.promptText },
  ];

  let started = false;
  let stepOpen = false;
  let stepNumber = 0;
  let ended = false;
  /** Tool calls started in the current turn and not yet ended. */
  const openTools = new Map<
    string,
    { toolCallId: string; toolName: string; input: unknown }
  >();

  const cast = <K extends keyof Dispatcher>(event: unknown): EventArg<K> =>
    event as EventArg<K>;

  // onStart — open the operation (root) span. Deferred until `start()` so the
  // runtime-resolved model can be attached to the operation span + trace label.
  const fireStart = (): void => {
    if (started) return;
    started = true;
    dispatcher.onStart?.(
      cast<'onStart'>({
        callId,
        operationId: 'ai.harness',
        provider,
        modelId,
        tools: undefined,
        toolChoice: undefined,
        activeTools: undefined,
        maxRetries: 0,
        timeout: undefined,
        headers: undefined,
        providerOptions: undefined,
        output: undefined,
        toolsContext: undefined,
        runtimeContext,
        instructions: opts.instructions,
        messages: inputMessages,
      }),
    );
  };

  const start = (overrideModelId?: string): void => {
    if (started) return;
    if (overrideModelId) modelId = overrideModelId;
    fireStart();
  };

  const ensureStepOpen = (): void => {
    if (!started) fireStart();
    if (stepOpen || ended) return;
    stepOpen = true;
    dispatcher.onStepStart?.(
      cast<'onStepStart'>({
        callId,
        provider,
        modelId,
        stepNumber,
        tools: undefined,
        toolChoice: undefined,
        activeTools: undefined,
        steps: new Array(stepNumber),
        providerOptions: undefined,
        output: undefined,
        runtimeContext,
        messages: inputMessages,
      }),
    );
    // Open the inference (language-model call) span — the gen_ai home for the
    // step's input and (on end) output messages.
    dispatcher.onLanguageModelCallStart?.(
      cast<'onLanguageModelCallStart'>({
        callId,
        provider,
        modelId,
        messages: inputMessages,
        tools: undefined,
      }),
    );
  };

  /** Close the inference span with the step's output content. */
  const inferenceEnd = (info: {
    finishReason: unknown;
    usage: unknown;
    content: TurnContentPart[];
  }): void => {
    dispatcher.onLanguageModelCallEnd?.(
      cast<'onLanguageModelCallEnd'>({
        callId,
        finishReason: info.finishReason,
        responseId: callId,
        usage: info.usage,
        content: info.content,
      }),
    );
  };

  const closeOpenTools = (): void => {
    for (const call of openTools.values()) {
      dispatcher.onToolExecutionEnd?.(
        cast<'onToolExecutionEnd'>({
          callId,
          toolExecutionMs: 0,
          messages: [],
          toolCall: {
            type: 'tool-call',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            dynamic: true,
          },
          toolContext: undefined,
          toolOutput: { type: 'error', error: new Error('tool span unclosed') },
        }),
      );
    }
    openTools.clear();
  };

  return {
    start,
    ensureStepOpen,

    stepFinish(info) {
      if (!stepOpen) return;
      const content = info.content ?? [];
      closeOpenTools();
      inferenceEnd({
        finishReason: info.finishReason,
        usage: info.usage,
        content,
      });
      dispatcher.onStepEnd?.(
        cast<'onStepEnd'>({
          callId,
          finishReason: info.finishReason,
          usage: info.usage,
          providerMetadata: info.providerMetadata,
          content,
          response: {
            id: callId,
            modelId,
            timestamp: new Date(0),
            messages: [],
          },
        }),
      );
      stepOpen = false;
      stepNumber += 1;
    },

    toolStart(call) {
      ensureStepOpen();
      openTools.set(call.toolCallId, call);
      dispatcher.onToolExecutionStart?.(
        cast<'onToolExecutionStart'>({
          callId,
          messages: [],
          toolCall: {
            type: 'tool-call',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            dynamic: true,
          },
          toolContext: undefined,
        }),
      );
    },

    toolEnd(toolCallId, output) {
      const call = openTools.get(toolCallId);
      if (call == null) return;
      openTools.delete(toolCallId);
      dispatcher.onToolExecutionEnd?.(
        cast<'onToolExecutionEnd'>({
          callId,
          toolExecutionMs: 0,
          messages: [],
          toolCall: {
            type: 'tool-call',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: call.input,
            dynamic: true,
          },
          toolContext: undefined,
          toolOutput: output.ok
            ? { type: 'tool-result', output: output.output }
            : { type: 'error', error: output.error },
        }),
      );
    },

    end(info) {
      if (ended) return;
      if (!started) fireStart();
      if (stepOpen) {
        closeOpenTools();
        inferenceEnd({
          finishReason: info.finishReason,
          usage: info.usage,
          content: [],
        });
        dispatcher.onStepEnd?.(
          cast<'onStepEnd'>({
            callId,
            finishReason: info.finishReason,
            usage: info.usage,
            providerMetadata: undefined,
            content: [],
            response: {
              id: callId,
              modelId,
              timestamp: new Date(0),
              messages: [],
            },
          }),
        );
        stepOpen = false;
      }
      ended = true;
      dispatcher.onEnd?.(
        cast<'onEnd'>({
          callId,
          operationId: 'ai.harness',
          finishReason: info.finishReason,
          usage: info.usage,
          totalUsage: info.usage,
          content: [],
          steps: new Array(stepNumber),
          response: {
            id: callId,
            modelId,
            timestamp: new Date(0),
            messages: [],
          },
          runtimeContext,
        }),
      );
    },

    error(err) {
      if (ended) return;
      if (!started) fireStart();
      closeOpenTools();
      ended = true;
      dispatcher.onError?.(err);
    },
  };
}
