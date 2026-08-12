import {
  getErrorMessage,
  UnsupportedFunctionalityError,
  type LanguageModelV4,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  asArray,
  createIdGenerator,
  DelayedPromise,
  filterNullable,
  isAbortError,
  type Arrayable,
  type Context,
  type Experimental_SandboxSession as SandboxSession,
  type IdGenerator,
  type InferToolSetContext,
  type ModelMessage,
  type ProviderOptions,
  type ToolApprovalResponse,
  type ToolContent,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import type { ServerResponse } from 'node:http';
import { NoOutputGeneratedError } from '../error';
import { logWarnings } from '../logger/log-warnings';
import { resolveLanguageModel } from '../model/resolve-model';
import { cloneModelMessages } from '../prompt/clone-model-message';
import { createToolModelOutput } from '../prompt/create-tool-model-output';
import type { LanguageModelCallOptions } from '../prompt/language-model-call-options';
import { prepareLanguageModelCallOptions } from '../prompt/prepare-language-model-call-options';
import { prepareToolChoice } from '../prompt/prepare-tool-choice';
import { prepareTools } from '../prompt/prepare-tools';
import type { Prompt } from '../prompt/prompt';
import {
  getChunkTimeoutMs,
  getStepTimeoutMs,
  getTotalTimeoutMs,
  type RequestOptions,
  type TimeoutConfiguration,
} from '../prompt/request-options';
import { standardizePrompt } from '../prompt/standardize-prompt';
import { wrapGatewayError } from '../prompt/wrap-gateway-error';
import type { TelemetryDispatcher } from '../telemetry/telemetry';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import { createTextStreamResponse } from '../text-stream/create-text-stream-response';
import { pipeTextStreamToResponse } from '../text-stream/pipe-text-stream-to-response';
import { toTextStream } from '../text-stream/to-text-stream';
import type { LanguageModelRequestMetadata } from '../types';
import type {
  CallWarning,
  FinishReason,
  LanguageModel,
  ToolChoice,
} from '../types/language-model';
import type { ProviderMetadata } from '../types/provider-metadata';
import {
  addLanguageModelUsage,
  createNullLanguageModelUsage,
  type LanguageModelUsage,
} from '../types/usage';
import type { UIMessage } from '../ui';
import { createUIMessageStreamResponse } from '../ui-message-stream/create-ui-message-stream-response';
import { pipeUIMessageStreamToResponse } from '../ui-message-stream/pipe-ui-message-stream-to-response';
import { toUIMessageStream as toUIMessageStreamHelper } from '../ui-message-stream/to-ui-message-stream';
import type { InferUIMessageChunk } from '../ui-message-stream/ui-message-chunks';
import type { UIMessageStreamResponseInit } from '../ui-message-stream/ui-message-stream-response-init';
import {
  createAsyncIterableStream,
  type AsyncIterableStream,
} from '../util/async-iterable-stream';
import type { Callback } from '../util/callback';
import { consumeStream } from '../util/consume-stream';
import { createIdMap } from '../util/create-id-map';
import { createStitchableStream } from '../util/create-stitchable-stream';
import type { DownloadFunction } from '../util/download/download-function';
import { mergeAbortSignals } from '../util/merge-abort-signals';
import { mergeObjects } from '../util/merge-objects';
import { notify } from '../util/notify';
import { now as originalNow } from '../util/now';
import { prepareRetries } from '../util/prepare-retries';
import { setAbortTimeout } from '../util/set-abort-timeout';
import type { ActiveTools } from './active-tools';
import { collectToolApprovals } from './collect-tool-approvals';
import type { ContentPart } from './content-part';
import {
  executeToolsFromStream,
  type ExecuteToolsStreamPart,
} from './execute-tools-from-stream';
import { executeToolCall } from './execute-tool-call';
import {
  filterActiveTools,
  type ActiveToolSubset,
} from './filter-active-tools';
import type {
  GenerateTextOnEndCallback,
  GenerateTextOnStartCallback,
  GenerateTextOnStepEndCallback,
  GenerateTextOnStepFinishCallback,
  GenerateTextOnStepStartCallback,
} from './generate-text-events';
import { invokeToolCallbacksFromStream } from './invoke-tool-callbacks-from-stream';
import type {
  OnLanguageModelCallEndCallback,
  OnLanguageModelCallStartCallback,
} from './language-model-events';
import { text, type Output } from './output';
import type {
  InferCompleteOutput,
  InferElementOutput,
  InferPartialOutput,
} from './output-utils';
import type { PrepareStepFunction } from './prepare-step';
import { convertToReasoningOutputs } from './reasoning-output';
import type { ResponseMessage } from './response-message';
import { createRestrictedTelemetryDispatcher } from './restricted-telemetry-dispatcher';
import {
  DefaultStepResult,
  type StepResult,
  type StepResultPerformance,
} from './step-result';
import {
  isStepCount,
  isStopConditionMet,
  type StopCondition,
} from './stop-condition';
import { streamLanguageModelCall } from './stream-language-model-call';
import type {
  ConsumeStreamOptions,
  StreamTextResult,
  TextStreamPart,
  UIMessageStreamOptions,
} from './stream-text-result';
import { toResponseMessages } from './to-response-messages';
import type { ToolApprovalConfiguration } from './tool-approval-configuration';
import type { TypedToolCall } from './tool-call';
import type { ToolCallRepairFunction } from './tool-call-repair-function';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
} from './tool-execution-events';
import type { ToolInputRefinement } from './tool-input-refinement';
import type { ToolOrder } from './tool-order';
import type { ToolOutput } from './tool-output';
import type { StaticToolOutputDenied } from './tool-output-denied';
import type { ToolsContextParameter } from './tools-context-parameter';
import { validateApprovedToolApprovals } from './validate-tool-approvals';

const originalGenerateId = createIdGenerator({
  prefix: 'aitxt',
  size: 24,
});

const originalGenerateCallId = createIdGenerator({
  prefix: 'call',
  size: 24,
});

// chunk types that count as model output; used to distinguish empty
// incomplete streams from incomplete streams with partial results.
// exhaustive so that new chunk types must be classified explicitly:
const isOutputChunkType = {
  file: true,
  custom: true,
  source: true,
  'text-start': true,
  'text-end': true,
  'text-delta': true,
  'reasoning-start': true,
  'reasoning-end': true,
  'reasoning-delta': true,
  'reasoning-file': true,
  'tool-input-start': true,
  'tool-input-end': true,
  'tool-input-delta': true,
  'tool-approval-request': true,
  'tool-approval-response': true,
  'tool-call': true,
  'tool-result': true,
  'tool-error': true,
  'tool-execution-end': false,
  'model-call-start': false,
  'model-call-response-metadata': false,
  'model-call-end': false,
  error: false,
  raw: false,
} as const satisfies Record<ExecuteToolsStreamPart['type'], boolean>;

export type StreamTextInclude = {
  /**
   * Whether to retain the request body in step results.
   * The request body can be large when sending images or files.
   *
   * @default false
   */
  requestBody?: boolean;

  /**
   * Whether to retain the request messages in step results.
   * The request messages can be large when sending images or files.
   *
   * @default false
   */
  requestMessages?: boolean;

  /**
   * Whether to include raw chunks from the provider in the stream.
   *
   * When enabled, you will receive raw chunks with type 'raw' that contain
   * the unprocessed data from the provider.
   *
   * This allows access to cutting-edge provider features not yet wrapped by
   * the AI SDK.
   *
   * @default false
   */
  rawChunks?: boolean;
};

/**
 * A transformation that is applied to the stream.
 *
 * @param stopStream - A function that stops the source stream.
 * @param tools - The tools that are accessible to and can be called by the model. The model needs to support calling tools.
 */
export type StreamTextTransform<TOOLS extends ToolSet> = (options: {
  tools: TOOLS; // for type inference
  stopStream: () => void;
}) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>;

/**
 * Callback that is set using the `onError` option.
 *
 * @param event - The event that is passed to the callback.
 */
export type StreamTextOnErrorCallback = Callback<{
  error: unknown;
}>;

/**
 * Callback that is set using the `onChunk` option.
 *
 * @param event - The event that is passed to the callback.
 */
export type StreamTextOnChunkCallback<TOOLS extends ToolSet> = (event: {
  chunk: TextStreamPart<TOOLS>;
}) => PromiseLike<void> | void;

/**
 * Callback that is set using the `onAbort` option.
 *
 * @param event - The event that is passed to the callback.
 */
export type StreamTextOnAbortCallback<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
> = Callback<{
  /**
   * Details for all previously finished steps.
   */
  readonly steps: StepResult<TOOLS, RUNTIME_CONTEXT>[];
}>;

