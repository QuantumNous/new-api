import type {
  LanguageModelV4Content,
  LanguageModelV4GenerateResult,
  LanguageModelV4ToolCall,
} from '@ai-sdk/provider';
import {
  asArray,
  createIdGenerator,
  getErrorMessage,
  withUserAgentSuffix,
  type Arrayable,
  type Context,
  type Experimental_SandboxSession as SandboxSession,
  type IdGenerator,
  type InferToolSetContext,
  type ProviderOptions,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import { NoOutputGeneratedError } from '../error';
import { ToolCallNotFoundForApprovalError } from '../error/tool-call-not-found-for-approval-error';
import { logWarnings } from '../logger/log-warnings';
import { resolveLanguageModel } from '../model/resolve-model';
import type { ModelMessage } from '../prompt';
import { cloneModelMessages } from '../prompt/clone-model-message';
import { convertToLanguageModelPrompt } from '../prompt/convert-to-language-model-prompt';
import { createToolModelOutput } from '../prompt/create-tool-model-output';
import type { LanguageModelCallOptions } from '../prompt/language-model-call-options';
import { prepareLanguageModelCallOptions } from '../prompt/prepare-language-model-call-options';
import { prepareToolChoice } from '../prompt/prepare-tool-choice';
import { prepareTools } from '../prompt/prepare-tools';
import type { Prompt } from '../prompt/prompt';
import {
  getStepTimeoutMs,
  getTotalTimeoutMs,
  type RequestOptions,
  type TimeoutConfiguration,
} from '../prompt/request-options';
import { standardizePrompt } from '../prompt/standardize-prompt';
import { wrapGatewayError } from '../prompt/wrap-gateway-error';
import type { Telemetry, TelemetryDispatcher } from '../telemetry/telemetry';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import type {
  LanguageModel,
  LanguageModelRequestMetadata,
  ToolChoice,
} from '../types';
import {
  addLanguageModelUsage,
  asLanguageModelUsage,
  type LanguageModelUsage,
} from '../types/usage';
import type { DownloadFunction } from '../util/download/download-function';
import { mergeAbortSignals } from '../util/merge-abort-signals';
import { mergeObjects } from '../util/merge-objects';
import { now as originalNow } from '../util/now';
import { notify } from '../util/notify';
import { prepareRetries } from '../util/prepare-retries';
import { setAbortTimeout } from '../util/set-abort-timeout';
import { VERSION } from '../version';
import type { ActiveTools } from './active-tools';
import { calculateTokensPerSecond } from './calculate-tokens-per-second';
import { collectToolApprovals } from './collect-tool-approvals';
import type { ContentPart } from './content-part';
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
import type { GenerateTextResult } from './generate-text-result';
import { DefaultGeneratedFile } from './generated-file';
import type {
  OnLanguageModelCallEndCallback,
  OnLanguageModelCallStartCallback,
} from './language-model-events';
import { text, type Output } from './output';
import type { InferCompleteOutput } from './output-utils';
import { parseToolCall } from './parse-tool-call';
import type { PrepareStepFunction } from './prepare-step';
import { convertToReasoningOutputs } from './reasoning-output';
import { resolveToolApproval } from './resolve-tool-approval';
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
import { sumTokenCounts } from './sum-token-counts';
import { toResponseMessages } from './to-response-messages';
import type { ToolApprovalConfiguration } from './tool-approval-configuration';
import type { ToolApprovalRequestOutput } from './tool-approval-request-output';
import type { ToolApprovalResponseOutput } from './tool-approval-response-output';
import type { TypedToolCall } from './tool-call';
import type { ToolCallRepairFunction } from './tool-call-repair-function';
import type { TypedToolError } from './tool-error';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
} from './tool-execution-events';
import type { ToolInputRefinement } from './tool-input-refinement';
import type { ToolOrder } from './tool-order';
import type { ToolOutput } from './tool-output';
import type { TypedToolResult } from './tool-result';
import type { ToolsContextParameter } from './tools-context-parameter';
import { maybeSignApproval } from './tool-approval-signature';
import { validateApprovedToolApprovals } from './validate-tool-approvals';

const originalGenerateId = createIdGenerator({
  prefix: 'aitxt',
  size: 24,
});

const originalGenerateCallId = createIdGenerator({
  prefix: 'call',
  size: 24,
});

export type GenerateTextInclude = {
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
   * Whether to retain the response body in step results.
   *
   * @default false
   */
  responseBody?: boolean;
};

/**
 * Generate a text and call tools for a given prompt using a language model.
 *
 * This function does not stream the output. If you want to stream the output, use `streamText` instead.
 *
 * @param model - The language model to use.
 *
 * @param tools - Tools that are accessible to and can be called by the model. The model needs to support calling tools.
 * @param toolChoice - The tool choice strategy. Default: 'auto'.
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
 * @param onStart - Callback invoked when generation begins, before any LLM calls.
 * @param experimental_onStart - Deprecated alias for `onStart`.
 * @param onStepStart - Callback invoked when each step begins, before the provider is called.
 * @param experimental_onStepStart - Deprecated alias for `onStepStart`.
 * Receives step number, messages (in ModelMessage format), tools, and runtimeContext.
 * @param onLanguageModelCallStart - Callback invoked immediately before each provider model call begins.
 * @param experimental_onLanguageModelCallStart - Deprecated alias for `onLanguageModelCallStart`.
 * @param onLanguageModelCallEnd - Callback invoked after each provider model call response is normalized and parsed.
 * @param experimental_onLanguageModelCallEnd - Deprecated alias for `onLanguageModelCallEnd`.
 * @param onToolExecutionStart - Callback invoked before each tool execution begins.
 * Receives tool name, call ID, input, and context.
 * @param experimental_onToolCallStart - Deprecated alias for `onToolExecutionStart`.
 * @param onToolExecutionEnd - Callback invoked after each tool execution completes.
 * Uses a discriminated union: check `success` to determine if `output` or `error` is present.
 * @param experimental_onToolCallFinish - Deprecated alias for `onToolExecutionEnd`.
 * @param onStepFinish - Callback that is called when each step (LLM call) is finished, including intermediate steps.
 * @param onEnd - Callback that is called when all steps are finished and the response is complete.
 * @param onFinish - Deprecated alias for `onEnd`.
 *
 * @returns
 * A result object that contains the generated text, the results of the tool calls, and additional information.
 */
