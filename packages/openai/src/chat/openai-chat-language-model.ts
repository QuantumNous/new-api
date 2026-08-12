import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  StreamingToolCallTracker,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isCustomReasoning,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  type FetchFunction,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { openaiFailedResponseHandler } from '../openai-error';
import { getOpenAILanguageModelCapabilities } from '../openai-language-model-capabilities';
import { throwIfOpenAIStreamErrorBeforeOutput } from '../openai-stream-error';
import {
  convertOpenAIChatUsage,
  type OpenAIChatUsage,
} from './convert-openai-chat-usage';
import { convertToOpenAIChatMessages } from './convert-to-openai-chat-messages';
import { getResponseMetadata } from './get-response-metadata';
import { mapOpenAIFinishReason } from './map-openai-finish-reason';
import {
  openaiChatChunkSchema,
  openaiChatResponseSchema,
  type OpenAIChatChunk,
} from './openai-chat-api';
import {
  openaiLanguageModelChatOptions,
  type OpenAIChatModelId,
} from './openai-chat-language-model-options';
import { prepareChatTools } from './openai-chat-prepare-tools';

type OpenAIChatConfig = {
  provider: string;
  headers?: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: FetchFunction;
};

export class OpenAIChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: OpenAIChatModelId;

  readonly supportedUrls = {
    'image/*': [/^https?:\/\/.*$/],
  };

  private readonly config: OpenAIChatConfig;

  static [WORKFLOW_SERIALIZE](model: OpenAIChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: OpenAIChatModelId;
    config: OpenAIChatConfig;
  }) {
    return new OpenAIChatLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: OpenAIChatModelId, config: OpenAIChatConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    tools,
    toolChoice,
    reasoning,
    providerOptions,
  }: LanguageModelV4CallOptions) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const openaiOptions =
      (await parseProviderOptions({
        provider: 'openai',
        providerOptions,
        schema: openaiLanguageModelChatOptions,
      })) ?? {};

    const modelCapabilities = getOpenAILanguageModelCapabilities(this.modelId);

    // AI SDK reasoning values map directly to the OpenAI reasoning values.
    const resolvedReasoningEffort =
      openaiOptions.reasoningEffort ??
      (isCustomReasoning(reasoning) ? reasoning : undefined);

    const isReasoningModel =
      openaiOptions.forceReasoning ?? modelCapabilities.isReasoningModel;

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    const { messages, warnings: messageWarnings } = convertToOpenAIChatMessages(
      {
        prompt,
        systemMessageMode:
          openaiOptions.systemMessageMode ??
          (isReasoningModel
            ? 'developer'
            : modelCapabilities.systemMessageMode),
      },
    );

    warnings.push(...messageWarnings);

    const strictJsonSchema = openaiOptions.strictJsonSchema ?? true;

    const baseArgs = {
      // model id:
      model: this.modelId,

      // model specific settings:
      logit_bias: openaiOptions.logitBias,
      logprobs:
        openaiOptions.logprobs === true ||
        typeof openaiOptions.logprobs === 'number'
          ? true
          : undefined,
      top_logprobs:
        typeof openaiOptions.logprobs === 'number'
          ? openaiOptions.logprobs
          : typeof openaiOptions.logprobs === 'boolean'
            ? openaiOptions.logprobs
              ? 0
              : undefined
            : undefined,
      user: openaiOptions.user,
      parallel_tool_calls: openaiOptions.parallelToolCalls,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format:
        responseFormat?.type === 'json'
          ? responseFormat.schema != null
            ? {
                type: 'json_schema',
                json_schema: {
                  schema: responseFormat.schema,
                  strict: strictJsonSchema,
                  name: responseFormat.name ?? 'response',
                  description: responseFormat.description,
                },
              }
            : { type: 'json_object' }
          : undefined,
      stop: stopSequences,
      seed,
      verbosity: openaiOptions.textVerbosity,

      // openai specific settings:
      // TODO AI SDK 6: remove, we auto-map maxOutputTokens now
      max_completion_tokens: openaiOptions.maxCompletionTokens,
      store: openaiOptions.store,
      metadata: openaiOptions.metadata,
      prediction: openaiOptions.prediction,
      reasoning_effort: resolvedReasoningEffort,
      service_tier: openaiOptions.serviceTier,
      prompt_cache_key: openaiOptions.promptCacheKey,
      prompt_cache_retention: openaiOptions.promptCacheRetention,
      safety_identifier: openaiOptions.safetyIdentifier,

      // messages:
      messages,
    };

    // remove unsupported settings for reasoning models
    // see https://platform.openai.com/docs/guides/reasoning#limitations
    if (isReasoningModel) {
      // when reasoning effort is none, gpt-5.1 models allow temperature, topP, logprobs
      //  https://platform.openai.com/docs/guides/latest-model#gpt-5-1-parameter-compatibility
      if (
        resolvedReasoningEffort !== 'none' ||
        !modelCapabilities.supportsNonReasoningParameters
      ) {
        if (baseArgs.temperature != null) {
          baseArgs.temperature = undefined;
          warnings.push({
            type: 'unsupported',
            feature: 'temperature',
            details: 'temperature is not supported for reasoning models',
          });
        }
        if (baseArgs.top_p != null) {
          baseArgs.top_p = undefined;
          warnings.push({
            type: 'unsupported',
            feature: 'topP',
            details: 'topP is not supported for reasoning models',
          });
        }
        if (baseArgs.logprobs != null) {
          baseArgs.logprobs = undefined;
          warnings.push({
            type: 'other',
            message: 'logprobs is not supported for reasoning models',
          });
        }
      }

      if (baseArgs.frequency_penalty != null) {
        baseArgs.frequency_penalty = undefined;
        warnings.push({
          type: 'unsupported',
          feature: 'frequencyPenalty',
          details: 'frequencyPenalty is not supported for reasoning models',
        });
      }
      if (baseArgs.presence_penalty != null) {
        baseArgs.presence_penalty = undefined;
        warnings.push({
          type: 'unsupported',
          feature: 'presencePenalty',
          details: 'presencePenalty is not supported for reasoning models',
        });
      }
      if (baseArgs.logit_bias != null) {
        baseArgs.logit_bias = undefined;
        warnings.push({
          type: 'other',
          message: 'logitBias is not supported for reasoning models',
        });
      }

      if (baseArgs.top_logprobs != null) {
        baseArgs.top_logprobs = undefined;
        warnings.push({
          type: 'other',
          message: 'topLogprobs is not supported for reasoning models',
        });
      }

      // reasoning models use max_completion_tokens instead of max_tokens:
      if (baseArgs.max_tokens != null) {
        if (baseArgs.max_completion_tokens == null) {
          baseArgs.max_completion_tokens = baseArgs.max_tokens;
        }
        baseArgs.max_tokens = undefined;
      }
    } else if (
      this.modelId.startsWith('gpt-4o-search-preview') ||
      this.modelId.startsWith('gpt-4o-mini-search-preview')
    ) {
      if (baseArgs.temperature != null) {
        baseArgs.temperature = undefined;
        warnings.push({
          type: 'unsupported',
          feature: 'temperature',
          details:
            'temperature is not supported for the search preview models and has been removed.',
        });
      }
    }

    // Validate flex processing support
    if (
      openaiOptions.serviceTier === 'flex' &&
      !modelCapabilities.supportsFlexProcessing
    ) {
      warnings.push({
        type: 'unsupported',
        feature: 'serviceTier',
        details:
          'flex processing is only available for o3, o4-mini, and gpt-5 models',
      });
      baseArgs.service_tier = undefined;
    }

    // Validate priority processing support
    if (
      openaiOptions.serviceTier === 'priority' &&
      !modelCapabilities.supportsPriorityProcessing
    ) {
      warnings.push({
        type: 'unsupported',
        feature: 'serviceTier',
        details:
          'priority processing is only available for supported models (gpt-4, gpt-5, gpt-5-mini, o3, o4-mini) and requires Enterprise access. gpt-5-nano is not supported',
      });
      baseArgs.service_tier = undefined;
    }

    const {
      tools: openaiTools,
      toolChoice: openaiToolChoice,
      toolWarnings,
    } = prepareChatTools({
      tools,
      toolChoice,
    });

    return {
      args: {
        ...baseArgs,
        tools: openaiTools,
        tool_choice: openaiToolChoice,
      },
      warnings: [...warnings, ...toolWarnings],
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { args: body, warnings } = await this.getArgs(options);

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const choice = response.choices[0];
    const content: Array<LanguageModelV4Content> = [];

    // text content:
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: 'text', text });
    }

    // tool calls:
    for (const toolCall of choice.message.tool_calls ?? []) {
      content.push({
        type: 'tool-call' as const,
        toolCallId: toolCall.id ?? generateId(),
        toolName: toolCall.function.name,
        input: toolCall.function.arguments!,
      });
    }

    // annotations/citations:
    for (const annotation of choice.message.annotations ?? []) {
      content.push({
        type: 'source',
        sourceType: 'url',
        id: generateId(),
        url: annotation.url_citation.url,
        title: annotation.url_citation.title,
      });
    }

    // provider metadata:
    const completionTokenDetails = response.usage?.completion_tokens_details;
    const providerMetadata: SharedV4ProviderMetadata = { openai: {} };
    if (completionTokenDetails?.accepted_prediction_tokens != null) {
      providerMetadata.openai.acceptedPredictionTokens =
        completionTokenDetails?.accepted_prediction_tokens;
    }
    if (completionTokenDetails?.rejected_prediction_tokens != null) {
      providerMetadata.openai.rejectedPredictionTokens =
        completionTokenDetails?.rejected_prediction_tokens;
    }
    if (choice.logprobs?.content != null) {
      providerMetadata.openai.logprobs = choice.logprobs.content;
    }

    return {
      content,
      finishReason: {
        unified: mapOpenAIFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined,
      },
      usage: convertOpenAIChatUsage(response.usage),
      request: { body },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
      providerMetadata,
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const { args, warnings } = await this.getArgs(options);

    const body = {
      ...args,
      stream: true,
      stream_options: {
        include_usage: true,
      },
    };

    const url = this.config.url({
      path: '/chat/completions',
      modelId: this.modelId,
    });

    const { responseHeaders, value: response } = await postJsonToApi({
      url,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        openaiChatChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const checkedResponse = await throwIfOpenAIStreamErrorBeforeOutput({
      stream: response,
      getError: chunk => ('error' in chunk ? chunk.error : undefined),
      isOutputChunk: isOpenAIChatOutputChunk,
      url,
      requestBodyValues: body,
      responseHeaders,
    });

    let toolCallTracker: StreamingToolCallTracker;

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: OpenAIChatUsage | undefined = undefined;
    let metadataExtracted = false;
    let isActiveText = false;

    const providerMetadata: SharedV4ProviderMetadata = { openai: {} };

    const result = {
      stream: checkedResponse.pipeThrough(
        new TransformStream<
          ParseResult<OpenAIChatChunk>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            toolCallTracker = new StreamingToolCallTracker(controller, {
              generateId,
              typeValidation: 'if-present',
            });
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // handle error chunks:
            if ('error' in value) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: value.error });
              return;
            }

            // extract and emit response metadata once. Usually it comes in the first chunk.
            // Azure may prepend a chunk with a `"prompt_filter_results"` key which does not contain other metadata,
            // https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/content-filter-annotations?tabs=powershell
            if (!metadataExtracted) {
              const metadata = getResponseMetadata(value);
              if (Object.values(metadata).some(Boolean)) {
                metadataExtracted = true;
                controller.enqueue({
                  type: 'response-metadata',
                  ...getResponseMetadata(value),
                });
              }
            }

            if (value.usage != null) {
              usage = value.usage;

              if (
                value.usage.completion_tokens_details
                  ?.accepted_prediction_tokens != null
              ) {
                providerMetadata.openai.acceptedPredictionTokens =
                  value.usage.completion_tokens_details?.accepted_prediction_tokens;
              }
              if (
                value.usage.completion_tokens_details
                  ?.rejected_prediction_tokens != null
              ) {
                providerMetadata.openai.rejectedPredictionTokens =
                  value.usage.completion_tokens_details?.rejected_prediction_tokens;
              }
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = {
                unified: mapOpenAIFinishReason(choice.finish_reason),
                raw: choice.finish_reason,
              };
            }

            if (choice?.logprobs?.content != null) {
              providerMetadata.openai.logprobs = choice.logprobs.content;
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            if (delta.content != null) {
              if (!isActiveText) {
                controller.enqueue({ type: 'text-start', id: '0' });
                isActiveText = true;
              }

              controller.enqueue({
                type: 'text-delta',
                id: '0',
                delta: delta.content,
              });
            }

            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                toolCallTracker.processDelta(toolCallDelta);
              }
            }

            // annotations/citations:
            if (delta.annotations != null) {
              for (const annotation of delta.annotations) {
                controller.enqueue({
                  type: 'source',
                  sourceType: 'url',
                  id: generateId(),
                  url: annotation.url_citation.url,
                  title: annotation.url_citation.title,
                });
              }
            }
          },

          flush(controller) {
            if (isActiveText) {
              controller.enqueue({ type: 'text-end', id: '0' });
            }

            toolCallTracker.flush();

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertOpenAIChatUsage(usage),
              ...(providerMetadata != null ? { providerMetadata } : {}),
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };

    return result;
  }
}

function isOpenAIChatOutputChunk(chunk: OpenAIChatChunk): boolean {
  if ('error' in chunk) {
    return false;
  }

  return chunk.choices.some(choice => {
    const delta = choice.delta;

    return (
      (delta?.content != null && delta.content.length > 0) ||
      (delta?.tool_calls != null && delta.tool_calls.length > 0) ||
      (delta?.annotations != null && delta.annotations.length > 0)
    );
  });
}
