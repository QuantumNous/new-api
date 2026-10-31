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
  mapReasoningToProviderEffort,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { convertGroqUsage } from './convert-groq-usage';
import { convertToGroqChatMessages } from './convert-to-groq-chat-messages';
import { getResponseMetadata } from './get-response-metadata';
import {
  groqLanguageModelChatOptions,
  type GroqChatModelId,
} from './groq-chat-language-model-options';
import { groqErrorDataSchema, groqFailedResponseHandler } from './groq-error';
import { prepareTools } from './groq-prepare-tools';
import { mapGroqFinishReason } from './map-groq-finish-reason';

type GroqChatConfig = {
  provider: string;
  headers?: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: FetchFunction;
};

export class GroqChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: GroqChatModelId;

  readonly supportedUrls = {
    'image/*': [/^https?:\/\/.*$/],
  };

  private readonly config: GroqChatConfig;

  static [WORKFLOW_SERIALIZE](model: GroqChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: GroqChatModelId;
    config: GroqChatConfig;
  }) {
    return new GroqChatLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: GroqChatModelId, config: GroqChatConfig) {
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
    reasoning,
    tools,
    toolChoice,
    providerOptions,
  }: LanguageModelV4CallOptions) {
    const warnings: SharedV4Warning[] = [];

    const groqOptions = await parseProviderOptions({
      provider: 'groq',
      providerOptions,
      schema: groqLanguageModelChatOptions,
    });

    const structuredOutputs = groqOptions?.structuredOutputs ?? true;
    const strictJsonSchema = groqOptions?.strictJsonSchema ?? true;

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    if (
      responseFormat?.type === 'json' &&
      responseFormat.schema != null &&
      !structuredOutputs
    ) {
      warnings.push({
        type: 'unsupported',
        feature: 'responseFormat',
        details:
          'JSON response format schema is only supported with structuredOutputs',
      });
    }

    const {
      tools: groqTools,
      toolChoice: groqToolChoice,
      toolWarnings,
    } = prepareTools({ tools, toolChoice, modelId: this.modelId });

    return {
      args: {
        // model id:
        model: this.modelId,

        // model specific settings:
        user: groqOptions?.user,
        parallel_tool_calls: groqOptions?.parallelToolCalls,

        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stop: stopSequences,
        seed,

        // response format:
        response_format:
          responseFormat?.type === 'json'
            ? structuredOutputs && responseFormat.schema != null
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

        // provider options:
        reasoning_format: groqOptions?.reasoningFormat,
        reasoning_effort:
          groqOptions?.reasoningEffort ??
          (isCustomReasoning(reasoning) && reasoning !== 'none'
            ? mapReasoningToProviderEffort({
                reasoning,
                effortMap: {
                  minimal: 'low',
                  low: 'low',
                  medium: 'medium',
                  high: 'high',
                  xhigh: 'high',
                },
                warnings,
              })
            : undefined),
        service_tier: groqOptions?.serviceTier,

        // messages:
        messages: convertToGroqChatMessages(prompt),

        // tools:
        tools: groqTools,
        tool_choice: groqToolChoice,
      },
      warnings: [...warnings, ...toolWarnings],
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { args, warnings } = await this.getArgs(options);

    const body = JSON.stringify(args);

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
      body: args,
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        groqChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const choice = response.choices[0];
    const content: Array<LanguageModelV4Content> = [];

    // text content:
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: 'text', text: text });
    }

    // reasoning:
    const reasoning = choice.message.reasoning;
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

    return {
      content,
      finishReason: {
        unified: mapGroqFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined,
      },
      usage: convertGroqUsage(response.usage),
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
      request: { body },
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const { args, warnings } = await this.getArgs(options);

    const body = { ...args, stream: true };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler:
        createEventSourceResponseHandler(groqChatChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let toolCallTracker: StreamingToolCallTracker;

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage:
      | {
          prompt_tokens?: number | null | undefined;
          completion_tokens?: number | null | undefined;
          prompt_tokens_details?:
            | {
                cached_tokens?: number | null | undefined;
              }
            | null
            | undefined;
          completion_tokens_details?:
            | {
                reasoning_tokens?: number | null | undefined;
              }
            | null
            | undefined;
        }
      | undefined = undefined;
    let isFirstChunk = true;
    let isActiveText = false;
    let isActiveReasoning = false;

    let providerMetadata: SharedV4ProviderMetadata | undefined;
    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof groqChatChunkSchema>>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            toolCallTracker = new StreamingToolCallTracker(controller, {
              generateId,
              typeValidation: 'required',
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
              finishReason = {
                unified: 'error',
                raw: undefined,
              };
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // handle error chunks:
            if ('error' in value) {
              finishReason = {
                unified: 'error',
                raw: undefined,
              };
              controller.enqueue({ type: 'error', error: value.error });
              return;
            }

            if (isFirstChunk) {
              isFirstChunk = false;

              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value),
              });
            }

            if (value.x_groq?.usage != null) {
              usage = value.x_groq.usage;
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = {
                unified: mapGroqFinishReason(choice.finish_reason),
                raw: choice.finish_reason,
              };
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            if (delta.reasoning != null && delta.reasoning.length > 0) {
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
                delta: delta.reasoning,
              });
            }

            if (delta.content != null && delta.content.length > 0) {
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
              usage: convertGroqUsage(usage),
              ...(providerMetadata != null ? { providerMetadata } : {}),
            });
          },
        }),
      ),
      request: { body: JSON.stringify(body) },
      response: { headers: responseHeaders },
    };
  }
}

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const groqChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullish(),
        reasoning: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().nullish(),
              type: z.literal('function'),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .nullish(),
      }),
      index: z.number(),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: z
    .object({
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
        })
        .nullish(),
    })
    .nullish(),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const groqChatChunkSchema = z.union([
  z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z.array(
      z.object({
        delta: z
          .object({
            content: z.string().nullish(),
            reasoning: z.string().nullish(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number(),
                  id: z.string().nullish(),
                  type: z.literal('function').optional(),
                  function: z.object({
                    name: z.string().nullish(),
                    arguments: z.string().nullish(),
                  }),
                }),
              )
              .nullish(),
          })
          .nullish(),
        finish_reason: z.string().nullable().optional(),
        index: z.number(),
      }),
    ),
    x_groq: z
      .object({
        usage: z
          .object({
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
              })
              .nullish(),
          })
          .nullish(),
      })
      .nullish(),
  }),
  groqErrorDataSchema,
]);