export async function generateText<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = Output<string, string>,
>({
  model: modelArg,
  tools,
  toolChoice,
  instructions,
  system,
  prompt,
  messages,
  allowSystemInMessages,
  maxRetries: maxRetriesArg,
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
  providerOptions,
  activeTools,
  toolOrder,
  prepareStep,
  experimental_repairToolCall: repairToolCall,
  experimental_refineToolInput: refineToolInput,
  experimental_download: download,
  runtimeContext = {} as RUNTIME_CONTEXT,
  toolsContext = {} as InferToolSetContext<TOOLS>,
  experimental_include,
  include = experimental_include,
  _internal: {
    generateId = originalGenerateId,
    generateCallId = originalGenerateCallId,
    now = originalNow,
  } = {},
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
  onStepEnd,
  onStepFinish,
  onFinish,
  onEnd = onFinish,
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
    toolChoice?: ToolChoice<NoInfer<TOOLS>>;

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
     * Custom download function to use for URLs.
     *
     * By default, files are downloaded if the model does not support the URL for the given media type.
     */
    experimental_download?: DownloadFunction | undefined;

    /**
     * Optional function that you can use to provide different settings for a step.
     */
    prepareStep?: PrepareStepFunction<NoInfer<TOOLS>, RUNTIME_CONTEXT>;

    /**
     * A function that attempts to repair a tool call that failed to parse.
     */
    experimental_repairToolCall?: ToolCallRepairFunction<NoInfer<TOOLS>>;

    /**
     * Optional mapping of tool names to functions that refine parsed tool inputs.
     *
     * The refined input must have the same type shape as the tool input. Refined
     * inputs are used for tool execution, outputs, callbacks, and telemetry.
     */
    experimental_refineToolInput?: ToolInputRefinement<NoInfer<TOOLS>>;

    /**
     * Callback that is called when the generateText operation begins,
     * before any LLM calls are made.
     */
    onStart?: GenerateTextOnStartCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called when the generateText operation begins,
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
     * Callback that is called when all steps are finished and the response is complete.
     */
    onEnd?: GenerateTextOnEndCallback<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>;

    /**
     * Callback that is called when all steps are finished and the response is complete.
     *
     * @deprecated Use `onEnd` instead.
     */
    onFinish?: GenerateTextOnEndCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    /**
     * Settings for controlling what data is included in step results.
     * Disabling inclusion can help reduce memory usage when processing
     * large payloads like images.
     *
     * By default, request bodies, request messages, and response bodies are
     * excluded.
     */
    include?: GenerateTextInclude;

    /**
     * Settings for controlling what data is included in step results.
     *
     * @deprecated Use `include` instead.
     */
    experimental_include?: GenerateTextInclude;

    /**
     * Internal. For test use only. May change without notice.
     */
    _internal?: {
      generateId?: IdGenerator;
      generateCallId?: IdGenerator;
      now?: () => number;
    };
  }): Promise<GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>> {
  // assign default values to include:
  include = {
    requestBody: include?.requestBody ?? false,
    requestMessages: include?.requestMessages ?? false,
    responseBody: include?.responseBody ?? false,
  };

  const model = resolveLanguageModel(modelArg);
  const stopConditions = asArray(stopWhen);
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

  const totalTimeoutMs = getTotalTimeoutMs(timeout);
  const stepTimeoutMs = getStepTimeoutMs(timeout);
  const stepAbortController =
    stepTimeoutMs != null ? new AbortController() : undefined;
  const mergedAbortSignal = mergeAbortSignals(
    abortSignal,
    totalTimeoutMs,
    stepAbortController?.signal,
  );

  const { maxRetries, retry } = prepareRetries({
    maxRetries: maxRetriesArg,
    abortSignal: mergedAbortSignal,
  });

  const callSettings = prepareLanguageModelCallOptions(settings);

  const headersWithUserAgent = withUserAgentSuffix(
    headers ?? {},
    `ai/${VERSION}`,
  );

  const initialPrompt = await standardizePrompt({
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
  } as Prompt);

  const callId = generateCallId();

  const telemetryDispatcher = createRestrictedTelemetryDispatcher<
    TOOLS,
    RUNTIME_CONTEXT,
    OUTPUT
  >({
    telemetry,
    includeRuntimeContext: telemetry?.includeRuntimeContext,
    includeToolsContext: telemetry?.includeToolsContext,
  });

  const runInTracingChannelSpan =
    telemetryDispatcher.runInTracingChannelSpan ??
    (async <T>({ execute }: { execute: () => PromiseLike<T> }) =>
      await execute());

  const generateTextStartEvent = {
    callId,
    operationId: 'ai.generateText',
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
    headers: headersWithUserAgent,
    providerOptions,
    output,
    runtimeContext,
    toolsContext,
  };

  const executeGenerateText = async () => {
    await notify({
      event: generateTextStartEvent,
      callbacks: [resolvedOnStart, telemetryDispatcher.onStart],
    });

    try {
      const initialMessages = initialPrompt.messages;
      const initialResponseMessages: Array<ResponseMessage> = [];

      const {
        approvedToolApprovals,
        deniedToolApprovals: collectedDeniedToolApprovals,
      } = collectToolApprovals<TOOLS>({ messages: initialMessages });

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

      const deniedToolApprovals = [
        ...collectedDeniedToolApprovals,
        ...revalidationDeniedToolApprovals,
      ];

      if (
        deniedToolApprovals.length > 0 ||
        localApprovedToolApprovals.length > 0
      ) {
        const toolResults = await executeTools({
          toolCalls: localApprovedToolApprovals.map(
            toolApproval => toolApproval.toolCall,
          ),
          tools: tools as TOOLS,
          callId,
          messages: initialMessages,
          abortSignal: mergedAbortSignal,
          timeout,
          experimental_sandbox: sandbox,
          toolsContext,
          onToolExecutionStart: event =>
            notify({
              event,
              callbacks: [
                resolvedOnToolExecutionStart,
                telemetryDispatcher.onToolExecutionStart,
              ],
            }),
          onToolExecutionEnd: event =>
            notify({
              event,
              callbacks: [
                resolvedOnToolExecutionEnd,
                telemetryDispatcher.onToolExecutionEnd,
              ],
            }),
          executeToolInTelemetryContext: telemetryDispatcher.executeTool,
          runInTracingChannelSpan,
        });

        const toolContent: Array<any> = [];

        // add regular tool results for approved tool calls:
        for (const result of toolResults) {
          const output = result.output;
          const modelOutput = await createToolModelOutput({
            toolCallId: output.toolCallId,
            input: output.input,
            tool: tools?.[output.toolName],
            output:
              output.type === 'tool-result' ? output.output : output.error,
            errorMode: output.type === 'tool-error' ? 'text' : 'none',
          });

          toolContent.push({
            type: 'tool-result' as const,
            toolCallId: output.toolCallId,
            toolName: output.toolName,
            output: modelOutput,
          });
        }

        // add execution denied tool results for all denied tool approvals:
        for (const toolApproval of deniedToolApprovals) {
          toolContent.push({
            type: 'tool-result' as const,
            toolCallId: toolApproval.toolCall.toolCallId,
            toolName: toolApproval.toolCall.toolName,
            output: {
              type: 'execution-denied' as const,
              reason: toolApproval.approvalResponse.reason,
              // For provider-executed tools, include approvalId so provider can correlate
              ...(toolApproval.toolCall.providerExecuted && {
                providerOptions: {
                  openai: {
                    approvalId: toolApproval.approvalResponse.approvalId,
                  },
                },
              }),
            },
          });
        }

        initialResponseMessages.push({
          role: 'tool',
          content: toolContent,
        });
      }

      const callSettings = prepareLanguageModelCallOptions(settings);

      let currentModelResponse: LanguageModelV4GenerateResult & {
        response: { id: string; timestamp: Date; modelId: string };
      };
      let clientToolCalls: Array<TypedToolCall<TOOLS>> = [];
      let clientToolOutputs: Array<ToolOutput<TOOLS>> = [];
      let toolApprovalResponses: Array<ToolApprovalResponseOutput<TOOLS>> = [];
      let deniedToolApprovalResponses: Array<
        ToolApprovalResponseOutput<TOOLS>
      > = [];
      const steps: GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['steps'] =
        [];
      let instructionsForNextStep = initialPrompt.instructions;
      let messagesForNextStep = [
        ...initialMessages,
        ...initialResponseMessages,
      ];

      // Track provider-executed tool calls that support deferred results
      // (e.g., code_execution in programmatic tool calling scenarios).
      // These tools may not return their results in the same turn as their call.
      const pendingDeferredToolCalls = new Map<string, { toolName: string }>();

      do {
        // Set up step timeout if configured
        const stepTimeoutId = setAbortTimeout({
          abortController: stepAbortController,
          label: 'Step',
          timeoutMs: stepTimeoutMs,
        });
        const stepNumber = steps.length;

        try {
          await runInTracingChannelSpan({
            type: 'step',
            event: { callId, stepNumber },
            execute: async () => {
              const accumulatedResponseMessages = [
                ...initialResponseMessages,
                ...steps.flatMap(step => step.response.messages),
              ];
              const stepInputMessages = messagesForNextStep;

              const prepareStepResult = await prepareStep?.({
                model,
                steps,
                stepNumber: steps.length,
                instructions: instructionsForNextStep,
                initialInstructions: initialPrompt.instructions,
                messages: stepInputMessages,
                initialMessages,
                responseMessages: accumulatedResponseMessages,
                runtimeContext,
                toolsContext,
                experimental_sandbox: sandbox,
              });

              const stepSandbox =
                prepareStepResult?.experimental_sandbox ?? sandbox;

              const stepModel = resolveLanguageModel(
                prepareStepResult?.model ?? model,
              );

              const stepInstructions =
                prepareStepResult?.instructions ??
                prepareStepResult?.system ??
                instructionsForNextStep;

              const promptMessages = await convertToLanguageModelPrompt({
                prompt: {
                  instructions: stepInstructions,
                  messages: prepareStepResult?.messages ?? stepInputMessages,
                },
                supportedUrls: await stepModel.supportedUrls,
                download,
                provider: stepModel.provider.split('.')[0],
              });

              runtimeContext =
                prepareStepResult?.runtimeContext ?? runtimeContext;
              toolsContext = prepareStepResult?.toolsContext ?? toolsContext;

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

              const stepMessages =
                prepareStepResult?.messages ?? stepInputMessages;

              const stepProviderOptions = mergeObjects(
                providerOptions,
                prepareStepResult?.providerOptions,
              );

              await notify({
                event: {
                  callId,
                  provider: stepModel.provider,
                  modelId: stepModel.modelId,
                  stepNumber,
                  instructions: stepInstructions,
                  messages: stepMessages,
                  tools,
                  toolChoice: prepareStepResult?.toolChoice ?? toolChoice,
                  activeTools: prepareStepResult?.activeTools ?? activeTools,
                  toolOrder: stepToolOrder,
                  steps: [...steps],
                  providerOptions: stepProviderOptions,
                  output,
                  runtimeContext,
                  promptMessages,
                  stepTools,
                  stepToolChoice,
                  toolsContext,
                },
                callbacks: [
                  resolvedOnStepStart,
                  telemetryDispatcher.onStepStart,
                ],
              });

              const languageModelCallContext = {
                provider: stepModel.provider,
                modelId: stepModel.modelId,
                instructions: stepInstructions,
                messages: stepMessages,
                tools: stepTools,
                ...callSettings,
              };
              const languageModelCallStartEvent = {
                callId,
                ...languageModelCallContext,
              };

              const stepStartTimestampMs = now();

              await notify({
                event: languageModelCallStartEvent,
                callbacks: [
                  resolvedOnLanguageModelCallStart,
                  telemetryDispatcher.onLanguageModelCallStart as
                    | undefined
                    | OnLanguageModelCallStartCallback,
                ],
              });

              const executeLanguageModelCallInTelemetryContext =
                telemetryDispatcher.executeLanguageModelCall ??
                (async <T>({ execute }: { execute: () => PromiseLike<T> }) =>
                  await execute());

              currentModelResponse = await retry(async () => {
                const result = await executeLanguageModelCallInTelemetryContext(
                  {
                    ...languageModelCallStartEvent,
                    execute: async () =>
                      await stepModel.doGenerate({
                        ...callSettings,
                        tools: stepTools,
                        toolChoice: stepToolChoice,
                        responseFormat: await output?.responseFormat,
                        prompt: promptMessages,
                        providerOptions: stepProviderOptions,
                        abortSignal: mergedAbortSignal,
                        headers: headersWithUserAgent,
                      }),
                  },
                );

                const responseData = {
                  id: result.response?.id ?? generateId(),
                  timestamp: result.response?.timestamp ?? new Date(),
                  modelId: result.response?.modelId ?? stepModel.modelId,
                  headers: result.response?.headers,
                  body: result.response?.body,
                };

                return { ...result, response: responseData };
              });
              const responseTimeMs = now() - stepStartTimestampMs;
              const stepUsage = asLanguageModelUsage(
                currentModelResponse.usage,
              );

              // parse tool calls:
              const stepToolCalls: TypedToolCall<TOOLS>[] = await Promise.all(
                currentModelResponse.content
                  .filter(
                    (part): part is LanguageModelV4ToolCall =>
                      part.type === 'tool-call',
                  )
                  .map(toolCall =>
                    parseToolCall({
                      toolCall,
                      tools,
                      repairToolCall,
                      refineToolInput,
                      instructions: stepInstructions,
                      messages: stepMessages,
                    }),
                  ),
              );
              const toolApprovalRequests: Record<
                string,
                ToolApprovalRequestOutput<TOOLS>
              > = {};
              const stepToolApprovalResponses: Record<
                string,
                ToolApprovalResponseOutput<TOOLS>
              > = {};
              const blockedToolCallIds = new Set<string>();

              const modelCallContent = asContent({
                content: currentModelResponse.content,
                toolCalls: stepToolCalls,
                toolOutputs: [],
                toolApprovalRequests: [],
                toolApprovalResponses: [],
                tools,
              });

              await notify({
                event: {
                  callId,
                  provider: stepModel.provider,
                  modelId: stepModel.modelId,
                  finishReason: currentModelResponse.finishReason.unified,
                  usage: stepUsage,
                  content: modelCallContent,
                  responseId: currentModelResponse.response.id,
                  performance: {
                    responseTimeMs,
                    effectiveOutputTokensPerSecond: calculateTokensPerSecond({
                      tokens: stepUsage.outputTokens,
                      durationMs: responseTimeMs,
                    }),
                    outputTokensPerSecond: undefined,
                    inputTokensPerSecond: undefined,
                    effectiveTotalTokensPerSecond: calculateTokensPerSecond({
                      tokens: sumTokenCounts(
                        stepUsage.inputTokens,
                        stepUsage.outputTokens,
                      ),
                      durationMs: responseTimeMs,
                    }),
                    timeToFirstOutputMs: undefined,
                  },
                },
                callbacks: [
                  resolvedOnLanguageModelCallEnd,
                  telemetryDispatcher.onLanguageModelCallEnd as
                    | undefined
                    | OnLanguageModelCallEndCallback<TOOLS>,
                ],
              });

              // notify the tools that the tool calls are available:
              for (const toolCall of stepToolCalls) {
                if (toolCall.invalid) {
                  continue; // ignore invalid tool calls
                }

                const tool = tools?.[toolCall.toolName];

                if (tool == null) {
                  // ignore tool calls for tools that are not available,
                  // e.g. provider-executed dynamic tools
                  continue;
                }

                if (tool?.onInputAvailable != null) {
                  await tool.onInputAvailable({
                    input: toolCall.input,
                    toolCallId: toolCall.toolCallId,
                    messages: stepMessages,
                    abortSignal: mergedAbortSignal,
                    context: runtimeContext,
                  });
                }

                const toolApprovalStatus = await resolveToolApproval({
                  tools,
                  toolApproval,
                  toolCall,
                  messages: stepMessages,
                  toolsContext,
                  runtimeContext,
                });

                // Tools that don't require approval ('not-applicable') must not
                // consume an approval id, so that id generation stays stable for
                // callers that rely on deterministic id sequences.
                if (toolApprovalStatus.type === 'not-applicable') {
                  continue;
                }

                const approvalId = generateId();
                const signature = await maybeSignApproval({
                  secret: experimental_toolApprovalSecret,
                  approvalId,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  input: toolCall.input,
                });

                switch (toolApprovalStatus.type) {
                  case 'user-approval': {
                    toolApprovalRequests[toolCall.toolCallId] = {
                      type: 'tool-approval-request',
                      approvalId,
                      toolCall,
                      ...(signature != null ? { signature } : {}),
                    };
                    blockedToolCallIds.add(toolCall.toolCallId);
                    break;
                  }

                  case 'approved': {
                    toolApprovalRequests[toolCall.toolCallId] = {
                      type: 'tool-approval-request',
                      approvalId,
                      toolCall,
                      isAutomatic: true,
                      ...(signature != null ? { signature } : {}),
                    };
                    stepToolApprovalResponses[toolCall.toolCallId] = {
                      type: 'tool-approval-response',
                      approvalId,
                      toolCall,
                      approved: true,
                      reason: toolApprovalStatus.reason,
                      providerExecuted: toolCall.providerExecuted,
                    };
                    break;
                  }

                  case 'denied': {
                    toolApprovalRequests[toolCall.toolCallId] = {
                      type: 'tool-approval-request',
                      approvalId,
                      toolCall,
                      isAutomatic: true,
                      ...(signature != null ? { signature } : {}),
                    };
                    stepToolApprovalResponses[toolCall.toolCallId] = {
                      type: 'tool-approval-response',
                      approvalId,
                      toolCall,
                      approved: false,
                      reason: toolApprovalStatus.reason,
                      providerExecuted: toolCall.providerExecuted,
                    };
                    blockedToolCallIds.add(toolCall.toolCallId);
                    break;
                  }
                }
              }

              // insert error tool outputs for invalid tool calls:
              // TODO AI SDK 6: invalid inputs should not require output parts
              const invalidToolCalls = stepToolCalls.filter(
                toolCall => toolCall.invalid && toolCall.dynamic,
              );

              clientToolOutputs = [];

              for (const toolCall of invalidToolCalls) {
                clientToolOutputs.push({
                  type: 'tool-error',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  input: toolCall.input,
                  error: getErrorMessage(toolCall.error!),
                  dynamic: true,
                });
              }

              // execute client tool calls:
              clientToolCalls = stepToolCalls.filter(
                toolCall => !toolCall.providerExecuted,
              );
              toolApprovalResponses = Object.values(stepToolApprovalResponses);
              deniedToolApprovalResponses = toolApprovalResponses.filter(
                toolApprovalResponse => toolApprovalResponse.approved === false,
              );
              const toolExecutionMs: Record<string, number> = {};

              if (tools != null) {
                const toolExecutionResults = await executeTools({
                  toolCalls: clientToolCalls.filter(
                    toolCall =>
                      !toolCall.invalid &&
                      !blockedToolCallIds.has(toolCall.toolCallId),
                  ),
                  tools,
                  callId,
                  messages: stepMessages,
                  abortSignal: mergedAbortSignal,
                  timeout,
                  experimental_sandbox: stepSandbox,
                  toolsContext,
                  onToolExecutionStart: event =>
                    notify({
                      event,
                      callbacks: [
                        resolvedOnToolExecutionStart,
                        telemetryDispatcher.onToolExecutionStart,
                      ],
                    }),
                  onToolExecutionEnd: event =>
                    notify({
                      event,
                      callbacks: [
                        resolvedOnToolExecutionEnd,
                        telemetryDispatcher.onToolExecutionEnd,
                      ],
                    }),
                  executeToolInTelemetryContext:
                    telemetryDispatcher.executeTool,
                  runInTracingChannelSpan,
                });

                for (const result of toolExecutionResults) {
                  toolExecutionMs[result.output.toolCallId] =
                    result.toolExecutionMs;
                  clientToolOutputs.push(result.output);
                }
              }

              const stepTimeMs = now() - stepStartTimestampMs;
              const stepPerformance: StepResultPerformance = {
                effectiveOutputTokensPerSecond: calculateTokensPerSecond({
                  tokens: stepUsage.outputTokens,
                  durationMs: responseTimeMs,
                }),
                outputTokensPerSecond: undefined,
                inputTokensPerSecond: undefined,
                effectiveTotalTokensPerSecond: calculateTokensPerSecond({
                  tokens: sumTokenCounts(
                    stepUsage.inputTokens,
                    stepUsage.outputTokens,
                  ),
                  durationMs: responseTimeMs,
                }),
                stepTimeMs,
                responseTimeMs,
                toolExecutionMs,
                timeToFirstOutputMs: undefined,
              };

              // Track provider-executed tool calls that support deferred results.
              // In programmatic tool calling, a server tool (e.g., code_execution) may
              // trigger a client tool, and the server tool's result is deferred until
              // the client tool's result is sent back.
              for (const toolCall of stepToolCalls) {
                if (!toolCall.providerExecuted) continue;
                const tool = tools?.[toolCall.toolName];
                if (tool?.type === 'provider' && tool.supportsDeferredResults) {
                  // Check if this tool call already has a result in the current response
                  const hasResultInResponse = currentModelResponse.content.some(
                    part =>
                      part.type === 'tool-result' &&
                      part.toolCallId === toolCall.toolCallId,
                  );
                  if (!hasResultInResponse) {
                    pendingDeferredToolCalls.set(toolCall.toolCallId, {
                      toolName: toolCall.toolName,
                    });
                  }
                }
              }

              // Mark deferred tool calls as resolved when we receive their results
              for (const part of currentModelResponse.content) {
                if (part.type === 'tool-result') {
                  pendingDeferredToolCalls.delete(part.toolCallId);
                }
              }

              // content:
              const stepContent = asContent({
                content: currentModelResponse.content,
                toolCalls: stepToolCalls,
                toolOutputs: clientToolOutputs,
                toolApprovalRequests: Object.values(toolApprovalRequests),
                toolApprovalResponses,
                tools,
              });

              const stepResponseMessages = await toResponseMessages({
                content: stepContent,
                tools,
              });

              // Add step information (after response messages are updated):
              // Conditionally include request.body and response.body based on include settings.
              // Large payloads (e.g., base64-encoded images) can cause memory issues.
              const stepRequest: LanguageModelRequestMetadata = {
                ...currentModelResponse.request,
                body: include.requestBody
                  ? currentModelResponse.request?.body
                  : undefined,
                messages: include.requestMessages
                  ? cloneModelMessages(stepMessages)
                  : undefined,
              };

              const stepResponse = {
                ...currentModelResponse.response,
                // deep clone msgs to avoid mutating step results in multi-step:
                messages: cloneModelMessages(stepResponseMessages),
                // Conditionally include response body:
                body: include.responseBody
                  ? currentModelResponse.response?.body
                  : undefined,
              };

              const currentStepResult: StepResult<TOOLS, RUNTIME_CONTEXT> =
                new DefaultStepResult({
                  callId,
                  stepNumber,
                  provider: stepModel.provider,
                  modelId: stepModel.modelId,
                  runtimeContext,
                  content: stepContent,
                  finishReason: currentModelResponse.finishReason.unified,
                  rawFinishReason: currentModelResponse.finishReason.raw,
                  usage: stepUsage,
                  performance: stepPerformance,
                  warnings: currentModelResponse.warnings,
                  providerMetadata: currentModelResponse.providerMetadata,
                  request: stepRequest,
                  response: stepResponse,
                  toolsContext,
                });

              logWarnings({
                warnings: currentModelResponse.warnings ?? [],
                provider: stepModel.provider,
                model: stepModel.modelId,
              });

              steps.push(currentStepResult);
              instructionsForNextStep = stepInstructions;
              messagesForNextStep = [...stepMessages, ...stepResponseMessages];

              await notify({
                event: currentStepResult,
                callbacks: [resolvedOnStepEnd, telemetryDispatcher.onStepEnd],
              });

              return currentStepResult;
            },
          });
        } finally {
          if (stepTimeoutId != null) {
            clearTimeout(stepTimeoutId);
          }
        }
      } while (
        // Continue if:
        // 1. There are client tool calls that have all been executed or denied, OR
        // 2. There are pending deferred results from provider-executed tools
        ((clientToolCalls.length > 0 &&
          clientToolOutputs.length + deniedToolApprovalResponses.length ===
            clientToolCalls.length) ||
          pendingDeferredToolCalls.size > 0) &&
        // continue until a stop condition is met:
        !(await isStopConditionMet({ stopConditions, steps }))
      );

      const lastStep = steps[steps.length - 1];

      const totalUsage = steps.reduce(
        (totalUsage, step) => {
          return addLanguageModelUsage(totalUsage, step.usage);
        },
        {
          inputTokens: undefined,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: undefined,
          outputTokenDetails: {
            textTokens: undefined,
            reasoningTokens: undefined,
          },
          totalTokens: undefined,
        } as LanguageModelUsage,
      );

      const files = steps.flatMap(step => step.files);
      const sources = steps.flatMap(step => step.sources);
      const toolCalls = steps.flatMap(step => step.toolCalls);
      const staticToolCalls = steps.flatMap(step => step.staticToolCalls);
      const dynamicToolCalls = steps.flatMap(step => step.dynamicToolCalls);
      const toolResults = steps.flatMap(step => step.toolResults);
      const staticToolResults = steps.flatMap(step => step.staticToolResults);
      const dynamicToolResults = steps.flatMap(step => step.dynamicToolResults);
      const warnings = steps.flatMap(step => step.warnings ?? []);

      const onEndEvent = {
        callId,
        stepNumber: lastStep.stepNumber,
        model: lastStep.model,
        runtimeContext: lastStep.runtimeContext,
        finishReason: lastStep.finishReason,
        rawFinishReason: lastStep.rawFinishReason,
        usage: totalUsage,
        totalUsage,
        content: steps.flatMap(step => step.content),
        text: lastStep.text,
        reasoning: lastStep.reasoning,
        reasoningText: lastStep.reasoningText,
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
          ...steps.flatMap(step => step.response.messages),
        ],
        warnings,
        request: lastStep.request,
        response: lastStep.response,
        providerMetadata: lastStep.providerMetadata,
        steps,
        finalStep: lastStep,
        toolsContext,
      };

      await notify({
        event: onEndEvent,
        callbacks: [onEnd, telemetryDispatcher.onEnd],
      });

      // parse output only if the last step was finished with "stop":
      let resolvedOutput;
      if (lastStep.finishReason === 'stop') {
        const outputSpecification = output ?? text();
        resolvedOutput = await outputSpecification.parseCompleteOutput(
          { text: lastStep.text },
          {
            response: lastStep.response,
            usage: lastStep.usage,
            finishReason: lastStep.finishReason,
          },
        );
      }

      return new DefaultGenerateTextResult({
        initialResponseMessages,
        steps,
        totalUsage,
        output: resolvedOutput,
      });
    } catch (error) {
      await telemetryDispatcher.onError?.({ callId, error });
      throw wrapGatewayError(error);
    }
  };

  return await runInTracingChannelSpan({
    type: 'generateText',
    event: generateTextStartEvent,
    execute: executeGenerateText,
  });
}

