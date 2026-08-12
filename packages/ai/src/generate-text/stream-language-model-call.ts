import {
  getErrorMessage,
  type LanguageModelV4Prompt,
  type LanguageModelV4StreamPart,
  type SharedV4Headers,
} from '@ai-sdk/provider';
import {
  createIdGenerator,
  type Arrayable,
  type Experimental_SandboxSession as SandboxSession,
  type IdGenerator,
  type InferToolSetContext,
  type ModelMessage,
  type ProviderOptions,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import { ToolCallNotFoundForApprovalError } from '../error/tool-call-not-found-for-approval-error';
import { resolveLanguageModel } from '../model/resolve-model';
import type { Instructions, Prompt } from '../prompt';
import { convertToLanguageModelPrompt } from '../prompt/convert-to-language-model-prompt';
import type { LanguageModelCallOptions } from '../prompt/language-model-call-options';
import { prepareToolChoice } from '../prompt/prepare-tool-choice';
import { prepareTools } from '../prompt/prepare-tools';
import { standardizePrompt } from '../prompt/standardize-prompt';
import type { Telemetry } from '../telemetry/telemetry';
import type {
  CallWarning,
  FinishReason,
  LanguageModel,
  ToolChoice,
} from '../types/language-model';
import type { ProviderMetadata } from '../types/provider-metadata';
import { asLanguageModelUsage, type LanguageModelUsage } from '../types/usage';
import {
  createAsyncIterableStream,
  type AsyncIterableStream,
} from '../util/async-iterable-stream';
import type { DownloadFunction } from '../util/download/download-function';
import { notify } from '../util/notify';
import { now as originalNow } from '../util/now';
import { calculateTokensPerSecond } from './calculate-tokens-per-second';
import type { ContentPart } from './content-part';
import { DefaultGeneratedFileWithType } from './generated-file';
import type { OutputChunkTimingStats } from './step-result';
import type {
  OnLanguageModelCallEndCallback,
  OnLanguageModelCallStartCallback,
} from './language-model-events';
import type { Output } from './output';
import { parseToolCall } from './parse-tool-call';
import type {
  TextStreamFilePart,
  TextStreamPart,
  TextStreamReasoningDeltaPart,
  TextStreamReasoningFilePart,
  TextStreamTextDeltaPart,
  TextStreamToolApprovalRequestPart,
  TextStreamToolApprovalResponsePart,
  TextStreamToolCallPart,
  TextStreamToolErrorPart,
  TextStreamToolResultPart,
} from './stream-text-result';
import { sumTokenCounts } from './sum-token-counts';
import type { TypedToolCall } from './tool-call';
import type { ToolCallRepairFunction } from './tool-call-repair-function';
import type { TypedToolError } from './tool-error';
import type { ToolInputRefinement } from './tool-input-refinement';
import type { ToolOrder } from './tool-order';
import type { TypedToolResult } from './tool-result';

const originalGenerateId = createIdGenerator({
  prefix: 'aitxt',
  size: 24,
});

const originalGenerateCallId = createIdGenerator({
  prefix: 'call',
  size: 24,
});

export type LanguageModelStreamPart<TOOLS extends ToolSet = ToolSet> =
  | Exclude<
      TextStreamPart<TOOLS>,
      {
        type:
          | 'finish'
          | 'stream-start'
          | 'tool-output-denied'
          | 'start-step'
          | 'finish-step'
          | 'start'
          | 'abort';
      }
    >
  | TextStreamTextDeltaPart
  | TextStreamReasoningDeltaPart
  | TextStreamFilePart
  | TextStreamReasoningFilePart
  | TextStreamToolApprovalRequestPart<TOOLS>
  | TextStreamToolApprovalResponsePart<TOOLS>
  | TextStreamToolCallPart<TOOLS>
  | TextStreamToolResultPart<TOOLS>
  | TextStreamToolErrorPart<TOOLS>
  | {
      type: 'model-call-end';
      finishReason: FinishReason;
      rawFinishReason: string | undefined;
      usage: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      performance: {
        responseTimeMs: number;
        effectiveOutputTokensPerSecond: number;
        outputTokensPerSecond: number | undefined;
        inputTokensPerSecond: number | undefined;
        effectiveTotalTokensPerSecond: number;
        timeToFirstOutputMs: number | undefined;
        timeBetweenOutputChunksMs?: OutputChunkTimingStats;
      };
    }
  | {
      type: 'model-call-start';
      warnings: Array<CallWarning>;
    }
  | {
      type: 'model-call-response-metadata';

      /**
       * ID for the generated response, if the provider sends one.
       */
      id?: string;

      /**
       * Timestamp for the start of the generated response, if the provider sends one.
       */
      timestamp?: Date;

      /**
       * The ID of the response model that was used to generate the response, if the provider sends one.
       */
      modelId?: string;
    };

/**
 * Streams a single language model call after standardizing the prompt and tools.
 *
 * The returned stream emits model call parts together with request and response
 * metadata when available.
 *
 * @param model - The language model to use.
 * @param tools - Tools that are accessible to and can be called by the model. The model needs to support calling tools.
 * @param output - Output configuration that controls the response format requested from the model.
 * @param toolChoice - The tool choice strategy for the model call.
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
 * @param reasoning - Reasoning configuration for the model call.
 *
 * @param download - A function that downloads URLs as part of prompt conversion.
 * @param abortSignal - An optional abort signal that can be used to cancel the call.
 * @param headers - Additional HTTP headers to be sent with the request.
 * @param includeRawChunks - Whether to include raw provider stream chunks in the model stream.
 * @param providerOptions - Additional provider-specific options.
 * @param repairToolCall - A function that can repair invalid tool calls before they are emitted.
 * @param refineToolInput - Optional mapping of tool names to functions that refine parsed tool inputs before they are emitted, used for telemetry, or executed.
 * @param onStart - A callback that receives the fully converted prompt before the model call starts.
 *
 * @returns A stream of model call parts together with request and response metadata when available.
 */
export async function streamLanguageModelCall<
  TOOLS extends ToolSet,
  OUTPUT extends Output = Output,
>({
  model,
  tools,
  toolOrder,
  output,
  toolChoice,
  prompt,
  system,
  instructions,
  messages,
  allowSystemInMessages,
  download,
  abortSignal,
  headers,
  includeRawChunks,
  providerOptions,
  repairToolCall,
  refineToolInput,
  executeLanguageModelCallInTelemetryContext = async ({ execute }) =>
    await execute(),
  callId,
  toolsContext,
  experimental_sandbox: sandbox,
  _internal: {
    generateId = originalGenerateId,
    generateCallId = originalGenerateCallId,
    now = originalNow,
  } = {},
  onStart,
  onLanguageModelCallStart,
  onLanguageModelCallEnd,
  ...callSettings
}: {
  model: LanguageModel;
  tools?: TOOLS;
  toolOrder?: ToolOrder<TOOLS>;
  output?: OUTPUT;
  toolChoice?: ToolChoice<TOOLS>;
  download?: DownloadFunction;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
  includeRawChunks?: boolean;
  providerOptions?: ProviderOptions;
  repairToolCall?: ToolCallRepairFunction<TOOLS> | undefined;
  refineToolInput?: ToolInputRefinement<TOOLS> | undefined;
  executeLanguageModelCallInTelemetryContext?: Telemetry['executeLanguageModelCall'];
  callId?: string;
  /**
   * Tool context used to resolve per-call tool metadata such as function
   * descriptions before sending tools to the model.
   */
  toolsContext?: InferToolSetContext<TOOLS>;
  /**
   * Sandbox session passed through for resolving tool descriptions that depend on it.
   */
  experimental_sandbox?: SandboxSession;
  _internal?: {
    generateId?: IdGenerator;
    generateCallId?: IdGenerator;
    now?: () => number;
  };
  onLanguageModelCallStart?: Arrayable<OnLanguageModelCallStartCallback>;
  onLanguageModelCallEnd?: Arrayable<OnLanguageModelCallEndCallback<TOOLS>>;

  // onStart is currently required because the telemetry callbacks need
  // LanguageModelV4Prompt and we only want download URLs at most once.
  // Therefore convertToLanguageModelPrompt can only be called once
  // per step and the resulting LanguageModelV4Prompt needs to be
  // passed to the onStart callback.
  //
  // TODO explore decoupling by changing the telemetry callbacks to accept
  // a Prompt or a standardized Prompt.
  onStart?: (args: {
    promptMessages: LanguageModelV4Prompt;
  }) => Promise<void> | void;
} & Prompt &
  LanguageModelCallOptions): Promise<{
  stream: AsyncIterableStream<LanguageModelStreamPart<TOOLS>>;
  request?: {
    /**
     * Request HTTP body that was sent to the provider API.
     */
    body?: unknown;
  };
  response?: {
    /**
     * Response headers.
     */
    headers?: SharedV4Headers;
  };
}> {
  const resolvedModel = resolveLanguageModel(model);
  const effectiveCallId = callId ?? generateCallId();

  const standardizedPrompt = await standardizePrompt({
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
  } as Prompt);

  const promptMessages = await convertToLanguageModelPrompt({
    prompt: {
      instructions: standardizedPrompt.instructions,
      messages: standardizedPrompt.messages,
    },
    supportedUrls: await resolvedModel.supportedUrls,
    download,
    provider: resolvedModel.provider.split('.')[0],
  });

  const stepTools = await prepareTools({
    tools,
    toolOrder,
    toolsContext,
    experimental_sandbox: sandbox,
  });

  const stepToolChoice = prepareToolChoice({
    toolChoice,
  });

  await notify({
    event: { promptMessages },
    callbacks: onStart,
  });

  const languageModelCallContext = {
    provider: resolvedModel.provider,
    modelId: resolvedModel.modelId,
    instructions: standardizedPrompt.instructions,
    messages: standardizedPrompt.messages,
    tools: stepTools,
    ...callSettings,
  };
  const languageModelCallStartEvent = {
    callId: effectiveCallId,
    ...languageModelCallContext,
  };

  await notify({
    event: languageModelCallStartEvent,
    callbacks: onLanguageModelCallStart,
  });

  const callStartTimestampMs = now();

  const {
    stream: languageModelStream,
    response,
    request,
  } = await executeLanguageModelCallInTelemetryContext({
    ...languageModelCallStartEvent,
    execute: async () =>
      await resolvedModel.doStream({
        ...callSettings,
        tools: stepTools,
        toolChoice: stepToolChoice,
        responseFormat: await output?.responseFormat,
        prompt: promptMessages,
        providerOptions,
        abortSignal,
        headers,
        includeRawChunks,
      }),
  });

  const standardizedStream = languageModelStream.pipeThrough(
    createLanguageModelV4StreamPartToLanguageModelStreamPartTransform({
      tools,
      instructions: standardizedPrompt.instructions,
      messages: standardizedPrompt.messages,
      repairToolCall,
      refineToolInput,
      callId: effectiveCallId,
      provider: resolvedModel.provider,
      modelId: resolvedModel.modelId,
      generateId,
      now,
      callStartTimestampMs,
      onLanguageModelCallEnd,
    }),
  );

  return {
    stream: createAsyncIterableStream(standardizedStream),
    response,
    request,
  };
}

// Java Loves You.
function createLanguageModelV4StreamPartToLanguageModelStreamPartTransform<
  TOOLS extends ToolSet,
>({
  tools,
  instructions,
  messages,
  repairToolCall,
  refineToolInput,
  callId,
  provider,
  modelId,
  generateId,
  now,
  callStartTimestampMs,
  onLanguageModelCallEnd,
}: {
  tools: TOOLS | undefined;
  instructions: Instructions | undefined;
  messages: ModelMessage[];
  repairToolCall: ToolCallRepairFunction<TOOLS> | undefined;
  refineToolInput: ToolInputRefinement<TOOLS> | undefined;
  callId: string;
  provider: string;
  modelId: string;
  generateId: IdGenerator;
  now: () => number;
  callStartTimestampMs: number;
  onLanguageModelCallEnd?: Arrayable<OnLanguageModelCallEndCallback<TOOLS>>;
}) {
  // keep track of parsed tool calls so provider-emitted approval requests can reference them
  // keep track of tool inputs for provider-side tool results
  const toolCallsByToolCallId = new Map<string, TypedToolCall<TOOLS>>();
  const modelCallContent: Array<ContentPart<TOOLS>> = [];
  const textPartIndexes = new Map<string, number>();
  const reasoningPartIndexes = new Map<string, number>();
  let responseId = generateId();
  let timeToFirstOutputMs: number | undefined;
  let previousOutputChunkTimestampMs: number | undefined;
  const timeBetweenOutputChunksMs: number[] = [];

  return new TransformStream<
    LanguageModelV4StreamPart,
    LanguageModelStreamPart<TOOLS>
  >({
    async transform(chunk, controller) {
      if (isOutputChunk(chunk)) {
        const outputChunkTimestampMs = now();

        if (timeToFirstOutputMs == null) {
          timeToFirstOutputMs = outputChunkTimestampMs - callStartTimestampMs;
        } else if (previousOutputChunkTimestampMs != null) {
          timeBetweenOutputChunksMs.push(
            outputChunkTimestampMs - previousOutputChunkTimestampMs,
          );
        }

        previousOutputChunkTimestampMs = outputChunkTimestampMs;
      }

      switch (chunk.type) {
        case 'text-start':
          upsertTextContentPart({
            content: modelCallContent,
            partIndexes: textPartIndexes,
            id: chunk.id,
            type: 'text',
            providerMetadata: chunk.providerMetadata,
          });
          controller.enqueue(chunk);
          break;

        case 'text-delta':
          upsertTextContentPart({
            content: modelCallContent,
            partIndexes: textPartIndexes,
            id: chunk.id,
            type: 'text',
            textDelta: chunk.delta,
            providerMetadata: chunk.providerMetadata,
          });
          controller.enqueue({
            type: 'text-delta',
            id: chunk.id,
            text: chunk.delta,
            providerMetadata: chunk.providerMetadata,
          });
          break;

        case 'text-end':
          upsertTextContentPart({
            content: modelCallContent,
            partIndexes: textPartIndexes,
            id: chunk.id,
            type: 'text',
            providerMetadata: chunk.providerMetadata,
          });
          textPartIndexes.delete(chunk.id);
          controller.enqueue(chunk);
          break;

        case 'reasoning-start':
          upsertTextContentPart({
            content: modelCallContent,
            partIndexes: reasoningPartIndexes,
            id: chunk.id,
            type: 'reasoning',
            providerMetadata: chunk.providerMetadata,
          });
          controller.enqueue(chunk);
          break;

        case 'reasoning-delta':
          upsertTextContentPart({
            content: modelCallContent,
            partIndexes: reasoningPartIndexes,
            id: chunk.id,
            type: 'reasoning',
            textDelta: chunk.delta,
            providerMetadata: chunk.providerMetadata,
          });
          controller.enqueue({
            type: 'reasoning-delta',
            id: chunk.id,
            text: chunk.delta,
            providerMetadata: chunk.providerMetadata,
          });
          break;

        case 'reasoning-end':
          upsertTextContentPart({
            content: modelCallContent,
            partIndexes: reasoningPartIndexes,
            id: chunk.id,
            type: 'reasoning',
            providerMetadata: chunk.providerMetadata,
          });
          reasoningPartIndexes.delete(chunk.id);
          controller.enqueue(chunk);
          break;

        case 'file':
        case 'reasoning-file': {
          const file = new DefaultGeneratedFileWithType({
            data:
              chunk.data.type === 'data'
                ? chunk.data.data
                : chunk.data.url.toString(),
            mediaType: chunk.mediaType,
          });

          modelCallContent.push({
            type: chunk.type,
            file,
            ...(chunk.providerMetadata != null
              ? { providerMetadata: chunk.providerMetadata }
              : {}),
          });

          controller.enqueue({
            type: chunk.type,
            file,
            providerMetadata: chunk.providerMetadata,
          });
          break;
        }

        case 'finish': {
          const usage = asLanguageModelUsage(chunk.usage);
          const responseTimeMs = now() - callStartTimestampMs;
          const performance = {
            responseTimeMs,
            effectiveOutputTokensPerSecond: calculateTokensPerSecond({
              tokens: usage.outputTokens,
              durationMs: responseTimeMs,
            }),
            outputTokensPerSecond:
              timeToFirstOutputMs == null
                ? undefined
                : calculateTokensPerSecond({
                    tokens: usage.outputTokens,
                    durationMs: responseTimeMs - timeToFirstOutputMs,
                  }),
            inputTokensPerSecond:
              timeToFirstOutputMs == null
                ? undefined
                : calculateTokensPerSecond({
                    tokens: usage.inputTokens,
                    durationMs: timeToFirstOutputMs,
                  }),
            effectiveTotalTokensPerSecond: calculateTokensPerSecond({
              tokens: sumTokenCounts(usage.inputTokens, usage.outputTokens),
              durationMs: responseTimeMs,
            }),
            timeToFirstOutputMs,
            timeBetweenOutputChunksMs:
              timeBetweenOutputChunksMs.length > 0
                ? calculateOutputChunkTimingStats(timeBetweenOutputChunksMs)
                : undefined,
          };

          await notify({
            event: {
              callId,
              provider,
              modelId,
              finishReason: chunk.finishReason.unified,
              usage,
              content: modelCallContent,
              responseId,
              performance,
            },
            callbacks: onLanguageModelCallEnd,
          });

          controller.enqueue({
            type: 'model-call-end',
            finishReason: chunk.finishReason.unified,
            rawFinishReason: chunk.finishReason.raw,
            usage,
            providerMetadata: chunk.providerMetadata,
            performance,
          });
          break;
        }

        case 'tool-call': {
          try {
            const toolCall = await parseToolCall({
              toolCall: chunk,
              tools,
              repairToolCall,
              refineToolInput,
              instructions,
              messages,
            });

            toolCallsByToolCallId.set(toolCall.toolCallId, toolCall);
            controller.enqueue(toolCall);
            modelCallContent.push(toolCall);

            if (toolCall.invalid) {
              controller.enqueue({
                type: 'tool-error',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                error: getErrorMessage(toolCall.error!),
                dynamic: true,
                title: toolCall.title,
                ...(toolCall.toolMetadata != null
                  ? { toolMetadata: toolCall.toolMetadata }
                  : {}),
              });
              break;
            }
          } catch (error) {
            controller.enqueue({ type: 'error', error });
          }

          break;
        }

        case 'tool-approval-request': {
          const toolCall = toolCallsByToolCallId.get(chunk.toolCallId);

          if (toolCall == null) {
            controller.enqueue({
              type: 'error',
              error: new ToolCallNotFoundForApprovalError({
                toolCallId: chunk.toolCallId,
                approvalId: chunk.approvalId,
              }),
            });
            break;
          }

          const toolApprovalRequest = {
            type: 'tool-approval-request',
            approvalId: chunk.approvalId,
            toolCall,
          } as const;

          controller.enqueue(toolApprovalRequest);
          modelCallContent.push(toolApprovalRequest);
          break;
        }

        case 'tool-result': {
          const toolName = chunk.toolName as keyof TOOLS & string;
          const toolCall = toolCallsByToolCallId.get(chunk.toolCallId);

          const toolResultPart = chunk.isError
            ? ({
                type: 'tool-error',
                toolCallId: chunk.toolCallId,
                toolName,
                input: toolCall?.input,
                providerExecuted: true,
                error: chunk.result,
                dynamic: chunk.dynamic,
                ...(chunk.providerMetadata != null
                  ? { providerMetadata: chunk.providerMetadata }
                  : {}),
                ...(toolCall?.toolMetadata != null
                  ? { toolMetadata: toolCall.toolMetadata }
                  : {}),
              } as TypedToolError<TOOLS>)
            : ({
                type: 'tool-result',
                toolCallId: chunk.toolCallId,
                toolName,
                input: toolCall?.input,
                output: chunk.result,
                providerExecuted: true,
                dynamic: chunk.dynamic,
                ...(chunk.providerMetadata != null
                  ? { providerMetadata: chunk.providerMetadata }
                  : {}),
                ...(toolCall?.toolMetadata != null
                  ? { toolMetadata: toolCall.toolMetadata }
                  : {}),
              } as TypedToolResult<TOOLS>);

          controller.enqueue(toolResultPart);
          modelCallContent.push(toolResultPart);

          break;
        }

        case 'tool-input-start': {
          const tool = tools?.[chunk.toolName];

          controller.enqueue({
            ...chunk,
            dynamic: chunk.dynamic ?? tool?.type === 'dynamic',
            title: tool?.title,
            ...(tool?.metadata != null ? { toolMetadata: tool.metadata } : {}),
          });
          break;
        }

        case 'stream-start': {
          controller.enqueue({
            type: 'model-call-start',
            warnings: chunk.warnings,
          });
          break;
        }

        case 'response-metadata': {
          responseId = chunk.id ?? responseId;

          controller.enqueue({
            type: 'model-call-response-metadata',
            id: chunk.id,
            timestamp: chunk.timestamp,
            modelId: chunk.modelId,
          });
          break;
        }

        default:
          if (chunk.type === 'custom' || chunk.type === 'source') {
            modelCallContent.push(chunk);
          }

          controller.enqueue(chunk);
          break;
      }
    },
  });
}

/**
 * Returns true for chunks that contain generated model output.
 * Used to measure time-to-first-output for text, reasoning, generated files,
 * and tool calls.
 */
function isOutputChunk(chunk: LanguageModelV4StreamPart): boolean {
  return (
    (chunk.type === 'text-delta' && chunk.delta.length > 0) ||
    (chunk.type === 'reasoning-delta' && chunk.delta.length > 0) ||
    (chunk.type === 'tool-input-delta' && chunk.delta.length > 0) ||
    chunk.type === 'file' ||
    chunk.type === 'reasoning-file' ||
    chunk.type === 'tool-call'
  );
}

function calculateOutputChunkTimingStats(
  timingsMs: number[],
): OutputChunkTimingStats {
  const sortedTimingsMs = [...timingsMs].sort((a, b) => a - b);
  const sum = timingsMs.reduce((sum, timingMs) => sum + timingMs, 0);

  return {
    min: sortedTimingsMs[0],
    p10: calculateNearestRankPercentile(sortedTimingsMs, 0.1),
    median: calculateNearestRankPercentile(sortedTimingsMs, 0.5),
    avg: sum / timingsMs.length,
    p90: calculateNearestRankPercentile(sortedTimingsMs, 0.9),
    max: sortedTimingsMs[sortedTimingsMs.length - 1],
  };
}

function calculateNearestRankPercentile(
  sortedValues: number[],
  percentile: number,
): number {
  return sortedValues[Math.ceil(percentile * sortedValues.length) - 1];
}

/**
 * Appends a text or reasoning content part into the content array and updates the part indexes.
 */
function upsertTextContentPart<TOOLS extends ToolSet>({
  content,
  partIndexes,
  id,
  type,
  textDelta,
  providerMetadata,
}: {
  content: Array<ContentPart<TOOLS>>;
  partIndexes: Map<string, number>;
  id: string;
  type: 'text' | 'reasoning';
  textDelta?: string;
  providerMetadata?: ProviderMetadata;
}) {
  let partIndex = partIndexes.get(id);

  if (partIndex == null) {
    partIndex =
      content.push({
        type,
        text: '',
        ...(providerMetadata != null ? { providerMetadata } : {}),
      }) - 1;
    partIndexes.set(id, partIndex);
  }

  const part = content[partIndex] as {
    text: string;
    providerMetadata?: ProviderMetadata;
  };

  if (textDelta != null) {
    part.text += textDelta;
  }

  if (providerMetadata != null) {
    part.providerMetadata = providerMetadata;
  }
}
