import type { ToolSet } from '@ai-sdk/provider-utils';
import type {
  EmbedEndEvent,
  EmbedStartEvent,
  EmbeddingModelCallEndEvent,
  EmbeddingModelCallStartEvent,
} from '../embed/embed-events';
import type {
  GenerateObjectEndEvent,
  GenerateObjectStartEvent,
  GenerateObjectStepEndEvent,
  GenerateObjectStepStartEvent,
} from '../generate-object/structured-output-events';
import type {
  GenerateTextAbortEvent,
  GenerateTextEndEvent,
  GenerateTextStartEvent,
  GenerateTextStepEndEvent,
  GenerateTextStepStartEvent,
} from '../generate-text/generate-text-events';
import type {
  LanguageModelCallEndEvent,
  LanguageModelCallStartEvent,
  OnLanguageModelCallEndCallback,
  OnLanguageModelCallStartCallback,
} from '../generate-text/language-model-events';
import type {
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from '../generate-text/tool-execution-events';
import type {
  RerankEndEvent,
  RerankStartEvent,
  RerankingModelCallEndEvent,
  RerankingModelCallStartEvent,
} from '../rerank/rerank-events';
import type { Callback } from '../util/callback';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import type { TelemetryTracingEventType } from './tracing-channel';
import type { TracingChannelContext } from './tracing-channel-publisher';

export type InferTelemetryEvent<EVENT> = EVENT &
  Omit<
    TelemetryOptions,
    'integrations' | 'isEnabled' | 'includeRuntimeContext'
  >;

type OperationStartEvent =
  | GenerateTextStartEvent
  | GenerateObjectStartEvent
  | EmbedStartEvent
  | RerankStartEvent;

type OperationEndEvent =
  | GenerateTextEndEvent<ToolSet>
  | GenerateObjectEndEvent<unknown>
  | EmbedEndEvent
  | RerankEndEvent;

export interface TelemetryDispatcher {
  /**
   * Runs awaited work inside a diagnostics-channel tracing span.
   */
  runInTracingChannelSpan?: <T>(options: {
    type: TelemetryTracingEventType;
    event: unknown;
    execute: () => PromiseLike<T>;
  }) => Promise<T>;

  /**
   * Opens a tracing span context whose completion is observed separately.
   * This is used by streamed operations that must preserve stream timing while
   * still creating child spans with the correct parent.
   */
  startTracingChannelContext?: (options: {
    type: TelemetryTracingEventType;
    event: unknown;
    completion: PromiseLike<unknown>;
  }) => TracingChannelContext | undefined;
  onStart?: Callback<OperationStartEvent>;
  onStepStart?: Callback<GenerateTextStepStartEvent>;
  onLanguageModelCallStart?: OnLanguageModelCallStartCallback;
  onLanguageModelCallEnd?: OnLanguageModelCallEndCallback;
  onToolExecutionStart?: Callback<ToolExecutionStartEvent>;
  onToolExecutionEnd?: Callback<ToolExecutionEndEvent>;
  onStepEnd?: Callback<GenerateTextStepEndEvent>;
  /** @deprecated Use `onStepEnd` instead. */
  onStepFinish?: Callback<GenerateTextStepEndEvent>;
  onObjectStepStart?: Callback<GenerateObjectStepStartEvent>;
  onObjectStepEnd?: Callback<GenerateObjectStepEndEvent>;
  onEmbedStart?: Callback<EmbeddingModelCallStartEvent>;
  onEmbedEnd?: Callback<EmbeddingModelCallEndEvent>;
  onRerankStart?: Callback<RerankingModelCallStartEvent>;
  onRerankEnd?: Callback<RerankingModelCallEndEvent>;
  onEnd?: Callback<OperationEndEvent>;
  onAbort?: Callback<GenerateTextAbortEvent<ToolSet>>;
  onError?: Callback<unknown>;
  executeLanguageModelCall?: Telemetry['executeLanguageModelCall'];
  executeTool?: Telemetry['executeTool'];
}

/**
 * Implement this interface to create custom telemetry integrations.
 * Methods can be sync or return a PromiseLike.
 */
export interface Telemetry {
  /**
   * Called when an operation begins. Fired for text generation
   * (generateText/streamText), object generation (generateObject/streamObject),
   * embedding (embed/embedMany), and reranking operations.
   *
   * Use the `operationId` field to distinguish between operation types.
   */
  onStart?: Callback<InferTelemetryEvent<OperationStartEvent>>;

  /**
   * Called when an individual step (single LLM invocation) begins.
   * A generation may consist of multiple steps (e.g. when tool calls trigger
   * follow-up LLM calls). Use this to create per-step spans or record
   * step-level inputs.
   *
   * The event includes the step number, accumulated previous step results,
   * and the messages that will be sent to the model.
   */
  onStepStart?: Callback<InferTelemetryEvent<GenerateTextStepStartEvent>>;

  /**
   * Called immediately before the provider model call begins.
   * Unlike `onStepStart`, this callback is scoped to model work only and
   * excludes any later client-side tool execution.
   */
  onLanguageModelCallStart?: Callback<
    InferTelemetryEvent<LanguageModelCallStartEvent>
  >;

  /**
   * Called after the model response has been normalized and parsed, but before
   * any client-side tool execution begins.
   */
  onLanguageModelCallEnd?: Callback<
    InferTelemetryEvent<LanguageModelCallEndEvent>
  >;

  /**
   * Called when a tool execution begins, before the tool's `execute` function
   * is invoked. Use this to create tool-level spans or log tool invocations.
   */
  onToolExecutionStart?: Callback<InferTelemetryEvent<ToolExecutionStartEvent>>;

  /**
   * Called when a tool execution completes, either successfully or with an error.
   * The event uses a discriminated union on the `success` field — check
   * `event.success` to determine whether `output` or `error` is available.
   *
   * The event includes execution time (`toolExecutionMs`) for performance tracking.
   */
  onToolExecutionEnd?: Callback<InferTelemetryEvent<ToolExecutionEndEvent>>;

  /**
   * Called when an individual step (single LLM invocation) completes.
   * The event is a `StepResult` containing the model's response, tool calls
   * and results, usage statistics, finish reason, and optional request/response
   * bodies.
   */
  onStepEnd?: Callback<InferTelemetryEvent<GenerateTextStepEndEvent>>;

  /**
   * Called when an individual step (single LLM invocation) completes.
   *
   * @deprecated Use `onStepEnd` instead.
   */
  onStepFinish?: Callback<InferTelemetryEvent<GenerateTextStepEndEvent>>;

  /**
   * Called when an object generation step (single LLM invocation) begins.
   * For generateObject/streamObject there is always exactly one step.
   *
   * @deprecated
   */
  onObjectStepStart?: Callback<
    InferTelemetryEvent<GenerateObjectStepStartEvent>
  >;

  /**
   * Called when an object generation step (single LLM invocation) completes,
   * with the raw result before JSON parsing and schema validation.
   *
   * @deprecated
   */
  onObjectStepEnd?: Callback<InferTelemetryEvent<GenerateObjectStepEndEvent>>;

  /**
   * Called when an individual embedding model call (doEmbed) begins.
   * For `embed`, there is one call. For `embedMany`, there may be multiple
   * calls when values are chunked.
   */
  onEmbedStart?: Callback<InferTelemetryEvent<EmbeddingModelCallStartEvent>>;

  /**
   * Called when an individual embedding model call (doEmbed) completes.
   * Contains the embeddings, usage, and any warnings from the model response.
   */
  onEmbedEnd?: Callback<InferTelemetryEvent<EmbeddingModelCallEndEvent>>;

  /**
   * Called when an individual reranking model call (doRerank) begins.
   * There is one call per `rerank` invocation.
   */
  onRerankStart?: Callback<InferTelemetryEvent<RerankingModelCallStartEvent>>;

  /**
   * Called when an individual reranking model call (doRerank) completes.
   * Contains the ranking results from the model response.
   */
  onRerankEnd?: Callback<InferTelemetryEvent<RerankingModelCallEndEvent>>;

  /**
   * Called when an operation completes. Fired for text generation
   * (generateText/streamText), object generation (generateObject/streamObject),
   * embedding (embed/embedMany), and reranking operations.
   *
   * Use the event shape or `operationId` to distinguish between operation types.
   */
  onEnd?: Callback<InferTelemetryEvent<OperationEndEvent>>;

  /**
   * Called when a streaming text generation operation is aborted before it
   * completes.
   */
  onAbort?: Callback<InferTelemetryEvent<GenerateTextAbortEvent<ToolSet>>>;

  /**
   * Called when an unrecoverable error occurs during the generation lifecycle.
   * The error value is untyped — it may be an `Error` instance, an `AISDKError`,
   * or any thrown value.
   *
   * Use this to record error details on telemetry spans and set error status.
   */
  onError?: Callback<unknown>;

  /**
   * Optionally runs the language model call in a telemetry-integration-specific context. This enables
   * auto-instrumented model provider requests to become children of the current
   * model-call span.
   *
   * The options carry the model-call start-event content as context (the event
   * fields are optional), alongside the always-present `callId` and the
   * `execute` function that performs the model call.
   */
  executeLanguageModelCall?: <T>(
    options: Partial<InferTelemetryEvent<LanguageModelCallStartEvent>> & {
      callId: string;
      execute: () => PromiseLike<T>;
    },
  ) => PromiseLike<T>;

  /**
   * Optionally runs the tool execute function in a telemetry-integration-specific context. This enables
   * nested traces — e.g. when a tool's `execute` function calls `generateText`,
   * the inner call's spans become children of the tool span.
   *
   * The options carry the tool-execution start-event content as context (the
   * event fields are optional), alongside the always-present `callId`,
   * `toolCallId`, and the `execute` function to run.
   */
  executeTool?: <T>(
    options: Partial<InferTelemetryEvent<ToolExecutionStartEvent>> & {
      callId: string;
      toolCallId: string;
      execute: () => PromiseLike<T>;
    },
  ) => PromiseLike<T>;
}