async function executeTools<TOOLS extends ToolSet>({
  toolCalls,
  tools,
  callId,
  messages,
  abortSignal,
  timeout,
  experimental_sandbox: sandbox,
  toolsContext,
  onToolExecutionStart,
  onToolExecutionEnd,
  executeToolInTelemetryContext,
  runInTracingChannelSpan,
}: {
  toolCalls: Array<TypedToolCall<TOOLS>>;
  tools: TOOLS;
  callId: string;
  messages: ModelMessage[];
  abortSignal: AbortSignal | undefined;
  timeout?: TimeoutConfiguration<TOOLS>;
  experimental_sandbox?: SandboxSession;
  toolsContext: InferToolSetContext<TOOLS>;
  onToolExecutionStart?: OnToolExecutionStartCallback<TOOLS>;
  onToolExecutionEnd?: OnToolExecutionEndCallback<TOOLS>;
  executeToolInTelemetryContext?: Telemetry['executeTool'];
  runInTracingChannelSpan?: NonNullable<
    TelemetryDispatcher['runInTracingChannelSpan']
  >;
}): Promise<
  Array<{
    output: ToolOutput<TOOLS>;
    toolExecutionMs: number;
  }>
> {
  const toolResults = await Promise.all(
    toolCalls.map(
      async toolCall =>
        await executeToolCall({
          toolCall,
          tools,
          callId,
          messages,
          abortSignal,
          timeout,
          experimental_sandbox: sandbox,
          toolsContext,
          onToolExecutionStart,
          onToolExecutionEnd,
          executeToolInTelemetryContext,
          runInTracingChannelSpan,
        }),
    ),
  );

  return toolResults.filter(
    (result): result is NonNullable<typeof result> => result != null,
  );
}

class DefaultGenerateTextResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  OUTPUT extends Output,
> implements GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT> {
  readonly steps: GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['steps'];
  readonly totalUsage: LanguageModelUsage;
  private readonly _output: InferCompleteOutput<OUTPUT> | undefined;

  constructor(options: {
    initialResponseMessages: Array<ResponseMessage>;
    steps: GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['steps'];
    output: InferCompleteOutput<OUTPUT> | undefined;
    totalUsage: LanguageModelUsage;
  }) {
    this.initialResponseMessages = options.initialResponseMessages;
    this.steps = options.steps;
    this._output = options.output;
    this.totalUsage = options.totalUsage;
  }

  private readonly initialResponseMessages: Array<ResponseMessage>;

  get finalStep() {
    return this.steps.at(-1)!;
  }

  get content() {
    return this.steps.flatMap(step => step.content);
  }

  get text() {
    return this.finalStep.text;
  }

  get files() {
    return this.steps.flatMap(step => step.files);
  }

  get reasoningText() {
    return this.finalStep.reasoningText;
  }

  get reasoning() {
    return convertToReasoningOutputs(this.finalStep.reasoning);
  }

  get toolCalls() {
    return this.steps.flatMap(step => step.toolCalls);
  }

  get staticToolCalls() {
    return this.steps.flatMap(step => step.staticToolCalls);
  }

  get dynamicToolCalls() {
    return this.steps.flatMap(step => step.dynamicToolCalls);
  }

  get toolResults() {
    return this.steps.flatMap(step => step.toolResults);
  }

  get staticToolResults() {
    return this.steps.flatMap(step => step.staticToolResults);
  }

  get dynamicToolResults() {
    return this.steps.flatMap(step => step.dynamicToolResults);
  }

  get sources() {
    return this.steps.flatMap(step => step.sources);
  }

  get finishReason() {
    return this.finalStep.finishReason;
  }

  get rawFinishReason() {
    return this.finalStep.rawFinishReason;
  }

  get warnings() {
    return this.steps.flatMap(step => step.warnings ?? []);
  }

  get providerMetadata() {
    return this.finalStep.providerMetadata;
  }

  get response() {
    return this.finalStep.response;
  }

  get responseMessages() {
    return [
      ...this.initialResponseMessages,
      ...this.steps.flatMap(step => step.response.messages),
    ];
  }

  get request() {
    return this.finalStep.request;
  }

  get usage() {
    return this.totalUsage;
  }

  get output() {
    if (this._output == null) {
      throw new NoOutputGeneratedError();
    }

    return this._output;
  }
}