/**
 * Generate a text and call tools for a given prompt using a language model.
 *
 * This function streams the output. If you do not want to stream the output, use `generateText` instead.
 *
 * @param model - The language model to use.
 * @param tools - Tools that are accessible to and can be called by the model. The model needs to support calling tools.
 * @param toolOrder - Controls the order in which tools are sent to the provider. Tools not listed are appended alphabetically.
 *
 * @param system - A system message that will be part of the prompt.
 * @param prompt - A simple text prompt. You can either use `prompt` or `messages` but not both.
 * @param messages - A list of messages. You can either use `prompt` or `messages` but not both.
 * @param allowSystemInMessages - Whether system messages are allowed in the `prompt` or `messages` fields. Default: false.
 *
 * @param maxOutputTokens - Maximum number of tokens to generate.
 * @param temperature - Temperature setting.
 * The value is passed through to the provider. The range depends on the provider and model.
 * It is recommended to set either `temperature` or `topP`, but not both.
 * @param topP - Nucleus sampling.
 * The value is passed through to the provider. The range depends on the provider and model.
 * It is recommended to set either `temperature` or `topP`, but not both.
 * @param topK - Only sample from the top K options for each subsequent token.
 * Used to remove "long tail" low probability responses.
 * Recommended for advanced use cases only. You usually only need to use temperature.
 * @param presencePenalty - Presence penalty setting.
 * It affects the likelihood of the model to repeat information that is already in the prompt.
 * The value is passed through to the provider. The range depends on the provider and model.
 * @param frequencyPenalty - Frequency penalty setting.
 * It affects the likelihood of the model to repeatedly use the same words or phrases.
 * The value is passed through to the provider. The range depends on the provider and model.
 * @param stopSequences - Stop sequences.
 * If set, the model will stop generating text when one of the stop sequences is generated.
 * @param seed - The seed (integer) to use for random sampling.
 * If set and supported by the model, calls will generate deterministic results.
 *
 * @param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
 * @param abortSignal - An optional abort signal that can be used to cancel the call.
 * @param timeout - An optional timeout in milliseconds. The call will be aborted if it takes longer than the specified timeout.
 * @param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.
 *
 * @param experimental_sandbox - The sandbox environment that is passed through to tool execution.
 * @param runtimeContext - User-defined runtime context that flows through the entire generation lifecycle.
 * @param experimental_refineToolInput - Optional mapping of tool names to functions that refine parsed tool inputs before tools are executed and before outputs, callbacks, and telemetry are recorded.
 *
 * @param onChunk - Callback that is called for each chunk of the stream. The stream processing will pause until the callback promise is resolved.
 * @param onError - Callback that is called when an error occurs during streaming. You can use it to log errors.
 * @param onStart - Callback invoked when generation begins, before any LLM calls.
 * @param experimental_onStart - Deprecated alias for `onStart`.
 * @param onStepStart - Callback invoked when each step begins, before the provider is called.
 * @param experimental_onStepStart - Deprecated alias for `onStepStart`.
 * @param onLanguageModelCallStart - Callback invoked immediately before each provider model call begins.
 * @param experimental_onLanguageModelCallStart - Deprecated alias for `onLanguageModelCallStart`.
 * @param onLanguageModelCallEnd - Callback invoked after each provider model call response is normalized and parsed.
 * @param experimental_onLanguageModelCallEnd - Deprecated alias for `onLanguageModelCallEnd`.
 * @param onToolExecutionStart - Callback invoked before each tool execution begins.
 * @param experimental_onToolCallStart - Deprecated alias for `onToolExecutionStart`.
 * @param onToolExecutionEnd - Callback invoked after each tool execution completes.
 * @param experimental_onToolCallFinish - Deprecated alias for `onToolExecutionEnd`.
 * @param onStepEnd - Callback that is called when each step (LLM call) ends, including intermediate steps.
 * @param onStepFinish - Deprecated alias for `onStepEnd`.
 * @param onEnd - Callback that is called when all steps are finished and the response is complete.
 * @param onFinish - Deprecated alias for `onEnd`.
 *
 * @returns
 * A result object for accessing different stream types and additional information.
 */
export function streamText<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output<string, string, never>,
>({
  model,
  tools,
  toolChoice,
  instructions,
  system,
  prompt,
  messages,
  allowSystemInMessages,
  maxRetries,
  abortSignal,
  timeout,
  headers,
  stopWhen = isStepCount(1),
  experimental_sandbox: sandbox,
  output,
  toolApproval,
  experimental_toolApprovalSecret,
  experimental_telemetry,
  telemetry = experimental_telemetry,
  prepareStep,
  providerOptions,
  activeTools,
  toolOrder,
  experimental_repairToolCall: repairToolCall,
  experimental_refineToolInput: refineToolInput,
  experimental_transform: transform,
  experimental_download: download,
  includeRawChunks,
  onChunk,
  onError = ({ error }) => {
    console.error(error);
  },
  onFinish,
  onEnd = onFinish,
  onAbort,
  onStepEnd,
  onStepFinish,
  onStart,
  experimental_onStart,
  onStepStart,
  experimental_onStepStart,
  onLanguageModelCallStart,
  experimental_onLanguageModelCallStart,
  onLanguageModelCallEnd,
  experimental_onLanguageModelCallEnd,
  onToolExecutionStart,
  onToolExecutionEnd,
  experimental_onToolCallStart,
  experimental_onToolCallFinish,
  runtimeContext = {} as RUNTIME_CONTEXT,
  toolsContext = {} as InferToolSetContext<TOOLS>,
  experimental_include,
  include = experimental_include,
  _internal: {
    now = originalNow,
    generateId = originalGenerateId,
    generateCallId = originalGenerateCallId,
  } = {},
  ...settings
}: LanguageModelCallOptions &
  RequestOptions<TOOLS> &
  Prompt &
  ToolsContextParameter<TOOLS> & {
    /**
     * The language model to use.
     */
    model: LanguageModel;

    /**
     * The tool choice strategy. Default: 'auto'.
     */
    toolChoice?: ToolChoice<TOOLS>;

    /**
     * Condition for stopping the generation when there are tool results in the last step.
     * When the condition is an array, any of the conditions can be met to stop the generation.
     *
     * @default isStepCount(1)
     */
    stopWhen?: Arrayable<StopCondition<NoInfer<TOOLS>, RUNTIME_CONTEXT>>;

    /**
     * Optional telemetry configuration.
     */
    telemetry?: TelemetryOptions<RUNTIME_CONTEXT, NoInfer<TOOLS>>;

    /**
     * Optional telemetry configuration.
     *
     * @deprecated Use `telemetry` instead. This alias will be removed in a future major release.
     */
    experimental_telemetry?: TelemetryOptions<RUNTIME_CONTEXT, NoInfer<TOOLS>>;

    /**
     * Additional provider-specific options. They are passed through
     * to the provider from the AI SDK and enable provider-specific
     * functionality that can be fully encapsulated in the provider.
     */
    providerOptions?: ProviderOptions;

    /**
     * The sandbox environment that is passed through to tool execution.
     */
    experimental_sandbox?: SandboxSession;

    /**
     * Runtime context. Treat runtime context as immutable.
     * If you need to mutate runtime context, update it in `prepareStep`.
     */
    runtimeContext?: RUNTIME_CONTEXT;

    /**
     * Limits the tools that are available for the model to call without
     * changing the tool call and result types in the result.
     */
    activeTools?: ActiveTools<NoInfer<TOOLS>>;

    /**
     * Controls the order in which tools are sent to the provider.
     *
     * The list can be partial. Tools not listed in `toolOrder` are sent after
     * the listed tools, sorted alphabetically. This can improve provider-side
     * caching by keeping tool definitions in a stable order.
     */
    toolOrder?: ToolOrder<NoInfer<TOOLS>>;

    /**
     * Optional specification for parsing structured outputs from the LLM response.
     */
    output?: OUTPUT;

    /**
     * Optional tool approval configuration.
     *
     * This configuration takes precedence over tool-defined approval settings.
     */
    toolApproval?: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT>;

    /**
     * Secret for HMAC-signing tool approval requests. When set, the server
     * signs each approval request at issuance and verifies the signature when
     * the approval is replayed, preventing client-forged approvals.
     */
    experimental_toolApprovalSecret?: string | Uint8Array;

    /**
     * Optional function that you can use to provide different settings for a step.
     *
     * @param options - The options for the step.
     * @param options.steps - The steps that have been executed so far.
     * @param options.stepNumber - The number of the step that is being executed.
     * @param options.model - The model that is being used.
     *
     * @returns An object that contains the settings for the step.
     * If you return undefined (or for undefined settings), the settings from the outer level will be used.
     */
    prepareStep?: PrepareStepFunction<NoInfer<TOOLS>, RUNTIME_CONTEXT>;

    /**
     * A function that attempts to repair a tool call that failed to parse.
     */
    experimental_repairToolCall?: ToolCallRepairFunction<TOOLS>;

    /**
     * Optional mapping of tool names to functions that refine parsed tool inputs.
     *
     * The refined input must have the same type shape as the tool input. Refined
     * inputs are used for tool execution, stream parts, callbacks, and telemetry.
     */
    experimental_refineToolInput?: ToolInputRefinement<NoInfer<TOOLS>>;

    /**
     * Optional stream transformations.
     * They are applied in the order they are provided.
     * The stream transformations must maintain the stream structure for streamText to work correctly.
     */
    experimental_transform?: Arrayable<StreamTextTransform<TOOLS>>;

    /**
     * Custom download function to use for URLs.
     *
     * By default, files are downloaded if the model does not support the URL for the given media type.
     */
    experimental_download?: DownloadFunction | undefined;

    /**
     * Whether to include raw chunks from the provider in the stream.
     * When enabled, you will receive raw chunks with type 'raw' that contain the unprocessed data from the provider.
     * This allows access to cutting-edge provider features not yet wrapped by the AI SDK.
     * Defaults to false.
     *
     * @deprecated Use `include.rawChunks` instead.
     */
    includeRawChunks?: boolean;

    /**
     * Callback that is called for each chunk of the stream.
     * The stream processing will pause until the callback promise is resolved.
     */
    onChunk?: StreamTextOnChunkCallback<TOOLS>;

    /**
     * Callback that is invoked when an error occurs during streaming.
     * You can use it to log errors.
     * The stream processing will pause until the callback promise is resolved.
     */
    onError?: StreamTextOnErrorCallback;

    /**
     * Callback that is called when the LLM response and all request tool executions
     * (for tools that have an `execute` function) are finished.
     *
     * The usage is the combined usage of all steps.
     */
    onEnd?: GenerateTextOnEndCallback<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>;

    /**
     * Callback that is called when the LLM response and all request tool executions
     * (for tools that have an `execute` function) are finished.
     *
     * The usage is the combined usage of all steps.
     *
     * @deprecated Use `onEnd` instead.
     */
    onFinish?: GenerateTextOnEndCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    onAbort?: StreamTextOnAbortCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    /**
     * Callback that is called when each step (LLM call) ends, including intermediate steps.
     */
    onStepEnd?: GenerateTextOnStepEndCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    /**
     * Callback that is called when each step (LLM call) ends, including intermediate steps.
     *
     * @deprecated Use `onStepEnd` instead.
     */
    onStepFinish?: GenerateTextOnStepFinishCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    /**
     * Callback that is called when the streamText operation begins,
     * before any LLM calls are made.
     */
    onStart?: GenerateTextOnStartCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called when the streamText operation begins,
     * before any LLM calls are made.
     *
     * @deprecated Use `onStart` instead.
     */
    experimental_onStart?: GenerateTextOnStartCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called when a step (LLM call) begins,
     * before the provider is called.
     */
    onStepStart?: GenerateTextOnStepStartCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called when a step (LLM call) begins,
     * before the provider is called.
     *
     * @deprecated Use `onStepStart` instead.
     */
    experimental_onStepStart?: GenerateTextOnStepStartCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called immediately before the provider model call begins.
     */
    onLanguageModelCallStart?: OnLanguageModelCallStartCallback;

    /**
     * Callback that is called immediately before the provider model call begins.
     *
     * @deprecated Use `onLanguageModelCallStart` instead.
     */
    experimental_onLanguageModelCallStart?: OnLanguageModelCallStartCallback;

    /**
     * Callback that is called after the model response has been normalized and parsed,
     * but before any client-side tool execution begins.
     */
    onLanguageModelCallEnd?: OnLanguageModelCallEndCallback<NoInfer<TOOLS>>;

    /**
     * Callback that is called after the model response has been normalized and parsed,
     * but before any client-side tool execution begins.
     *
     * @deprecated Use `onLanguageModelCallEnd` instead.
     */
    experimental_onLanguageModelCallEnd?: OnLanguageModelCallEndCallback<
      NoInfer<TOOLS>
    >;

    /**
     * Callback that is called right before a tool's execute function runs.
     */
    onToolExecutionStart?: OnToolExecutionStartCallback<NoInfer<TOOLS>>;

    /**
     * Callback that is called right before a tool's execute function runs.
     *
     * @deprecated Use `onToolExecutionStart` instead.
     */
    experimental_onToolCallStart?: OnToolExecutionStartCallback<NoInfer<TOOLS>>;

    /**
     * Callback that is called right after a tool's execute function completes (or errors).
     */
    onToolExecutionEnd?: OnToolExecutionEndCallback<NoInfer<TOOLS>>;

    /**
     * Callback that is called right after a tool's execute function completes (or errors).
     *
     * @deprecated Use `onToolExecutionEnd` instead.
     */
    experimental_onToolCallFinish?: OnToolExecutionEndCallback<NoInfer<TOOLS>>;

    /**
     * Settings for controlling what data is included in step results.
     * Disabling inclusion can help reduce memory usage when processing
     * large payloads like images.
     *
     * By default, request bodies and request messages are excluded.
     */
    include?: StreamTextInclude;

    /**
     * Settings for controlling what data is included in step results.
     *
     * @deprecated Use `include` instead.
     */
    experimental_include?: StreamTextInclude;

    /**
     * Internal. For test use only. May change without notice.
     */
    _internal?: {
      now?: () => number;
      generateId?: IdGenerator;
      generateCallId?: IdGenerator;
    };
  }): StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT> {
  const totalTimeoutMs = getTotalTimeoutMs(timeout);
  const stepTimeoutMs = getStepTimeoutMs(timeout);
  const chunkTimeoutMs = getChunkTimeoutMs(timeout);
  const stepAbortController =
    stepTimeoutMs != null ? new AbortController() : undefined;
  const chunkAbortController =
    chunkTimeoutMs != null ? new AbortController() : undefined;
  const resolvedOnStart = onStart ?? experimental_onStart;
  const resolvedOnStepStart = onStepStart ?? experimental_onStepStart;
  const resolvedOnLanguageModelCallStart =
    onLanguageModelCallStart ?? experimental_onLanguageModelCallStart;
  const resolvedOnLanguageModelCallEnd =
    onLanguageModelCallEnd ?? experimental_onLanguageModelCallEnd;
  const resolvedOnToolExecutionStart =
    onToolExecutionStart ?? experimental_onToolCallStart;
  const resolvedOnToolExecutionEnd =
    onToolExecutionEnd ?? experimental_onToolCallFinish;
  const resolvedOnStepEnd = onStepEnd ?? onStepFinish;
  return new DefaultStreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>({
    model: resolveLanguageModel(model),
    telemetry,
    headers,
    settings,
    maxRetries,
    abortSignal: mergeAbortSignals(
      abortSignal,
      totalTimeoutMs,
      stepAbortController?.signal,
      chunkAbortController?.signal,
    ),
    stepTimeoutMs,
    stepAbortController,
    chunkTimeoutMs,
    chunkAbortController,
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
    experimental_sandbox: sandbox,
    tools,
    toolsContext,
    runtimeContext,
    toolChoice,
    transforms: asArray(transform),
    activeTools,
    toolOrder,
    repairToolCall,
    refineToolInput,
    stopConditions: asArray(stopWhen),
    output,
    toolApproval,
    experimental_toolApprovalSecret,
    providerOptions,
    prepareStep,
    timeout,
    onChunk,
    onError,
    onEnd,
    onAbort,
    onStepFinish: resolvedOnStepEnd,
    onStart: resolvedOnStart,
    onStepStart: resolvedOnStepStart,
    onLanguageModelCallStart: resolvedOnLanguageModelCallStart,
    onLanguageModelCallEnd: resolvedOnLanguageModelCallEnd,
    onToolExecutionStart: resolvedOnToolExecutionStart,
    onToolExecutionEnd: resolvedOnToolExecutionEnd,
    now,
    generateId,
    generateCallId,
    download,

    // assign default values to include:
    include: {
      requestBody: include?.requestBody ?? false,
      requestMessages: include?.requestMessages ?? false,
      rawChunks: include?.rawChunks ?? includeRawChunks ?? false,
    },
  });
}

