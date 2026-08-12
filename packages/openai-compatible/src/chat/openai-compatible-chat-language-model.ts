import type {
  APICallError,
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  generateId,
  isCustomReasoning,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  StreamingToolCallTracker,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type StreamingToolCallDelta,
  type FetchFunction,
  type ParseResult,
  type ResponseHandler,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  resolveProviderOptionsKey,
  toCamelCase,
  warnIfDeprecatedProviderOptionsKey,
} from '../utils/to-camel-case';
import {
  defaultOpenAICompatibleErrorStructure,
  type ProviderErrorStructure,
} from '../openai-compatible-error';
import { convertOpenAICompatibleChatUsage } from './convert-openai-compatible-chat-usage';
import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages';
import { getResponseMetadata } from './get-response-metadata';
import { mapOpenAICompatibleFinishReason } from './map-openai-compatible-finish-reason';
import {
  openaiCompatibleLanguageModelChatOptions,
  type OpenAICompatibleChatModelId,
} from './openai-compatible-chat-language-model-options';
import type { MetadataExtractor } from './openai-compatible-metadata-extractor';
import { prepareTools } from './openai-compatible-prepare-tools';

type OpenAICompatibleStreamingToolCallDelta = StreamingToolCallDelta & {
  extra_content?: {
    google?: {
      thought_signature?: string | null;
    } | null;
  } | null;
};

export type OpenAICompatibleChatConfig = {
  provider: string;
  headers?: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: FetchFunction;
  includeUsage?: boolean;
  errorStructure?: ProviderErrorStructure<any>;
  metadataExtractor?: MetadataExtractor;

  /**
   * Whether the model supports structured outputs.
   */
  supportsStructuredOutputs?: boolean;

  /**
   * The supported URLs for the model.
   */
  supportedUrls?: () => LanguageModelV4['supportedUrls'];

  /**
   * Optional function to transform the request body before sending it to the API.
   * This is useful for proxy providers that may require a different request format
   * than the official OpenAI API.
   */
  transformRequestBody?: (args: Record<string, any>) => Record<string, any>;

  /**
   * Optional usage converter for OpenAI-compatible providers with different
   * token accounting semantics.
   */
  convertUsage?: (
    usage: z.infer<typeof openaiCompatibleTokenUsageSchema>,
  ) => LanguageModelV4Usage;
};

type PendingToolCall = {
  id: string | null;
  bufferedArguments: string;
  extraContent: OpenAICompatibleStreamingToolCallDelta['extra_content'];
};

