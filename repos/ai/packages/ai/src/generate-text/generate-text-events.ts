import type {
  Context,
  InferToolSetContext,
  ProviderOptions,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { LanguageModelCallOptions } from '../prompt/language-model-call-options';
import type { TimeoutConfiguration } from '../prompt/request-options';
import type { StandardizedPrompt } from '../prompt/standardize-prompt';
import type { ToolChoice } from '../types/language-model';
import type { LanguageModelUsage } from '../types/usage';
import type { Callback } from '../util/callback';
import type { ActiveTools } from './active-tools';
import type { Output } from './output';
import type { ResponseMessage } from './response-message';
import type { StepResult } from './step-result';
import type { ToolOrder } from './tool-order';

/**
 * Event passed to the `onStart` callback.
 *
 * Called when the generation operation begins, before any LLM calls.
 */
export type GenerateTextStartEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output,
> = {
  /** Unique identifier for this generation call, used to correlate events. */
  readonly callId: string;

  /** Identifies the operation type (e.g. 'ai.generateText' or 'ai.streamText'). */
  // move to the telemetry dispatcher
  readonly operationId: string;

  /** The provider identifier (e.g., 'openai', 'anthropic'). */
  readonly provider: string;

  /** The specific model identifier (e.g., 'gpt-4o'). */
  readonly modelId: string;

  /** The tools available for this generation. */
  readonly tools: TOOLS | undefined;

  /** The tool choice strategy for this generation. */
  readonly toolChoice: ToolChoice<NoInfer<TOOLS>> | undefined;

  /** Limits which tools are available for the model to call. */
  readonly activeTools: ActiveTools<TOOLS>;

  /** Controls the order in which tools are sent to the provider. */
  readonly toolOrder: ToolOrder<TOOLS>;

  /** Maximum number of retries for failed requests. */
  readonly maxRetries: number;

  /**
   * Timeout configuration for the generation.
   * Can be a number (milliseconds) or an object with totalMs, stepMs, chunkMs, toolMs, and per-tool overrides via tools.
   */
  readonly timeout: TimeoutConfiguration<TOOLS> | undefined;

  /** Additional HTTP headers sent with the request. */
  readonly headers: Record<string, string | undefined> | undefined;

  /** Additional provider-specific options. */
  readonly providerOptions: ProviderOptions | undefined;

  /** The output specification for structured outputs, if configured. */
  readonly output: OUTPUT | undefined;

  /**
   * Tool context.
   */
  readonly toolsContext: InferToolSetContext<TOOLS>;

  /**
   * User-defined runtime context.
   */
  readonly runtimeContext: RUNTIME_CONTEXT;
} & LanguageModelCallOptions &
  StandardizedPrompt;

/**
 * Event passed to the `onStepStart` callback.
 *
 * Called when a step (LLM call) begins, before the provider is called.
 * Each step represents a single LLM invocation.
 */
export type GenerateTextStepStartEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output,
> = {
  /** Unique identifier for this generation call, used to correlate events. */
  readonly callId: string;

  /** The provider identifier (e.g., 'openai', 'anthropic'). */
  readonly provider: string;

  /** The specific model identifier (e.g., 'gpt-4o'). */
  readonly modelId: string;

  /** Zero-based index of the current step. */
  readonly stepNumber: number;

  /** The tools available for this generation. */
  readonly tools: TOOLS | undefined;

  /** The tool choice configuration for this step. */
  readonly toolChoice: ToolChoice<NoInfer<TOOLS>> | undefined;

  /** Limits which tools are available for this step. */
  readonly activeTools: ActiveTools<TOOLS>;

  /** Controls the order in which tools are sent to the provider for this step. */
  readonly toolOrder: ToolOrder<TOOLS>;

  /** Array of results from previous steps (empty for first step). */
  readonly steps: ReadonlyArray<StepResult<TOOLS, RUNTIME_CONTEXT>>;

  /** Additional provider-specific options for this step. */
  readonly providerOptions: ProviderOptions | undefined;

  /** The output specification for structured outputs, if configured. */
  readonly output: OUTPUT | undefined;

  /**
   * Runtime context. May be updated from `prepareStep` between steps.
   */
  readonly runtimeContext: RUNTIME_CONTEXT;

  /**
   * Tool context. May be updated from `prepareStep` between steps.
   */
  readonly toolsContext: InferToolSetContext<TOOLS>;
} & StandardizedPrompt;

/**
 * Event passed to the `onStepEnd` callback.
 *
 * Called when a step (LLM call) completes.
 * Includes the StepResult for that step along with the call identifier.
 */
export type GenerateTextStepEndEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = StepResult<TOOLS, RUNTIME_CONTEXT>;

/**
 * Event passed to the `onEnd` callback.
 *
 * Called when the entire generation completes (all steps finished).
 * Includes the final step's result along with aggregated data from all steps.
 */
export type GenerateTextEndEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = {
  /** Unique identifier for this generation call, used to correlate events. */
  readonly callId: string;

  /** Zero-based index of the final step. */
  readonly stepNumber: number;

  /** Information about the model that produced the final step. */
  readonly model: StepResult<TOOLS, RUNTIME_CONTEXT>['model'];

  /**
   * Tool context from the final step.
   *
   * @deprecated Use `finalStep.toolsContext` instead.
   */
  readonly toolsContext: InferToolSetContext<TOOLS>;

  /**
   * Runtime context from the final step.
   *
   * @deprecated Use `finalStep.runtimeContext` instead.
   */
  readonly runtimeContext: RUNTIME_CONTEXT;

  /** The content that was generated in all steps. */
  readonly content: StepResult<TOOLS, RUNTIME_CONTEXT>['content'];

  /** The text that was generated in the final step. */
  readonly text: StepResult<TOOLS, RUNTIME_CONTEXT>['text'];

  /**
   * The reasoning that was generated in the final step.
   *
   * @deprecated Use `finalStep.reasoning` instead.
   */
  readonly reasoning: StepResult<TOOLS, RUNTIME_CONTEXT>['reasoning'];

  /**
   * The reasoning text that was generated in the final step.
   *
   * @deprecated Use `finalStep.reasoningText` instead.
   */
  readonly reasoningText: StepResult<TOOLS, RUNTIME_CONTEXT>['reasoningText'];

  /** Files that were generated in all steps. */
  readonly files: StepResult<TOOLS, RUNTIME_CONTEXT>['files'];

  /** Sources that were used as references in all steps. */
  readonly sources: StepResult<TOOLS, RUNTIME_CONTEXT>['sources'];

  /** Tool calls that were made in all steps. */
  readonly toolCalls: StepResult<TOOLS, RUNTIME_CONTEXT>['toolCalls'];

  /** Static tool calls that were made in all steps. */
  readonly staticToolCalls: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['staticToolCalls'];

  /** Dynamic tool calls that were made in all steps. */
  readonly dynamicToolCalls: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['dynamicToolCalls'];

  /** Tool results that were generated in all steps. */
  readonly toolResults: StepResult<TOOLS, RUNTIME_CONTEXT>['toolResults'];

  /** Static tool results that were generated in all steps. */
  readonly staticToolResults: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['staticToolResults'];

  /** Dynamic tool results that were generated in all steps. */
  readonly dynamicToolResults: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['dynamicToolResults'];

  /** The unified reason why the generation finished. Taken from the final step. */
  readonly finishReason: StepResult<TOOLS, RUNTIME_CONTEXT>['finishReason'];

  /** The raw reason why the generation finished. Taken from the final step. */
  readonly rawFinishReason: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['rawFinishReason'];

  /** Aggregated token usage across all steps. */
  readonly usage: LanguageModelUsage;

  /**
   * Aggregated token usage across all steps.
   *
   * @deprecated Use `usage` instead.
   */
  readonly totalUsage: LanguageModelUsage;

  /** Warnings from the model provider in all steps. */
  readonly warnings: StepResult<TOOLS, RUNTIME_CONTEXT>['warnings'];

  /**
   * Additional request information from the final step.
   *
   * @deprecated Use `finalStep.request` instead.
   */
  readonly request: StepResult<TOOLS, RUNTIME_CONTEXT>['request'];

  /**
   * Additional response information from the final step.
   *
   * @deprecated Use `finalStep.response` instead.
   */
  readonly response: StepResult<TOOLS, RUNTIME_CONTEXT>['response'];

  /**
   * Additional provider-specific metadata from the final step.
   *
   * @deprecated Use `finalStep.providerMetadata` instead.
   */
  readonly providerMetadata: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['providerMetadata'];

  /** The response messages that were generated during the call. */
  readonly responseMessages: ResponseMessage[];

  /** Array containing results from all steps in the generation. */
  readonly steps: StepResult<TOOLS, RUNTIME_CONTEXT>[];

  /** The final step. This is a shortcut for `steps.at(-1)`. */
  readonly finalStep: StepResult<TOOLS, RUNTIME_CONTEXT>;
};

/**
 * Event passed to the telemetry `onAbort` callback.
 *
 * Called when a streaming text generation operation is aborted before it
 * completes.
 */
export type GenerateTextAbortEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = {
  /** Unique identifier for this generation call, used to correlate events. */
  readonly callId: string;

  /** Details for all previously finished steps. */
  readonly steps: StepResult<TOOLS, RUNTIME_CONTEXT>[];

  /** The abort reason from the AbortSignal, when one is available. */
  readonly reason?: unknown;
};

/** @deprecated Use `GenerateTextStartEvent` instead. */
export type OnStartEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output,
> = GenerateTextStartEvent<TOOLS, RUNTIME_CONTEXT, OUTPUT>;

/** @deprecated Use `GenerateTextStepStartEvent` instead. */
export type OnStepStartEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output,
> = GenerateTextStepStartEvent<TOOLS, RUNTIME_CONTEXT, OUTPUT>;

/** @deprecated Use `GenerateTextStepEndEvent` instead. */
export type OnStepFinishEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = GenerateTextStepEndEvent<TOOLS, RUNTIME_CONTEXT>;

/** @deprecated Use `GenerateTextEndEvent` instead. */
export type OnFinishEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = GenerateTextEndEvent<TOOLS, RUNTIME_CONTEXT>;

/**
 * Callback that is set using the `onStart` option.
 *
 * Called when the generateText operation begins, before any LLM calls.
 * Use this callback for logging, analytics, or initializing state at the
 * start of a generation.
 *
 * @param event - The event object containing generation configuration.
 */
export type GenerateTextOnStartCallback<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output,
> = Callback<GenerateTextStartEvent<TOOLS, RUNTIME_CONTEXT, OUTPUT>>;

/**
 * Callback that is set using the `onStepStart` option.
 *
 * Called when a step (LLM call) begins, before the provider is called.
 * Each step represents a single LLM invocation. Multiple steps occur when
 * using tool calls (the model may be called multiple times in a loop).
 *
 * @param event - The event object containing step configuration.
 */
export type GenerateTextOnStepStartCallback<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output,
> = Callback<GenerateTextStepStartEvent<TOOLS, RUNTIME_CONTEXT, OUTPUT>>;

/**
 * Callback that is set using the `onStepEnd` option.
 *
 * Called when a step (LLM call) completes. The event includes all step result
 * properties (text, tool calls, usage, etc.) along with additional metadata.
 *
 * @param stepResult - The result of the step.
 */
export type GenerateTextOnStepEndCallback<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = Callback<GenerateTextStepEndEvent<TOOLS, RUNTIME_CONTEXT>>;

/**
 * Callback that is set using the `onStepFinish` option.
 *
 * @deprecated Use `GenerateTextOnStepEndCallback` instead.
 */
export type GenerateTextOnStepFinishCallback<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = GenerateTextOnStepEndCallback<TOOLS, RUNTIME_CONTEXT>;

/**
 * Callback that is set using the `onEnd` option.
 *
 * Called when the entire generation completes (all steps finished).
 * The event includes the final step's result properties along with
 * aggregated data from all steps.
 *
 * @param event - The final result along with aggregated step data.
 */
export type GenerateTextOnEndCallback<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = Callback<GenerateTextEndEvent<TOOLS, RUNTIME_CONTEXT>>;

/**
 * Callback that is set using the telemetry `onAbort` option.
 *
 * Called when a streaming text generation operation is aborted before it
 * completes.
 *
 * @param event - The abort event, including finished steps and abort reason.
 */
export type GenerateTextOnAbortCallback<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = Callback<GenerateTextAbortEvent<TOOLS, RUNTIME_CONTEXT>>;

/**
 * Callback that is set using the `onFinish` option.
 *
 * @deprecated Use `GenerateTextOnEndCallback` instead.
 */
export type GenerateTextOnFinishCallback<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = GenerateTextOnEndCallback<TOOLS, RUNTIME_CONTEXT>;