export type EnrichedStreamPart<TOOLS extends ToolSet, PARTIAL_OUTPUT> = {
  part: TextStreamPart<TOOLS>;
  partialOutput: PARTIAL_OUTPUT | undefined;
};

async function markPromiseAsHandled<T>(promise: Promise<T>): Promise<void> {
  try {
    await promise;
  } catch {}
}

function createOutputTransformStream<
  TOOLS extends ToolSet,
  OUTPUT extends Output,
>(
  output: OUTPUT,
): TransformStream<
  TextStreamPart<TOOLS>,
  EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>
> {
  let firstTextChunkId: string | undefined = undefined;
  let text = '';
  let textChunk = '';
  let textProviderMetadata: ProviderMetadata | undefined = undefined;
  let lastPublishedValue = '';

  function publishTextChunk({
    controller,
    partialOutput = undefined,
  }: {
    controller: TransformStreamDefaultController<
      EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>
    >;
    partialOutput?: InferPartialOutput<OUTPUT>;
  }) {
    controller.enqueue({
      part: {
        type: 'text-delta',
        id: firstTextChunkId!,
        text: textChunk,
        providerMetadata: textProviderMetadata,
      },
      partialOutput,
    });
    textChunk = '';
  }

  return new TransformStream<
    TextStreamPart<TOOLS>,
    EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>
  >({
    async transform(chunk, controller) {
      // ensure that we publish the last text chunk before the step finish:
      if (chunk.type === 'finish-step' && textChunk.length > 0) {
        publishTextChunk({ controller });
      }

      if (
        chunk.type !== 'text-delta' &&
        chunk.type !== 'text-start' &&
        chunk.type !== 'text-end'
      ) {
        controller.enqueue({ part: chunk, partialOutput: undefined });
        return;
      }

      // we have to pick a text chunk which contains the json text
      // since we are streaming, we have to pick the first text chunk
      if (firstTextChunkId == null) {
        firstTextChunkId = chunk.id;
      } else if (chunk.id !== firstTextChunkId) {
        controller.enqueue({ part: chunk, partialOutput: undefined });
        return;
      }

      if (chunk.type === 'text-start') {
        controller.enqueue({ part: chunk, partialOutput: undefined });
        return;
      }

      if (chunk.type === 'text-end') {
        if (textChunk.length > 0) {
          publishTextChunk({ controller });
        }
        controller.enqueue({ part: chunk, partialOutput: undefined });
        return;
      }

      text += chunk.text;
      textChunk += chunk.text;
      textProviderMetadata = chunk.providerMetadata ?? textProviderMetadata;

      // only publish if partial json can be parsed:
      const result = await output.parsePartialOutput({ text });

      // null should be allowed (valid JSON value) but undefined should not:
      if (result !== undefined) {
        // only send new value if it has changed:
        // For string partials (text output), compare directly to avoid unnecessary JSON.stringify overhead
        const currentValue =
          typeof result.partial === 'string'
            ? result.partial
            : JSON.stringify(result.partial);
        if (currentValue !== lastPublishedValue) {
          publishTextChunk({ controller, partialOutput: result.partial });
          lastPublishedValue = currentValue;
        }
      }
    },
  });
}

class DefaultStreamTextResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  OUTPUT extends Output,
> implements StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT> {
  private readonly _totalUsage = new DelayedPromise<
    Awaited<StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['usage']>
  >();
  private readonly _finishReason = new DelayedPromise<
    Awaited<StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['finishReason']>
  >();
  private readonly _rawFinishReason = new DelayedPromise<
    Awaited<StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['rawFinishReason']>
  >();
  private readonly _steps = new DelayedPromise<
    Awaited<StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['steps']>
  >();
  private readonly _initialResponseMessages = new DelayedPromise<
    Array<ResponseMessage>
  >();

  private readonly addStream: (
    stream: ReadableStream<TextStreamPart<TOOLS>>,
  ) => void;

  private readonly closeStream: () => void;

  private baseStream: ReadableStream<
    EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>
  >;

  private outputSpecification: OUTPUT | undefined;

  private tools: TOOLS | undefined;

  constructor({
    model,
    telemetry,
    headers,
    settings,
    maxRetries: maxRetriesArg,
    abortSignal,
    stepTimeoutMs,
    stepAbortController,
    chunkTimeoutMs,
    chunkAbortController,
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
    experimental_sandbox: sandbox,
    tools,
    toolChoice,
    transforms,
    activeTools,
    toolOrder,
    repairToolCall,
    refineToolInput,
    stopConditions,
    output,
    toolApproval,
    experimental_toolApprovalSecret,
    providerOptions,
    prepareStep,
    now,
    generateId,
    generateCallId,
    timeout,
    onChunk,
    onError,
    onEnd,
    onAbort,
    onStepFinish,
    onStart,
    onStepStart,
    onLanguageModelCallStart,
    onLanguageModelCallEnd,
    onToolExecutionStart,
    onToolExecutionEnd,
    runtimeContext,
    toolsContext,
    download,
    include,
  }: {
    model: LanguageModelV4;
    telemetry: TelemetryOptions<RUNTIME_CONTEXT, TOOLS> | undefined;
    headers: Record<string, string | undefined> | undefined;
    settings: LanguageModelCallOptions;
    maxRetries: number | undefined;
    abortSignal: AbortSignal | undefined;
    stepTimeoutMs: number | undefined;
    stepAbortController: AbortController | undefined;
    chunkTimeoutMs: number | undefined;
    chunkAbortController: AbortController | undefined;
    toolsContext: InferToolSetContext<TOOLS>;
    runtimeContext: RUNTIME_CONTEXT;
    instructions: Prompt['instructions'];
    system: Prompt['system'];
    prompt: Prompt['prompt'];
    messages: Prompt['messages'];
    allowSystemInMessages: Prompt['allowSystemInMessages'];
    experimental_sandbox: SandboxSession | undefined;
    tools: TOOLS | undefined;
    toolChoice: ToolChoice<TOOLS> | undefined;
    transforms: Array<StreamTextTransform<TOOLS>>;
    activeTools: ActiveTools<TOOLS>;
    toolOrder: ToolOrder<TOOLS>;
    repairToolCall: ToolCallRepairFunction<TOOLS> | undefined;
    refineToolInput: ToolInputRefinement<TOOLS> | undefined;
    stopConditions: Array<
      StopCondition<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>
    >;
    output: OUTPUT | undefined;
    toolApproval: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT> | undefined;
    experimental_toolApprovalSecret: string | Uint8Array | undefined;
    providerOptions: ProviderOptions | undefined;
    prepareStep:
      | PrepareStepFunction<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>
      | undefined;
    now: () => number;
    generateId: () => string;
    generateCallId: () => string;
    timeout: TimeoutConfiguration<TOOLS> | undefined;
    download: DownloadFunction | undefined;
    include: Required<StreamTextInclude>;

    // callbacks:
    onChunk: undefined | StreamTextOnChunkCallback<TOOLS>;
    onError: StreamTextOnErrorCallback;
    onEnd:
      | undefined
      | GenerateTextOnEndCallback<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>;
    onAbort:
      | undefined
      | StreamTextOnAbortCallback<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>;
    onStepFinish:
      | undefined
      | GenerateTextOnStepFinishCallback<
          NoInfer<TOOLS>,
          NoInfer<RUNTIME_CONTEXT>
        >;
    onStart:
      | undefined
      | GenerateTextOnStartCallback<
          NoInfer<TOOLS>,
          NoInfer<RUNTIME_CONTEXT>,
          NoInfer<OUTPUT>
        >;
    onStepStart:
      | undefined
      | GenerateTextOnStepStartCallback<
          NoInfer<TOOLS>,
          NoInfer<RUNTIME_CONTEXT>,
          NoInfer<OUTPUT>
        >;
    onLanguageModelCallStart: undefined | OnLanguageModelCallStartCallback;
    onLanguageModelCallEnd:
      | undefined
      | OnLanguageModelCallEndCallback<NoInfer<TOOLS>>;
    onToolExecutionStart: undefined | OnToolExecutionStartCallback<TOOLS>;
    onToolExecutionEnd: undefined | OnToolExecutionEndCallback<TOOLS>;
  }) {
    this.outputSpecification = output;
    this.tools = tools;

    const telemetryDispatcher = createRestrictedTelemetryDispatcher<
      TOOLS,
      RUNTIME_CONTEXT,
      OUTPUT
    >({
      telemetry,
      includeRuntimeContext: telemetry?.includeRuntimeContext,
      includeToolsContext: telemetry?.includeToolsContext,
    });

    // promise to ensure that the step has been fully processed by the event processor
    // before a new step is started. This is required because the continuation condition
    // needs the updated steps to determine if another step is needed.
    let stepFinish!: DelayedPromise<void>;

    let recordedContent: Array<ContentPart<TOOLS>> = [];
    let recordedFinishReason: FinishReason | undefined = undefined;
    let recordedRawFinishReason: string | undefined = undefined;
    let recordedTotalUsage: LanguageModelUsage | undefined = undefined;
    let recordedRequest: Omit<LanguageModelRequestMetadata, 'messages'> = {};
    let recordedRequestMessages: Array<ModelMessage> = [];
    let recordedWarnings: Array<CallWarning> = [];
    const recordedSteps: StepResult<TOOLS, RUNTIME_CONTEXT>[] = [];
    const initialResponseMessages: Array<ResponseMessage> = [];
    let stepMessagesForNextStep: Array<ModelMessage> | undefined;
    let currentStepMessages: Array<ModelMessage> = [];

    // Track provider-executed tool calls that support deferred results
    // (e.g., code_execution in programmatic tool calling scenarios).
    // These tools may not return their results in the same turn as their call.
    const pendingDeferredToolCalls = new Map<string, { toolName: string }>();

    let activeTextContent: Record<
      string,
      {
        type: 'text';
        text: string;
        providerMetadata: ProviderMetadata | undefined;
      }
    > = createIdMap();

    let activeReasoningContent: Record<
      string,
      {
        type: 'reasoning';
        text: string;
        providerMetadata: ProviderMetadata | undefined;
      }
    > = createIdMap();
    let recordedNoOutputError: NoOutputGeneratedError | undefined;

    const eventProcessor = new TransformStream<
      EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>,
      EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>
    >({
      async transform(chunk, controller) {
        controller.enqueue(chunk); // forward the chunk to the next stream

        const { part } = chunk;

        await onChunk?.({ chunk: part });

        if (part.type === 'error') {
          const error = wrapGatewayError(part.error);

          if (NoOutputGeneratedError.isInstance(error)) {
            recordedNoOutputError = error;
          }

          await onError({ error });
        }

        if (
          part.type === 'custom' ||
          part.type === 'source' ||
          part.type === 'tool-call' ||
          part.type === 'tool-approval-request' ||
          part.type === 'tool-approval-response' ||
          part.type === 'tool-error'
        ) {
          recordedContent.push(part);
        }

        if (part.type === 'text-start') {
          activeTextContent[part.id] = {
            type: 'text',
            text: '',
            providerMetadata: part.providerMetadata,
          };

          recordedContent.push(activeTextContent[part.id]);
        }

        if (part.type === 'text-delta') {
          const activeText = activeTextContent[part.id];

          if (activeText == null) {
            controller.enqueue({
              part: {
                type: 'error',
                error: `text part ${part.id} not found`,
              },
              partialOutput: undefined,
            });
            return;
          }

          activeText.text += part.text;
          activeText.providerMetadata =
            part.providerMetadata ?? activeText.providerMetadata;
        }

        if (part.type === 'text-end') {
          const activeText = activeTextContent[part.id];

          if (activeText == null) {
            controller.enqueue({
              part: {
                type: 'error',
                error: `text part ${part.id} not found`,
              },
              partialOutput: undefined,
            });
            return;
          }

          activeText.providerMetadata =
            part.providerMetadata ?? activeText.providerMetadata;

          delete activeTextContent[part.id];
        }

        if (part.type === 'reasoning-start') {
          activeReasoningContent[part.id] = {
            type: 'reasoning',
            text: '',
            providerMetadata: part.providerMetadata,
          };

          recordedContent.push(activeReasoningContent[part.id]);
        }

        if (part.type === 'reasoning-delta') {
          const activeReasoning = activeReasoningContent[part.id];

          if (activeReasoning == null) {
            controller.enqueue({
              part: {
                type: 'error',
                error: `reasoning part ${part.id} not found`,
              },
              partialOutput: undefined,
            });
            return;
          }

          activeReasoning.text += part.text;
          activeReasoning.providerMetadata =
            part.providerMetadata ?? activeReasoning.providerMetadata;
        }

        if (part.type === 'reasoning-end') {
          const activeReasoning = activeReasoningContent[part.id];

          if (activeReasoning == null) {
            controller.enqueue({
              part: {
                type: 'error',
                error: `reasoning part ${part.id} not found`,
              },
              partialOutput: undefined,
            });
            return;
          }

          activeReasoning.providerMetadata =
            part.providerMetadata ?? activeReasoning.providerMetadata;

          delete activeReasoningContent[part.id];
        }

        if (part.type === 'file' || part.type === 'reasoning-file') {
          recordedContent.push({
            type: part.type,
            file: part.file,
            ...(part.providerMetadata != null
              ? { providerMetadata: part.providerMetadata }
              : {}),
          });
        }

        if (part.type === 'tool-result' && !part.preliminary) {
          recordedContent.push(part);
        }

        if (part.type === 'start-step') {
          // reset the recorded data when a new step starts:
          recordedContent = [];
          activeReasoningContent = createIdMap();
          activeTextContent = createIdMap();

          recordedRequest = part.request;
          recordedWarnings = part.warnings;
        }

        if (part.type === 'finish-step') {
          const stepResponseMessages = await toResponseMessages({
            content: recordedContent,
            tools,
          });

          // Add step information (after response messages are updated):
          const currentStepResult: StepResult<TOOLS, RUNTIME_CONTEXT> =
            new DefaultStepResult({
              callId,
              stepNumber: recordedSteps.length,
              provider: model.provider,
              modelId: model.modelId,
              runtimeContext,
              toolsContext,
              content: recordedContent,
              finishReason: part.finishReason,
              rawFinishReason: part.rawFinishReason,
              usage: part.usage,
              performance: part.performance,
              warnings: recordedWarnings,
              request: {
                ...recordedRequest,
                messages: include.requestMessages
                  ? cloneModelMessages(recordedRequestMessages)
                  : undefined,
              },
              response: {
                ...part.response,
                messages: cloneModelMessages(stepResponseMessages),
              },
              providerMetadata: part.providerMetadata,
            });

          await notify({
            event: currentStepResult,
            callbacks: [onStepFinish, telemetryDispatcher.onStepEnd],
          });

          logWarnings({
            warnings: recordedWarnings,
            provider: model.provider,
            model: model.modelId,
          });

          recordedSteps.push(currentStepResult);
          stepMessagesForNextStep = [
            ...currentStepMessages,
            ...stepResponseMessages,
          ];

          // resolve the promise to signal that the step has been fully processed
          // by the event processor:
          stepFinish.resolve();
        }

        if (part.type === 'finish') {
          recordedTotalUsage = part.totalUsage;
          recordedFinishReason = part.finishReason;
          recordedRawFinishReason = part.rawFinishReason;
        }
      },

      async flush(controller) {
        try {
          // reject when no output was generated or an incomplete model stream
          // ended a continuation step:
          if (recordedSteps.length === 0 || recordedNoOutputError != null) {
            const error = abortSignal?.aborted
              ? abortSignal.reason
              : (recordedNoOutputError ??
                new NoOutputGeneratedError({
                  message: 'No output generated. Check the stream for errors.',
                }));

            self.rejectResultPromises(error);

            return; // no steps recorded (e.g. in error scenario)
          }

          // derived:
          const finishReason = recordedFinishReason ?? 'other';
          const totalUsage =
            recordedTotalUsage ?? createNullLanguageModelUsage();

          // from finish:
          self._finishReason.resolve(finishReason);
          self._rawFinishReason.resolve(recordedRawFinishReason);
          self._totalUsage.resolve(totalUsage);

          // aggregate results:
          self._steps.resolve(recordedSteps);

          // call onEnd callback:
          const finalStep = recordedSteps[recordedSteps.length - 1];
          const content = recordedSteps.flatMap(step => step.content);
          const files = recordedSteps.flatMap(step => step.files);
          const sources = recordedSteps.flatMap(step => step.sources);
          const toolCalls = recordedSteps.flatMap(step => step.toolCalls);
          const staticToolCalls = recordedSteps.flatMap(
            step => step.staticToolCalls,
          );
          const dynamicToolCalls = recordedSteps.flatMap(
            step => step.dynamicToolCalls,
          );
          const toolResults = recordedSteps.flatMap(step => step.toolResults);
          const staticToolResults = recordedSteps.flatMap(
            step => step.staticToolResults,
          );
          const dynamicToolResults = recordedSteps.flatMap(
            step => step.dynamicToolResults,
          );
          const warnings = recordedSteps.flatMap(step => step.warnings ?? []);

          await notify({
            event: {
              callId,
              toolsContext: finalStep.toolsContext,
              stepNumber: finalStep.stepNumber,
              model: finalStep.model,
              runtimeContext: finalStep.runtimeContext,
              finishReason: finalStep.finishReason,
              rawFinishReason: finalStep.rawFinishReason,
              usage: totalUsage,
              totalUsage,
              content,
              text: finalStep.text,
              reasoning: finalStep.reasoning,
              reasoningText: finalStep.reasoningText,
              files,
              sources,
              toolCalls,
              staticToolCalls,
              dynamicToolCalls,
              toolResults,
              staticToolResults,
              dynamicToolResults,
              responseMessages: [
                ...initialResponseMessages,
                ...recordedSteps.flatMap(step => step.response.messages),
              ],
              warnings,
              request: finalStep.request,
              response: finalStep.response,
              providerMetadata: finalStep.providerMetadata,
              steps: recordedSteps,
              finalStep,
            },
            callbacks: [onEnd, telemetryDispatcher.onEnd],
          });
        } catch (error) {
          controller.error(error);
        }
      },
    });

    // initialize the stitchable stream and the transformed stream:
    const stitchableStream = createStitchableStream<TextStreamPart<TOOLS>>();
    this.addStream = stitchableStream.addStream;
    this.closeStream = stitchableStream.close;

    // resilient stream that handles abort signals and errors:
    const reader = stitchableStream.stream.getReader();
    let stream = new ReadableStream<TextStreamPart<TOOLS>>({
      async start(controller) {
        // send start event:
        controller.enqueue({ type: 'start' });
      },

      async pull(controller) {
        // abort handling:
        async function abort() {
          await notify({
            event: {
              callId,
              steps: recordedSteps,
              ...(abortSignal?.reason !== undefined
                ? { reason: abortSignal.reason }
                : {}),
            },
            callbacks: [onAbort, telemetryDispatcher.onAbort],
          });
          controller.enqueue({
            type: 'abort',
            // The `reason` is usually of type DOMException, but it can also be of any type,
            // so we use getErrorMessage for serialization because it is already designed to accept values of the unknown type.
            // See: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason
            ...(abortSignal?.reason !== undefined
              ? { reason: getErrorMessage(abortSignal.reason) }
              : {}),
          });
          controller.close();
        }

        try {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            return;
          }

          if (abortSignal?.aborted) {
            await abort();
            return;
          }

          controller.enqueue(value);
        } catch (error) {
          if (isAbortError(error) && abortSignal?.aborted) {
            await abort();
          } else {
            controller.error(error);
          }
        }
      },

      cancel(reason) {
        return stitchableStream.stream.cancel(reason);
      },
    });

    // introduce a gate that prevent further tokens from
    // being emitted after a transform calls stopStream
    let isRunning = true;
    stream = stream.pipeThrough(
      new TransformStream({
        async transform(chunk, controller) {
          if (isRunning) {
            controller.enqueue(chunk);
          }
        },
      }),
    );

    // transform the stream before output parsing
    // to enable replacement of stream segments:
    for (const transform of transforms) {
      stream = stream.pipeThrough(
        transform({
          tools: tools as TOOLS,
          stopStream() {
            stitchableStream.terminate();
            isRunning = false;
          },
        }),
      );
    }

    this.baseStream = stream
      .pipeThrough(createOutputTransformStream(output ?? text()))
      .pipeThrough(eventProcessor);

    const { maxRetries } = prepareRetries({
      maxRetries: maxRetriesArg,
      abortSignal,
    });

    const callSettings = prepareLanguageModelCallOptions(settings);

    const self = this;

    const callId = generateCallId();

    (async () => {
      const initialPrompt = await standardizePrompt({
        instructions,
        system,
        prompt,
        messages,
        allowSystemInMessages,
      } as Prompt);

      const startEvent = {
        callId,
        operationId: 'ai.streamText',
        provider: model.provider,
        modelId: model.modelId,
        instructions: initialPrompt.instructions,
        messages: initialPrompt.messages,
        tools,
        toolChoice,
        activeTools,
        toolOrder,
        maxOutputTokens: callSettings.maxOutputTokens,
        temperature: callSettings.temperature,
        topP: callSettings.topP,
        topK: callSettings.topK,
        presencePenalty: callSettings.presencePenalty,
        frequencyPenalty: callSettings.frequencyPenalty,
        stopSequences: callSettings.stopSequences,
        seed: callSettings.seed,
        reasoning: callSettings.reasoning,
        maxRetries,
        timeout,
        headers,
        providerOptions,
        output,
        runtimeContext,
        toolsContext,
      };

      const streamTextTracingChannelContext =
        telemetryDispatcher.startTracingChannelContext?.({
          type: 'streamText',
          event: startEvent,
          completion: self._totalUsage.promise.then(() => undefined),
        });
      // Re-enter the streamText tracing context after stream setup returns.
      const runInStreamTextTracingChannelContext = <T>(execute: () => T): T =>
        streamTextTracingChannelContext?.run(execute) ?? execute();

      await notify({
        event: startEvent,
        callbacks: [onStart, telemetryDispatcher.onStart],
      });

      const initialMessages = initialPrompt.messages;
      let instructionsForNextStep = initialPrompt.instructions;

      const { approvedToolApprovals, deniedToolApprovals } =
        collectToolApprovals<TOOLS>({ messages: initialMessages });

      // initial tool execution step stream
      if (deniedToolApprovals.length > 0 || approvedToolApprovals.length > 0) {
        const {
          approvedToolApprovals: localApprovedToolApprovals,
          deniedToolApprovals: revalidationDeniedToolApprovals,
        } = await validateApprovedToolApprovals<TOOLS, RUNTIME_CONTEXT>({
          approvedToolApprovals: approvedToolApprovals.filter(
            toolApproval => !toolApproval.toolCall.providerExecuted,
          ),
          tools,
          toolApproval,
          messages: initialMessages,
          toolsContext,
          runtimeContext,
          toolApprovalSecret: experimental_toolApprovalSecret,
        });

        const localDeniedToolApprovals = [
          ...deniedToolApprovals.filter(
            toolApproval => !toolApproval.toolCall.providerExecuted,
          ),
          ...revalidationDeniedToolApprovals,
        ];

        const deniedProviderExecutedToolApprovals = deniedToolApprovals.filter(
          toolApproval => toolApproval.toolCall.providerExecuted,
        );

        let toolExecutionStepStreamController:
          | ReadableStreamDefaultController<TextStreamPart<TOOLS>>
          | undefined;
        const toolExecutionStepStream = new ReadableStream<
          TextStreamPart<TOOLS>
        >({
          start(controller) {
            toolExecutionStepStreamController = controller;
          },
        });

        self.addStream(toolExecutionStepStream);

        try {
          for (const toolApproval of [
            ...localDeniedToolApprovals,
            ...deniedProviderExecutedToolApprovals,
          ]) {
            toolExecutionStepStreamController?.enqueue({
              type: 'tool-output-denied',
              toolCallId: toolApproval.toolCall.toolCallId,
              toolName: toolApproval.toolCall.toolName,
            } as StaticToolOutputDenied<TOOLS>);
          }

          const toolOutputs: Array<ToolOutput<TOOLS>> = [];

          await Promise.all(
            localApprovedToolApprovals.map(async toolApproval => {
              const result = await executeToolCall({
                toolCall: toolApproval.toolCall,
                tools,
                callId,
                messages: initialMessages,
                abortSignal,
                timeout,
                experimental_sandbox: sandbox,
                toolsContext,
                onToolExecutionStart: filterNullable(
                  onToolExecutionStart,
                  telemetryDispatcher.onToolExecutionStart,
                ),
                onToolExecutionEnd: filterNullable(
                  onToolExecutionEnd,
                  telemetryDispatcher.onToolExecutionEnd,
                ),
                executeToolInTelemetryContext: telemetryDispatcher.executeTool,
                runInTracingChannelSpan:
                  telemetryDispatcher.runInTracingChannelSpan,
                onPreliminaryToolResult: result => {
                  toolExecutionStepStreamController?.enqueue(result);
                },
              });

              if (result != null) {
                toolExecutionStepStreamController?.enqueue(result.output);
                toolOutputs.push(result.output);
              }
            }),
          );

          // Local tool results (approved + denied) are sent as tool results:
          if (toolOutputs.length > 0 || localDeniedToolApprovals.length > 0) {
            const localToolContent: ToolContent = [];

            // add regular tool results for approved tool calls:
            for (const output of toolOutputs) {
              localToolContent.push({
                type: 'tool-result' as const,
                toolCallId: output.toolCallId,
                toolName: output.toolName,
                output: await createToolModelOutput({
                  toolCallId: output.toolCallId,
                  input: output.input,
                  tool: tools?.[output.toolName],
                  output:
                    output.type === 'tool-result'
                      ? output.output
                      : output.error,
                  errorMode: output.type === 'tool-error' ? 'text' : 'none',
                }),
              });
            }

            // add execution denied tool results for denied local tool approvals:
            for (const toolApproval of localDeniedToolApprovals) {
              localToolContent.push({
                type: 'tool-result' as const,
                toolCallId: toolApproval.toolCall.toolCallId,
                toolName: toolApproval.toolCall.toolName,
                output: {
                  type: 'execution-denied' as const,
                  reason: toolApproval.approvalResponse.reason,
                },
              });
            }

            initialResponseMessages.push({
              role: 'tool',
              content: localToolContent,
            });
          }
        } finally {
          toolExecutionStepStreamController?.close();
        }
      }

      self._initialResponseMessages.resolve(initialResponseMessages);

      async function streamStep({
        currentStep,
        usage,
      }: {
        currentStep: number;
        usage: LanguageModelUsage;
      }) {
        // Set up step timeout if configured
        const stepTimeoutId = setAbortTimeout({
          abortController: stepAbortController,
          label: 'Step',
          timeoutMs: stepTimeoutMs,
        });

        // Set up chunk timeout tracking (will be reset on each chunk)
        let chunkTimeoutId: ReturnType<typeof setTimeout> | undefined =
          undefined;

        function resetChunkTimeout() {
          if (chunkTimeoutId != null) {
            clearTimeout(chunkTimeoutId);
          }
          chunkTimeoutId = setAbortTimeout({
            abortController: chunkAbortController,
            label: 'Chunk',
            timeoutMs: chunkTimeoutMs,
          });
        }

        function clearChunkTimeout() {
          if (chunkTimeoutId != null) {
            clearTimeout(chunkTimeoutId);
            chunkTimeoutId = undefined;
          }
        }

        function clearStepTimeout() {
          if (stepTimeoutId != null) {
            clearTimeout(stepTimeoutId);
          }
        }

        // The step's stream is registered lazily and consumed long after this
        // function returns, so the step timer must stay armed past setup. When
        // the merged abort signal fires (any step/chunk/total timeout or caller
        // abort), drop both step-scoped timers so neither outlives the step.
        abortSignal?.addEventListener('abort', clearStepTimeout);
        abortSignal?.addEventListener('abort', clearChunkTimeout);

        try {
          stepFinish = new DelayedPromise<void>();

          const stepTracingChannelContext =
            telemetryDispatcher.startTracingChannelContext?.({
              type: 'step',
              event: { callId, stepNumber: currentStep },
              completion: stepFinish.promise,
            });
          // Re-enter the current step before creating child spans.
          const runInStepTracingChannelContext = <T>(execute: () => T): T =>
            stepTracingChannelContext?.run(execute) ?? execute();

          const responseMessagesFromPreviousSteps = recordedSteps.flatMap(
            step => step.response.messages,
          );
          const accumulatedResponseMessages = [
            ...initialResponseMessages,
            ...responseMessagesFromPreviousSteps,
          ];
          const stepInputMessages = stepMessagesForNextStep ?? [
            ...initialMessages,
            ...initialResponseMessages,
          ];

          const prepareStepResult = await prepareStep?.({
            model,
            steps: recordedSteps,
            stepNumber: recordedSteps.length,
            instructions: instructionsForNextStep,
            initialInstructions: initialPrompt.instructions,
            messages: stepInputMessages,
            initialMessages,
            responseMessages: accumulatedResponseMessages,
            toolsContext,
            runtimeContext,
            experimental_sandbox: sandbox,
          });

          const stepSandbox =
            prepareStepResult?.experimental_sandbox ?? sandbox;

          runtimeContext = prepareStepResult?.runtimeContext ?? runtimeContext;
          toolsContext = prepareStepResult?.toolsContext ?? toolsContext;

          const stepModel = resolveLanguageModel(
            prepareStepResult?.model ?? model,
          );

          const stepActiveTools = filterActiveTools({
            tools,
            activeTools: prepareStepResult?.activeTools ?? activeTools,
          });
          const stepToolOrder = prepareStepResult?.toolOrder ?? toolOrder;

          const stepTools = await prepareTools({
            tools: stepActiveTools,
            toolOrder: stepToolOrder as ToolOrder<
              ActiveToolSubset<TOOLS, ActiveTools<NoInfer<TOOLS>>>
            >,
            // active tools context is a subset of the tools context, so we can cast to the unknown type
            toolsContext: toolsContext as unknown as InferToolSetContext<
              ActiveToolSubset<TOOLS, ActiveTools<NoInfer<TOOLS>>>
            >,
            experimental_sandbox: stepSandbox,
          });

          const stepToolChoice = prepareToolChoice({
            toolChoice: prepareStepResult?.toolChoice ?? toolChoice,
          });

          const stepMessages = prepareStepResult?.messages ?? stepInputMessages;
          currentStepMessages = stepMessages;
          const stepInstructions =
            prepareStepResult?.instructions ??
            prepareStepResult?.system ??
            instructionsForNextStep;
          instructionsForNextStep = stepInstructions;

          const stepProviderOptions = mergeObjects(
            providerOptions,
            prepareStepResult?.providerOptions,
          );

          const stepStartTimestampMs = now();

          const { retry } = prepareRetries({ maxRetries, abortSignal });

          const {
            stream: languageModelStream,
            request,
            response,
          } = await runInStepTracingChannelContext(() =>
            retry(async () =>
              streamLanguageModelCall({
                model: prepareStepResult?.model ?? model,
                tools: stepActiveTools,
                toolOrder: stepToolOrder,
                toolChoice: prepareStepResult?.toolChoice ?? toolChoice,
                instructions: stepInstructions,
                messages: stepMessages,
                allowSystemInMessages,
                repairToolCall,
                refineToolInput,
                abortSignal,
                headers,
                includeRawChunks: include.rawChunks,
                providerOptions: stepProviderOptions,
                download,
                output,
                callId,
                executeLanguageModelCallInTelemetryContext:
                  telemetryDispatcher.executeLanguageModelCall,
                toolsContext,
                experimental_sandbox: stepSandbox,
                onLanguageModelCallStart: filterNullable(
                  onLanguageModelCallStart,
                  telemetryDispatcher.onLanguageModelCallStart as
                    | undefined
                    | OnLanguageModelCallStartCallback,
                ),
                onLanguageModelCallEnd: filterNullable(
                  onLanguageModelCallEnd,
                  telemetryDispatcher.onLanguageModelCallEnd as
                    | undefined
                    | OnLanguageModelCallEndCallback<TOOLS>,
                ),
                onStart: async ({ promptMessages }) => {
                  await notify({
                    event: {
                      callId,
                      provider: stepModel.provider,
                      modelId: stepModel.modelId,
                      stepNumber: recordedSteps.length,
                      instructions: stepInstructions,
                      messages: stepMessages,
                      tools,
                      toolChoice: prepareStepResult?.toolChoice ?? toolChoice,
                      activeTools:
                        prepareStepResult?.activeTools ?? activeTools,
                      toolOrder: stepToolOrder,
                      steps: [...recordedSteps],
                      providerOptions: stepProviderOptions,
                      runtimeContext,
                      toolsContext,
                      output,
                      promptMessages,
                      stepTools,
                      stepToolChoice,
                    },
                    callbacks: [onStepStart, telemetryDispatcher.onStepStart],
                  });
                },
                _internal: {
                  now,
                },
                ...callSettings,
              }),
            ),
          );

          const streamAfterToolCallbackInvocation =
            invokeToolCallbacksFromStream({
              stream: languageModelStream,
              tools,
              stepInputMessages: stepMessages,
              abortSignal,
              runtimeContext,
            });

          // Create child spans under the current step context.
          const runInTracingChannelSpanInStep =
            telemetryDispatcher.runInTracingChannelSpan == null
              ? undefined
              : <T>(
                  options: Parameters<
                    NonNullable<TelemetryDispatcher['runInTracingChannelSpan']>
                  >[0] & {
                    execute: () => PromiseLike<T>;
                  },
                ) =>
                  runInStepTracingChannelContext(() =>
                    telemetryDispatcher.runInTracingChannelSpan!(options),
                  );

          const streamWithToolResults = executeToolsFromStream({
            stream: streamAfterToolCallbackInvocation,
            tools,
            callId,
            messages: stepMessages,
            abortSignal,
            timeout,
            experimental_sandbox: stepSandbox,
            toolsContext,
            toolApproval,
            runtimeContext,
            toolApprovalSecret: experimental_toolApprovalSecret,
            generateId,

            // the callbacks need to be passed down and handled by executeToolCall
            // to guarantee that the onToolExecutionStart callback is invoked before the tool execute function
            onToolExecutionStart: filterNullable(
              onToolExecutionStart,
              telemetryDispatcher.onToolExecutionStart,
            ),
            onToolExecutionEnd: filterNullable(
              onToolExecutionEnd,
              telemetryDispatcher.onToolExecutionEnd,
            ),

            executeToolInTelemetryContext: telemetryDispatcher.executeTool,
            runInTracingChannelSpan: runInTracingChannelSpanInStep,
          });

          // Conditionally include request.body based on include settings.
          // Large payloads (e.g., base64-encoded images) can cause memory issues.
          const stepRequest: LanguageModelRequestMetadata = {
            ...request,
            body: include.requestBody ? request?.body : undefined,
            messages: include.requestMessages
              ? cloneModelMessages(stepMessages)
              : undefined,
          };
          recordedRequestMessages = stepRequest.messages ?? [];

          const stepToolCalls: TypedToolCall<TOOLS>[] = [];
          const stepToolOutputs: ToolOutput<TOOLS>[] = [];
          const stepToolApprovalResponses: ToolApprovalResponse[] = [];
          let warnings: SharedV4Warning[] | undefined;

          let stepFinishReason: FinishReason = 'other';
          let stepRawFinishReason: string | undefined = undefined;

          // terminal chunk = 'model-call-end' or 'error'; absence on stream
          // end means the model stream is incomplete:
          let hasReceivedTerminalChunk = false;

          // output chunk = any content chunk (text, tool calls, etc.);
          // used to distinguish empty incomplete streams from partial results:
          let hasReceivedOutputChunk = false;

          let stepUsage: LanguageModelUsage = createNullLanguageModelUsage();
          let stepProviderMetadata: ProviderMetadata | undefined;
          let stepFirstChunk = true;
          let modelCallPerformance: Omit<
            StepResultPerformance,
            'stepTimeMs' | 'toolExecutionMs'
          > = {
            responseTimeMs: 0,
            effectiveOutputTokensPerSecond: 0,
            outputTokensPerSecond: undefined,
            inputTokensPerSecond: undefined,
            effectiveTotalTokensPerSecond: 0,
            timeToFirstOutputMs: undefined,
            timeBetweenOutputChunksMs: undefined,
          };
          const toolExecutionMs: Record<string, number> = {};
          let stepResponse: { id: string; timestamp: Date; modelId: string } = {
            id: generateId(),
            timestamp: new Date(),
            modelId: model.modelId,
          };

          self.addStream(
            streamWithToolResults.pipeThrough(
              new TransformStream<
                ExecuteToolsStreamPart<TOOLS>,
                TextStreamPart<TOOLS>
              >({
                async transform(chunk, controller): Promise<void> {
                  resetChunkTimeout();

                  if (chunk.type === 'model-call-start') {
                    warnings = chunk.warnings;
                    return; // stream start chunks are sent immediately and do not count as first chunk
                  }

                  if (stepFirstChunk) {
                    stepFirstChunk = false;

                    // Step start:
                    controller.enqueue({
                      type: 'start-step',
                      request: stepRequest,
                      warnings: warnings ?? [],
                    });
                  }

                  const chunkType = chunk.type;

                  if (isOutputChunkType[chunkType]) {
                    hasReceivedOutputChunk = true;
                  }

                  switch (chunkType) {
                    case 'file':
                    case 'custom':
                    case 'source':
                    case 'text-start':
                    case 'text-end':
                    case 'reasoning-start':
                    case 'reasoning-end':
                    case 'reasoning-delta':
                    case 'reasoning-file':
                    case 'tool-input-start':
                    case 'tool-input-end':
                    case 'tool-input-delta':
                    case 'tool-approval-request': {
                      controller.enqueue(chunk);
                      break;
                    }

                    case 'text-delta': {
                      if (chunk.text.length > 0) {
                        controller.enqueue(chunk);
                      }
                      break;
                    }

                    case 'tool-call': {
                      controller.enqueue(chunk);
                      // store tool calls for onEnd callback and toolCalls promise:
                      stepToolCalls.push(chunk);
                      break;
                    }

                    case 'tool-approval-response': {
                      controller.enqueue(chunk);
                      stepToolApprovalResponses.push(chunk);
                      break;
                    }

                    case 'tool-result': {
                      controller.enqueue(chunk);

                      if (!chunk.preliminary) {
                        stepToolOutputs.push(chunk);
                      }

                      break;
                    }

                    case 'tool-error': {
                      controller.enqueue(chunk);
                      stepToolOutputs.push(chunk);
                      break;
                    }

                    case 'tool-execution-end': {
                      toolExecutionMs[chunk.toolCallId] = chunk.toolExecutionMs;
                      break;
                    }

                    case 'model-call-response-metadata': {
                      stepResponse = {
                        id: chunk.id ?? stepResponse.id,
                        timestamp: chunk.timestamp ?? stepResponse.timestamp,
                        modelId: chunk.modelId ?? stepResponse.modelId,
                      };
                      break;
                    }

                    case 'model-call-end': {
                      hasReceivedTerminalChunk = true;

                      // Note: tool executions might not be finished yet when the finish event is emitted.
                      // store usage and finish reason for promises and onEnd callback:
                      stepUsage = chunk.usage;
                      stepFinishReason = chunk.finishReason;
                      stepRawFinishReason = chunk.rawFinishReason;
                      stepProviderMetadata = chunk.providerMetadata;
                      modelCallPerformance = chunk.performance;

                      break;
                    }

                    case 'error': {
                      hasReceivedTerminalChunk = true;
                      controller.enqueue(chunk);
                      stepFinishReason = 'error';
                      break;
                    }

                    case 'raw': {
                      if (include.rawChunks) {
                        controller.enqueue(chunk);
                      }
                      break;
                    }

                    default: {
                      const exhaustiveCheck: never = chunkType;
                      throw new Error(`Unknown chunk type: ${exhaustiveCheck}`);
                    }
                  }
                },

                // invoke onEnd callback and resolve toolResults promise when the stream is about to close:
                async flush(controller) {
                  // emit an error when an incomplete model stream produced no
                  // output instead of recording an empty step. incomplete
                  // streams with partial output retain the partial result:
                  if (!hasReceivedTerminalChunk && !hasReceivedOutputChunk) {
                    controller.enqueue({
                      type: 'error',
                      error: new NoOutputGeneratedError({
                        message:
                          'No output generated. The model stream ended without a finish chunk.',
                      }),
                    });

                    clearStepTimeout();
                    clearChunkTimeout();
                    self.closeStream();
                    return;
                  }

                  const stepTimeMs = now() - stepStartTimestampMs;

                  const finishStepPart: TextStreamPart<TOOLS> = {
                    type: 'finish-step',
                    finishReason: stepFinishReason,
                    rawFinishReason: stepRawFinishReason,
                    usage: stepUsage,
                    performance: {
                      stepTimeMs,
                      toolExecutionMs,
                      ...modelCallPerformance,
                    },
                    providerMetadata: stepProviderMetadata,
                    response: {
                      ...stepResponse,
                      headers: response?.headers,
                    },
                  };

                  controller.enqueue(finishStepPart);

                  const combinedUsage = addLanguageModelUsage(usage, stepUsage);

                  // wait for the step to be fully processed by the event processor
                  // to ensure that the recorded steps are complete:
                  await stepFinish.promise;

                  const clientToolCalls = stepToolCalls.filter(
                    toolCall => toolCall.providerExecuted !== true,
                  );
                  const clientToolOutputs = stepToolOutputs.filter(
                    toolOutput => toolOutput.providerExecuted !== true,
                  );
                  const deniedToolApprovalResponses =
                    stepToolApprovalResponses.filter(
                      toolApprovalResponse =>
                        toolApprovalResponse.approved === false,
                    );

                  // Track provider-executed tool calls that support deferred results.
                  // In programmatic tool calling, a server tool (e.g., code_execution) may
                  // trigger a client tool, and the server tool's result is deferred until
                  // the client tool's result is sent back.
                  for (const toolCall of stepToolCalls) {
                    if (toolCall.providerExecuted !== true) continue;
                    const tool = tools?.[toolCall.toolName];
                    if (
                      tool?.type === 'provider' &&
                      tool.supportsDeferredResults
                    ) {
                      // Check if this tool call already has a result in the current step
                      const hasResultInStep = stepToolOutputs.some(
                        output =>
                          (output.type === 'tool-result' ||
                            output.type === 'tool-error') &&
                          output.toolCallId === toolCall.toolCallId,
                      );
                      if (!hasResultInStep) {
                        pendingDeferredToolCalls.set(toolCall.toolCallId, {
                          toolName: toolCall.toolName,
                        });
                      }
                    }
                  }

                  // Mark deferred tool calls as resolved when we receive their results
                  for (const output of stepToolOutputs) {
                    if (
                      output.type === 'tool-result' ||
                      output.type === 'tool-error'
                    ) {
                      pendingDeferredToolCalls.delete(output.toolCallId);
                    }
                  }

                  // Clear the step and chunk timeouts before the next step is started
                  clearStepTimeout();
                  clearChunkTimeout();

                  if (
                    // Continue if:
                    // 1. There are client tool calls that have all been executed or denied, OR
                    // 2. There are pending deferred results from provider-executed tools, OR
                    ((clientToolCalls.length > 0 &&
                      clientToolCalls.length ===
                        clientToolOutputs.length +
                          deniedToolApprovalResponses.length) ||
                      pendingDeferredToolCalls.size > 0) &&
                    // continue until a stop condition is met:
                    !(await isStopConditionMet({
                      stopConditions,
                      steps: recordedSteps,
                    }))
                  ) {
                    try {
                      await runInStreamTextTracingChannelContext(() =>
                        streamStep({
                          currentStep: currentStep + 1,
                          usage: combinedUsage,
                        }),
                      );
                    } catch (error) {
                      controller.enqueue({
                        type: 'error',
                        error,
                      });

                      self.closeStream();
                    }
                  } else {
                    controller.enqueue({
                      type: 'finish',
                      finishReason: stepFinishReason,
                      rawFinishReason: stepRawFinishReason,
                      totalUsage: combinedUsage,
                    });

                    self.closeStream(); // close the stitchable stream
                  }
                },
              }),
            ),
          );
        } catch (error) {
          // Setup failed before the stream was registered, so neither the
          // stream's flush nor an abort will clear the timers — clear them here.
          clearStepTimeout();
          clearChunkTimeout();
          throw error;
        }
      }

      await runInStreamTextTracingChannelContext(() =>
        // add the initial stream to the stitchable stream
        streamStep({
          currentStep: 0,
          usage: createNullLanguageModelUsage(),
        }),
      );
    })().catch(async error => {
      await telemetryDispatcher.onError?.({ callId, error });
      self._initialResponseMessages.reject(error);
      markPromiseAsHandled(self._initialResponseMessages.promise);

      // add an error stream part and close the streams:
      self.addStream(
        new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'error', error });
            controller.close();
          },
        }),
      );
      self.closeStream();
    });
  }

  get steps() {
    // when any of the promises are accessed, the stream is consumed
    // so it resolves without needing to consume the stream separately
    this.consumeStream();

    return this._steps.promise;
  }

  get finalStep() {
    return this.steps.then(steps => steps.at(-1)!);
  }

  get content() {
    return this.steps.then(steps => steps.flatMap(step => step.content));
  }

  get warnings() {
    return this.steps.then(steps => steps.flatMap(step => step.warnings ?? []));
  }

  get providerMetadata() {
    return this.finalStep.then(step => step.providerMetadata);
  }

  get text() {
    return this.finalStep.then(step => step.text);
  }

  get reasoningText() {
    return this.finalStep.then(step => step.reasoningText);
  }

  get reasoning() {
    return this.finalStep.then(step =>
      convertToReasoningOutputs(step.reasoning),
    );
  }

  get sources() {
    return this.steps.then(steps => steps.flatMap(step => step.sources));
  }

  get files() {
    return this.steps.then(steps => steps.flatMap(step => step.files));
  }

  get toolCalls() {
    return this.steps.then(steps => steps.flatMap(step => step.toolCalls));
  }

  get staticToolCalls() {
    return this.steps.then(steps =>
      steps.flatMap(step => step.staticToolCalls),
    );
  }

  get dynamicToolCalls() {
    return this.steps.then(steps =>
      steps.flatMap(step => step.dynamicToolCalls),
    );
  }

  get toolResults() {
    return this.steps.then(steps => steps.flatMap(step => step.toolResults));
  }

  get staticToolResults() {
    return this.steps.then(steps =>
      steps.flatMap(step => step.staticToolResults),
    );
  }

  get dynamicToolResults() {
    return this.steps.then(steps =>
      steps.flatMap(step => step.dynamicToolResults),
    );
  }

  get usage() {
    return this.totalUsage;
  }

  get request() {
    return this.finalStep.then(step => step.request);
  }

  get response() {
    return this.finalStep.then(step => step.response);
  }

  get responseMessages() {
    return Promise.all([
      this._initialResponseMessages.promise,
      this.steps,
    ]).then(([initialResponseMessages, steps]) => [
      ...initialResponseMessages,
      ...steps.flatMap(step => step.response.messages),
    ]);
  }

  get totalUsage() {
    // when any of the promises are accessed, the stream is consumed
    // so it resolves without needing to consume the stream separately
    this.consumeStream();

    return this._totalUsage.promise;
  }

  get finishReason() {
    // when any of the promises are accessed, the stream is consumed
    // so it resolves without needing to consume the stream separately
    this.consumeStream();

    return this._finishReason.promise;
  }

  get rawFinishReason() {
    // when any of the promises are accessed, the stream is consumed
    // so it resolves without needing to consume the stream separately
    this.consumeStream();

    return this._rawFinishReason.promise;
  }

  /**
   * Split out a new stream from the original stream.
   * The original stream is replaced to allow for further splitting,
   * since we do not know how many times the stream will be split.
   *
   * Note: this leads to buffering the stream content on the server.
   * However, the LLM results are expected to be small enough to not cause issues.
   */
  private teeStream() {
    const [stream1, stream2] = this.baseStream.tee();
    this.baseStream = stream2;
    return stream1;
  }

  get textStream(): AsyncIterableStream<string> {
    return createAsyncIterableStream(toTextStream({ stream: this.stream }));
  }

  get stream(): AsyncIterableStream<TextStreamPart<TOOLS>> {
    return createAsyncIterableStream(
      this.teeStream().pipeThrough(
        new TransformStream<
          EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>,
          TextStreamPart<TOOLS>
        >({
          transform({ part }, controller) {
            controller.enqueue(part);
          },
        }),
      ),
    );
  }

  get fullStream(): AsyncIterableStream<TextStreamPart<TOOLS>> {
    return this.stream;
  }

  private rejectResultPromises(error: unknown) {
    this.rejectResultPromise({ delayedPromise: this._finishReason, error });
    this.rejectResultPromise({ delayedPromise: this._rawFinishReason, error });
    this.rejectResultPromise({ delayedPromise: this._totalUsage, error });
    this.rejectResultPromise({ delayedPromise: this._steps, error });
    this.rejectResultPromise({
      delayedPromise: this._initialResponseMessages,
      error,
    });
  }

  private rejectResultPromise<T>({
    delayedPromise,
    error,
  }: {
    delayedPromise: DelayedPromise<T>;
    error: unknown;
  }) {
    if (delayedPromise.isPending()) {
      delayedPromise.reject(error);
      markPromiseAsHandled(delayedPromise.promise);
    }
  }

  async consumeStream(options?: ConsumeStreamOptions): Promise<void> {
    try {
      await consumeStream({
        stream: this.stream,
        onError: error => {
          this.rejectResultPromises(error);
          options?.onError?.(error);
        },
      });
    } catch (error) {
      this.rejectResultPromises(error);
      options?.onError?.(error);
    }
  }

  get experimental_partialOutputStream(): AsyncIterableStream<
    InferPartialOutput<OUTPUT>
  > {
    return this.partialOutputStream;
  }

  get partialOutputStream(): AsyncIterableStream<InferPartialOutput<OUTPUT>> {
    return createAsyncIterableStream(
      this.teeStream().pipeThrough(
        new TransformStream<
          EnrichedStreamPart<TOOLS, InferPartialOutput<OUTPUT>>,
          InferPartialOutput<OUTPUT>
        >({
          transform({ partialOutput }, controller) {
            if (partialOutput != null) {
              controller.enqueue(partialOutput);
            }
          },
        }),
      ),
    );
  }

  get elementStream(): AsyncIterableStream<InferElementOutput<OUTPUT>> {
    const transform = this.outputSpecification?.createElementStreamTransform();

    if (transform == null) {
      throw new UnsupportedFunctionalityError({
        functionality: `element streams in ${
          this.outputSpecification?.name ?? 'text'
        } mode`,
      });
    }

    return createAsyncIterableStream(this.teeStream().pipeThrough(transform));
  }

  get output(): Promise<InferCompleteOutput<OUTPUT>> {
    return this.finalStep.then(step => {
      const output = this.outputSpecification ?? text();
      return output.parseCompleteOutput(
        { text: step.text },
        {
          response: step.response,
          usage: step.usage,
          finishReason: step.finishReason,
        },
      );
    });
  }

  toUIMessageStream<UI_MESSAGE extends UIMessage>({
    originalMessages,
    generateMessageId,
    onEnd,
    onFinish,
    messageMetadata,
    sendReasoning,
    sendSources,
    sendStart,
    sendFinish,
    onError,
  }: UIMessageStreamOptions<UI_MESSAGE> = {}): AsyncIterableStream<
    InferUIMessageChunk<UI_MESSAGE>
  > {
    return createAsyncIterableStream(
      toUIMessageStreamHelper({
        stream: this.stream,
        tools: this.tools,
        originalMessages,
        generateMessageId,
        onEnd: onEnd ?? onFinish,
        messageMetadata,
        sendReasoning,
        sendSources,
        sendStart,
        sendFinish,
        onError,
      }),
    );
  }

  pipeUIMessageStreamToResponse<UI_MESSAGE extends UIMessage>(
    response: ServerResponse,
    {
      originalMessages,
      generateMessageId,
      onEnd,
      onFinish,
      messageMetadata,
      sendReasoning,
      sendSources,
      sendFinish,
      sendStart,
      onError,
      ...init
    }: UIMessageStreamResponseInit & UIMessageStreamOptions<UI_MESSAGE> = {},
  ) {
    pipeUIMessageStreamToResponse({
      response,
      stream: this.toUIMessageStream({
        originalMessages,
        generateMessageId,
        onEnd: onEnd ?? onFinish,
        messageMetadata,
        sendReasoning,
        sendSources,
        sendFinish,
        sendStart,
        onError,
      }),
      ...init,
    });
  }

  pipeTextStreamToResponse(response: ServerResponse, init?: ResponseInit) {
    pipeTextStreamToResponse({
      response,
      stream: this.textStream,
      ...init,
    });
  }

  toUIMessageStreamResponse<UI_MESSAGE extends UIMessage>({
    originalMessages,
    generateMessageId,
    onEnd,
    onFinish,
    messageMetadata,
    sendReasoning,
    sendSources,
    sendFinish,
    sendStart,
    onError,
    ...init
  }: UIMessageStreamResponseInit &
    UIMessageStreamOptions<UI_MESSAGE> = {}): Response {
    return createUIMessageStreamResponse({
      stream: this.toUIMessageStream({
        originalMessages,
        generateMessageId,
        onEnd: onEnd ?? onFinish,
        messageMetadata,
        sendReasoning,
        sendSources,
        sendFinish,
        sendStart,
        onError,
      }),
      ...init,
    });
  }

  toTextStreamResponse(init?: ResponseInit): Response {
    return createTextStreamResponse({
      stream: this.textStream,
      ...init,
    });
  }
}
