import type {
  APICallError,
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  generateId,
  isCustomReasoning,
  mapReasoningToProviderEffort,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  StreamingToolCallTracker,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
  type InferSchema,
  type ParseResult,
  type ResponseHandler,
} from '@ai-sdk/provider-utils';
import { convertToDeepSeekChatMessages } from './convert-to-deepseek-chat-messages';
import { convertDeepSeekUsage } from './convert-to-deepseek-usage';
import {
  deepseekChatChunkSchema,
  deepseekChatResponseSchema,
  deepSeekErrorSchema,
  type DeepSeekChatTokenUsage,
} from './deepseek-chat-api-types';
import {
  deepseekLanguageModelChatOptions,
  type DeepSeekChatModelId,
} from './deepseek-chat-language-model-options';
import { prepareTools } from './deepseek-prepare-tools';
import { getResponseMetadata } from './get-response-metadata';
import { mapDeepSeekFinishReason } from './map-deepseek-finish-reason';

export type DeepSeekChatConfig = {
  provider: string;
  headers?: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: FetchFunction;
  supportsThinking?: boolean;
};

export class DeepSeekChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: DeepSeekChatModelId;
  readonly supportedUrls = {};

  private readonly config: DeepSeekChatConfig;
  private readonly failedResponseHandler: ResponseHandler<APICallError>;

  static [WORKFLOW_SERIALIZE](model: DeepSeekChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: DeepSeekChatModelId;
    config: DeepSeekChatConfig;
  }) {
    return new DeepSeekChatLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: DeepSeekChatModelId, config: DeepSeekChatConfig) {
    this.modelId = modelId;
    this.config = config;

    this.failedResponseHandler = createJsonErrorResponseHandler({
      errorSchema: deepSeekErrorSchema,
      errorToMessage: (error: InferSchema<typeof deepSeekErrorSchema>) =>
        error.error.message,
    });
  }

  get provider(): string {
    return this.config.provider;
  }

  private get providerOptionsName(): string {
    return this.config.provider.split('.')[0].trim();
  }

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    reasoning,
    providerOptions,
    stopSequences,
    responseFormat,
    seed,
    toolChoice,
    tools,
  }: LanguageModelV4CallOptions) {
    const deepseekOptions =
      (await parseProviderOptions({
        provider: this.providerOptionsName,
        providerOptions,
        schema: deepseekLanguageModelChatOptions,
      })) ?? {};

    const { messages, warnings } = convertToDeepSeekChatMessages({
      prompt,
      responseFormat,
      modelId: this.modelId,
    });
    const allWarnings: SharedV4Warning[] = [...warnings];

    if (topK != null) {
      allWarnings.push({ type: 'unsupported', feature: 'topK' });
    }

    if (seed != null) {
      allWarnings.push({ type: 'unsupported', feature: 'seed' });
    }

    const {
      tools: deepseekTools,
      toolChoice: deepseekToolChoices,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
    });

    const thinking =
      this.config.supportsThinking === false
        ? undefined
        : deepseekOptions.thinking?.type != null
          ? { type: deepseekOptions.thinking.type }
          : isCustomReasoning(reasoning)
            ? { type: reasoning === 'none' ? 'disabled' : 'enabled' }
            : undefined;

    const reasoningEffort =
      deepseekOptions.reasoningEffort ??
      (isCustomReasoning(reasoning) && reasoning !== 'none'
        ? mapReasoningToProviderEffort({
            reasoning,
            effortMap: {
              minimal: 'low',
              low: 'low',
              medium: 'medium',
              high: 'high',
              xhigh: 'max',
            },
            warnings: allWarnings,
          })
        : undefined);

    return {
      args: {
        model: this.modelId,
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        response_format:
          responseFormat?.type === 'json' ? { type: 'json_object' } : undefined,
        stop: stopSequences,
        messages,
        tools: deepseekTools,
        tool_choice: deepseekToolChoices,
        thinking,
        ...(thinking?.type !== 'disabled' &&
          reasoningEffort != null && {
            reasoning_effort: reasoningEffort,
          }),
      },
      warnings: [...allWarnings, ...toolWarnings],
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { args, warnings } = await this.getArgs({ ...options });

    const {
      responseHeaders,
      value: responseBody,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        deepseekChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const choice = responseBody.choices[0];
    const content: Array<LanguageModelV4Content> = [];

    // reasoning content (before text):
    const reasoning = choice.message.reasoning_content;
    if (reasoning != null && reasoning.length > 0) {
      content.push({
        type: 'reasoning',
        text: reasoning,
      });
    }

    // tool calls:
    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id ?? generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments!,
        });
      }
    }

    // text content:
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: 'text', text });
    }

    return {
      content,
      finishReason: {
        unified: mapDeepSeekFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined,
      },
      usage: convertDeepSeekUsage(responseBody.usage),
      providerMetadata: {
        [this.providerOptionsName]: {
          promptCacheHitTokens: responseBody.usage?.prompt_cache_hit_tokens,
          promptCacheMissTokens: responseBody.usage?.prompt_cache_miss_tokens,
        },
      },
      request: { body: args },
      response: {
        ...getResponseMetadata(responseBody),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const { args, warnings } = await this.getArgs({ ...options });

    const body = {
      ...args,
      stream: true,
      stream_options: { include_usage: true },
    };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        deepseekChatChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let toolCallTracker: StreamingToolCallTracker;

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: DeepSeekChatTokenUsage | undefined = undefined;
    let isFirstChunk = true;
    const providerOptionsName = this.providerOptionsName;
    let isActiveReasoning = false;
    let isActiveText = false;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<InferSchema<typeof deepseekChatChunkSchema>>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            toolCallTracker = new StreamingToolCallTracker(controller, {
              generateId,
            });
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            // Emit raw chunk if requested (before anything else)
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
              controller.enqueue({ type: 'error', error: value.error.message });
              return;
            }

            if (isFirstChunk) {
              isFirstChunk = false;

              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value),
              });
            }

            if (value.usage != null) {
              usage = value.usage;
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = {
                unified: mapDeepSeekFinishReason(choice.finish_reason),
                raw: choice.finish_reason,
              };
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            // enqueue reasoning before text deltas:
            const reasoningContent = delta.reasoning_content;
            if (reasoningContent) {
              if (!isActiveReasoning) {
                controller.enqueue({
                  type: 'reasoning-start',
                  id: 'reasoning-0',
                });
                isActiveReasoning = true;
              }

              controller.enqueue({
                type: 'reasoning-delta',
                id: 'reasoning-0',
                delta: reasoningContent,
              });
            }

            if (delta.content) {
              if (!isActiveText) {
                controller.enqueue({ type: 'text-start', id: 'txt-0' });
                isActiveText = true;
              }

              // end reasoning when text starts:
              if (isActiveReasoning) {
                controller.enqueue({
                  type: 'reasoning-end',
                  id: 'reasoning-0',
                });
                isActiveReasoning = false;
              }

              controller.enqueue({
                type: 'text-delta',
                id: 'txt-0',
                delta: delta.content,
              });
            }

            if (delta.tool_calls != null) {
              // end reasoning when tool calls start:
              if (isActiveReasoning) {
                controller.enqueue({
                  type: 'reasoning-end',
                  id: 'reasoning-0',
                });
                isActiveReasoning = false;
              }

              for (const toolCallDelta of delta.tool_calls) {
                toolCallTracker.processDelta(toolCallDelta);
              }
            }
          },

          flush(controller) {
            if (isActiveReasoning) {
              controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
            }

            if (isActiveText) {
              controller.enqueue({ type: 'text-end', id: 'txt-0' });
            }

            toolCallTracker.flush();

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertDeepSeekUsage(usage),
              providerMetadata: {
                [providerOptionsName]: {
                  promptCacheHitTokens:
                    usage?.prompt_cache_hit_tokens ?? undefined,
                  promptCacheMissTokens:
                    usage?.prompt_cache_miss_tokens ?? undefined,
                },
              },
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}