export class OpenAICompatibleChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly supportsStructuredOutputs: boolean;

  readonly modelId: OpenAICompatibleChatModelId;
  protected readonly config: OpenAICompatibleChatConfig;
  private readonly failedResponseHandler: ResponseHandler<APICallError>;
  private readonly chunkSchema; // type inferred via constructor

  static [WORKFLOW_SERIALIZE](model: OpenAICompatibleChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: OpenAICompatibleChatConfig;
  }) {
    return new OpenAICompatibleChatLanguageModel(
      options.modelId,
      options.config,
    );
  }

  constructor(
    modelId: OpenAICompatibleChatModelId,
    config: OpenAICompatibleChatConfig,
  ) {
    this.modelId = modelId;
    this.config = config;

    // initialize error handling:
    const errorStructure =
      config.errorStructure ?? defaultOpenAICompatibleErrorStructure;
    this.chunkSchema = createOpenAICompatibleChatChunkSchema(
      errorStructure.errorSchema,
    );
    this.failedResponseHandler = createJsonErrorResponseHandler(errorStructure);

    this.supportsStructuredOutputs = config.supportsStructuredOutputs ?? false;
  }

  get provider(): string {
    return this.config.provider;
  }

  private get providerOptionsName(): string {
    return this.config.provider.split('.')[0].trim();
  }

  get supportedUrls() {
    return this.config.supportedUrls?.() ?? {};
  }

  private transformRequestBody(args: Record<string, any>): Record<string, any> {
    return this.config.transformRequestBody?.(args) ?? args;
  }

  private convertUsage(
    usage: z.infer<typeof openaiCompatibleTokenUsageSchema>,
  ): LanguageModelV4Usage {
    return (
      this.config.convertUsage?.(usage) ??
      convertOpenAICompatibleChatUsage(usage)
    );
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
    const warnings: SharedV4Warning[] = [];

    // Parse provider options - check for deprecated 'openai-compatible' key
    const deprecatedOptions = await parseProviderOptions({
      provider: 'openai-compatible',
      providerOptions,
      schema: openaiCompatibleLanguageModelChatOptions,
    });

    if (deprecatedOptions != null) {
      warnings.push({
        type: 'deprecated',
        setting: "providerOptions key 'openai-compatible'",
        message: "Use 'openaiCompatible' instead.",
      });
    }

    // Warn when the raw (non-camelCase) provider name is used
    warnIfDeprecatedProviderOptionsKey({
      rawName: this.providerOptionsName,
      providerOptions,
      warnings,
    });

    const compatibleOptions = Object.assign(
      deprecatedOptions ?? {},
      (await parseProviderOptions({
        provider: 'openaiCompatible',
        providerOptions,
        schema: openaiCompatibleLanguageModelChatOptions,
      })) ?? {},
      (await parseProviderOptions({
        provider: this.providerOptionsName,
        providerOptions,
        schema: openaiCompatibleLanguageModelChatOptions,
      })) ?? {},
      (await parseProviderOptions({
        provider: toCamelCase(this.providerOptionsName),
        providerOptions,
        schema: openaiCompatibleLanguageModelChatOptions,
      })) ?? {},
    );

    const strictJsonSchema = compatibleOptions?.strictJsonSchema ?? true;

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    if (
      responseFormat?.type === 'json' &&
      responseFormat.schema != null &&
      !this.supportsStructuredOutputs
    ) {
      warnings.push({
        type: 'unsupported',
        feature: 'responseFormat',
        details:
          'JSON response format schema is only supported with structuredOutputs',
      });
    }

    const {
      tools: openaiTools,
      toolChoice: openaiToolChoice,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
    });

    const metadataKey = resolveProviderOptionsKey(
      this.providerOptionsName,
      providerOptions,
    );

    return {
      metadataKey,
      args: {
        // model id:
        model: this.modelId,

        // model specific settings:
        user: compatibleOptions.user,

        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        response_format:
          responseFormat?.type === 'json'
            ? this.supportsStructuredOutputs === true &&
              responseFormat.schema != null
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
        ...Object.fromEntries(
          Object.entries({
            ...providerOptions?.[this.providerOptionsName],
            ...providerOptions?.[toCamelCase(this.providerOptionsName)],
          }).filter(
            ([key]) =>
              !Object.keys(
                openaiCompatibleLanguageModelChatOptions.shape,
              ).includes(key),
          ),
        ),

        reasoning_effort:
          compatibleOptions.reasoningEffort ??
          (isCustomReasoning(reasoning) && reasoning !== 'none'
            ? reasoning
            : undefined),
        verbosity: compatibleOptions.textVerbosity,

        // messages:
        messages: convertToOpenAICompatibleChatMessages(prompt),

        // tools:
        tools: openaiTools,
        tool_choice: openaiToolChoice,
      },
      warnings: [...warnings, ...toolWarnings],
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { args, warnings, metadataKey } = await this.getArgs({ ...options });

    const transformedBody = this.transformRequestBody(args);
    const body = JSON.stringify(transformedBody);

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
      body: transformedBody,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenAICompatibleChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const choice = responseBody.choices[0];
    const content: Array<LanguageModelV4Content> = [];

    // text content:
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: 'text', text });
    }

    // reasoning content:
    const reasoning =
      choice.message.reasoning_content ?? choice.message.reasoning;
    if (reasoning != null && reasoning.length > 0) {
      content.push({
        type: 'reasoning',
        text: reasoning,
      });
    }

    // tool calls:
    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        const thoughtSignature =
          toolCall.extra_content?.google?.thought_signature;
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id ?? generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments!,
          ...(thoughtSignature
            ? {
                providerMetadata: {
                  [metadataKey]: { thoughtSignature },
                },
              }
            : {}),
        });
      }
    }

    // provider metadata:
    const providerMetadata: SharedV4ProviderMetadata = {
      [metadataKey]: {},
      ...(await this.config.metadataExtractor?.extractMetadata?.({
        parsedBody: rawResponse,
      })),
    };
    const completionTokenDetails =
      responseBody.usage?.completion_tokens_details;
    if (completionTokenDetails?.accepted_prediction_tokens != null) {
      providerMetadata[metadataKey].acceptedPredictionTokens =
        completionTokenDetails?.accepted_prediction_tokens;
    }
    if (completionTokenDetails?.rejected_prediction_tokens != null) {
      providerMetadata[metadataKey].rejectedPredictionTokens =
        completionTokenDetails?.rejected_prediction_tokens;
    }

    return {
      content,
      finishReason: {
        unified: mapOpenAICompatibleFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined,
      },
      usage: this.convertUsage(responseBody.usage),
      providerMetadata,
      request: { body },
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
    const { args, warnings, metadataKey } = await this.getArgs({
      ...options,
    });

    const body = this.transformRequestBody({
      ...args,
      stream: true,

      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage
        ? { include_usage: true }
        : undefined,
    });

    const metadataExtractor =
      this.config.metadataExtractor?.createStreamExtractor();

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        this.chunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const providerOptionsName = metadataKey;
    let toolCallTracker: StreamingToolCallTracker<OpenAICompatibleStreamingToolCallDelta>;

    // Buffers tool-call deltas by `index` until `function.name` is known.
    // Some OpenAI-compatible providers send the first delta without
    // `function.name`, which the shared tracker rejects on first chunk.
    const pendingToolCalls = new Map<number, PendingToolCall>();
    const forwardedToolCallIndices = new Set<number>();

    const processToolCallDelta = (
      toolCallDelta: OpenAICompatibleStreamingToolCallDelta,
    ) => {
      const index = toolCallDelta.index;

      if (index == null || forwardedToolCallIndices.has(index)) {
        toolCallTracker.processDelta(toolCallDelta);
        return;
      }

      let pending = pendingToolCalls.get(index);
      if (pending == null) {
        pending = {
          id: toolCallDelta.id ?? null,
          bufferedArguments: '',
          extraContent: toolCallDelta.extra_content ?? null,
        };
        pendingToolCalls.set(index, pending);
      } else {
        if (pending.id == null && toolCallDelta.id != null) {
          pending.id = toolCallDelta.id;
        }
        if (
          pending.extraContent == null &&
          toolCallDelta.extra_content != null
        ) {
          pending.extraContent = toolCallDelta.extra_content;
        }
      }

      const argumentsDelta = toolCallDelta.function?.arguments;
      if (argumentsDelta != null) {
        pending.bufferedArguments += argumentsDelta;
      }

      const name = toolCallDelta.function?.name;
      if (name != null) {
        const forwardDelta: OpenAICompatibleStreamingToolCallDelta = {
          index,
          id: pending.id,
          function: {
            name,
            arguments: pending.bufferedArguments,
          },
          extra_content: pending.extraContent ?? undefined,
        };
        toolCallTracker.processDelta(forwardDelta);
        pendingToolCalls.delete(index);
        forwardedToolCallIndices.add(index);
      }
    };

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: z.infer<typeof openaiCompatibleTokenUsageSchema> | undefined =
      undefined;
    let isFirstChunk = true;
    let isActiveReasoning = false;
    let isActiveText = false;
    const convertUsage = (
      usage: z.infer<typeof openaiCompatibleTokenUsageSchema>,
    ) => this.convertUsage(usage);

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof this.chunkSchema>>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            toolCallTracker =
              new StreamingToolCallTracker<OpenAICompatibleStreamingToolCallDelta>(
                controller,
                {
                  generateId,
                  extractMetadata: delta => {
                    const thoughtSignature =
                      delta.extra_content?.google?.thought_signature;

                    return thoughtSignature
                      ? { [providerOptionsName]: { thoughtSignature } }
                      : undefined;
                  },
                  buildToolCallProviderMetadata: metadata => metadata,
                },
              );
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

            metadataExtractor?.processChunk(chunk.rawValue);

            // handle error chunks:
            if ('error' in chunk.value) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({
                type: 'error',
                error: chunk.value.error.message,
              });
              return;
            }

            // TODO we lost type safety on Chunk, most likely due to the error schema. MUST FIX
            // remove this workaround when the issue is fixed
            const value = chunk.value as z.infer<typeof chunkBaseSchema>;

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
                unified: mapOpenAICompatibleFinishReason(choice.finish_reason),
                raw: choice.finish_reason ?? undefined,
              };
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            // enqueue reasoning before text deltas:
            const reasoningContent = delta.reasoning_content ?? delta.reasoning;
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
              // end active reasoning block before text starts
              if (isActiveReasoning) {
                controller.enqueue({
                  type: 'reasoning-end',
                  id: 'reasoning-0',
                });
                isActiveReasoning = false;
              }

              if (!isActiveText) {
                controller.enqueue({ type: 'text-start', id: 'txt-0' });
                isActiveText = true;
              }

              controller.enqueue({
                type: 'text-delta',
                id: 'txt-0',
                delta: delta.content,
              });
            }

            if (delta.tool_calls != null) {
              // end active reasoning block before tool calls start
              if (isActiveReasoning) {
                controller.enqueue({
                  type: 'reasoning-end',
                  id: 'reasoning-0',
                });
                isActiveReasoning = false;
              }

              for (const toolCallDelta of delta.tool_calls) {
                processToolCallDelta(toolCallDelta);
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

            // Forward any tool-call deltas that never received a
            // `function.name`. The tracker will throw on the missing name,
            // preserving the original invalid-response semantics.
            for (const [index, pending] of pendingToolCalls) {
              toolCallTracker.processDelta({
                index,
                id: pending.id,
                function: { arguments: pending.bufferedArguments },
              });
            }
            pendingToolCalls.clear();

            toolCallTracker.flush();

            const providerMetadata: SharedV4ProviderMetadata = {
              [providerOptionsName]: {},
              ...metadataExtractor?.buildMetadata(),
            };
            if (
              usage?.completion_tokens_details?.accepted_prediction_tokens !=
              null
            ) {
              providerMetadata[providerOptionsName].acceptedPredictionTokens =
                usage?.completion_tokens_details?.accepted_prediction_tokens;
            }
            if (
              usage?.completion_tokens_details?.rejected_prediction_tokens !=
              null
            ) {
              providerMetadata[providerOptionsName].rejectedPredictionTokens =
                usage?.completion_tokens_details?.rejected_prediction_tokens;
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertUsage(usage),
              providerMetadata,
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}

const openaiCompatibleTokenUsageSchema = z
  .looseObject({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    total_tokens: z.number().nullish(),
    prompt_tokens_details: z
      .object({
        cached_tokens: z.number().nullish(),
      })
      .nullish(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().nullish(),
        accepted_prediction_tokens: z.number().nullish(),
        rejected_prediction_tokens: z.number().nullish(),
      })
      .nullish(),
  })
  .nullish();

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const OpenAICompatibleChatResponseSchema = z.looseObject({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant').nullish(),
        content: z.string().nullish(),
        reasoning_content: z.string().nullish(),
        reasoning: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().nullish(),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
              // Support for Google Gemini thought signatures via OpenAI compatibility
              extra_content: z
                .object({
                  google: z
                    .object({
                      thought_signature: z.string().nullish(),
                    })
                    .nullish(),
                })
                .nullish(),
            }),
          )
          .nullish(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: openaiCompatibleTokenUsageSchema,
});

const chunkBaseSchema = z.looseObject({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z
        .object({
          role: z.enum(['assistant', '']).nullish(),
          content: z.string().nullish(),
          // Most openai-compatible models set `reasoning_content`, but some
          // providers serving `gpt-oss` set `reasoning`. See #7866
          reasoning_content: z.string().nullish(),
          reasoning: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                index: z.number().nullish(), //google does not send index
                id: z.string().nullish(),
                function: z.object({
                  name: z.string().nullish(),
                  arguments: z.string().nullish(),
                }),
                // Support for Google Gemini thought signatures via OpenAI compatibility
                extra_content: z
                  .object({
                    google: z
                      .object({
                        thought_signature: z.string().nullish(),
                      })
                      .nullish(),
                  })
                  .nullish(),
              }),
            )
            .nullish(),
        })
        .nullish(),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: openaiCompatibleTokenUsageSchema,
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const createOpenAICompatibleChatChunkSchema = <
  ERROR_SCHEMA extends z.core.$ZodType,
>(
  errorSchema: ERROR_SCHEMA,
) => z.union([chunkBaseSchema, errorSchema]);