function asContent<TOOLS extends ToolSet>({
  content,
  toolCalls,
  toolOutputs,
  toolApprovalRequests,
  toolApprovalResponses,
  tools,
}: {
  content: Array<LanguageModelV4Content>;
  toolCalls: Array<TypedToolCall<TOOLS>>;
  toolOutputs: Array<ToolOutput<TOOLS>>;
  toolApprovalRequests: Array<ToolApprovalRequestOutput<TOOLS>>;
  toolApprovalResponses: Array<ToolApprovalResponseOutput<TOOLS>>;
  tools: TOOLS | undefined;
}): Array<ContentPart<TOOLS>> {
  const contentParts: Array<ContentPart<TOOLS>> = [];
  const toolOutputsWithApprovalResponses: Array<ToolOutput<TOOLS>> = [];
  const toolOutputsWithoutApprovalResponses: Array<ToolOutput<TOOLS>> = [];
  const toolCallIdsWithApprovalResponses = new Set(
    toolApprovalResponses.map(
      toolApprovalResponse => toolApprovalResponse.toolCall.toolCallId,
    ),
  );

  for (const part of content) {
    switch (part.type) {
      case 'text':
      case 'reasoning':
      case 'custom':
      case 'source':
        contentParts.push(part);
        break;

      case 'file':
      case 'reasoning-file': {
        contentParts.push({
          type: part.type as 'file' | 'reasoning-file',
          file: new DefaultGeneratedFile({
            data:
              part.data.type === 'data'
                ? part.data.data
                : part.data.url.toString(),
            mediaType: part.mediaType,
          }),
          ...(part.providerMetadata != null
            ? { providerMetadata: part.providerMetadata }
            : {}),
        });
        break;
      }

      case 'tool-call': {
        contentParts.push(
          toolCalls.find(toolCall => toolCall.toolCallId === part.toolCallId)!,
        );
        break;
      }

      case 'tool-result': {
        const toolCall = toolCalls.find(
          toolCall => toolCall.toolCallId === part.toolCallId,
        );

        // Handle deferred results for provider-executed tools (e.g., programmatic tool calling).
        // When a server tool (like code_execution) triggers a client tool, the server tool's
        // result may be deferred to a later turn. In this case, there's no matching tool-call
        // in the current response.
        if (toolCall == null) {
          const tool = tools?.[part.toolName];
          const supportsDeferredResults =
            tool?.type === 'provider' && tool.supportsDeferredResults;

          if (!supportsDeferredResults) {
            throw new Error(`Tool call ${part.toolCallId} not found.`);
          }

          // Create tool result without tool call input (deferred result)
          if (part.isError) {
            contentParts.push({
              type: 'tool-error' as const,
              toolCallId: part.toolCallId,
              toolName: part.toolName as keyof TOOLS & string,
              input: undefined,
              error: part.result,
              providerExecuted: true,
              dynamic: part.dynamic,
              ...(part.providerMetadata != null
                ? { providerMetadata: part.providerMetadata }
                : {}),
              ...(tool?.metadata != null
                ? { toolMetadata: tool.metadata }
                : {}),
            } as TypedToolError<TOOLS>);
          } else {
            contentParts.push({
              type: 'tool-result' as const,
              toolCallId: part.toolCallId,
              toolName: part.toolName as keyof TOOLS & string,
              input: undefined,
              output: part.result,
              providerExecuted: true,
              dynamic: part.dynamic,
              ...(part.providerMetadata != null
                ? { providerMetadata: part.providerMetadata }
                : {}),
              ...(tool?.metadata != null
                ? { toolMetadata: tool.metadata }
                : {}),
            } as TypedToolResult<TOOLS>);
          }
          break;
        }

        if (part.isError) {
          contentParts.push({
            type: 'tool-error' as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName as keyof TOOLS & string,
            input: toolCall.input,
            error: part.result,
            providerExecuted: true,
            dynamic: toolCall.dynamic,
            ...(part.providerMetadata != null
              ? { providerMetadata: part.providerMetadata }
              : {}),
            ...(toolCall.toolMetadata != null
              ? { toolMetadata: toolCall.toolMetadata }
              : {}),
          } as TypedToolError<TOOLS>);
        } else {
          contentParts.push({
            type: 'tool-result' as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName as keyof TOOLS & string,
            input: toolCall.input,
            output: part.result,
            providerExecuted: true,
            dynamic: toolCall.dynamic,
            ...(part.providerMetadata != null
              ? { providerMetadata: part.providerMetadata }
              : {}),
            ...(toolCall.toolMetadata != null
              ? { toolMetadata: toolCall.toolMetadata }
              : {}),
          } as TypedToolResult<TOOLS>);
        }
        break;
      }

      case 'tool-approval-request': {
        const toolCall = toolCalls.find(
          toolCall => toolCall.toolCallId === part.toolCallId,
        );

        if (toolCall == null) {
          throw new ToolCallNotFoundForApprovalError({
            toolCallId: part.toolCallId,
            approvalId: part.approvalId,
          });
        }

        contentParts.push({
          type: 'tool-approval-request' as const,
          approvalId: part.approvalId,
          toolCall,
        });
        break;
      }
    }
  }

  for (const toolOutput of toolOutputs) {
    if (toolCallIdsWithApprovalResponses.has(toolOutput.toolCallId)) {
      toolOutputsWithApprovalResponses.push(toolOutput);
    } else {
      toolOutputsWithoutApprovalResponses.push(toolOutput);
    }
  }

  return [
    ...contentParts,
    ...toolOutputsWithoutApprovalResponses,
    ...toolApprovalRequests,
    ...toolApprovalResponses,
    ...toolOutputsWithApprovalResponses,
  ];
}
