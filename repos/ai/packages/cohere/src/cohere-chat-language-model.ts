import type {
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
  createJsonResponseHandler,
  isCustomReasoning,
  mapReasoningToProviderBudget,
  parseProviderOptions,
  parseJSON,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type InferSchema,
  type FetchFunction,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  cohereLanguageModelChatOptions,
  type CohereChatModelId,
} from './cohere-chat-language-model-options';
import { cohereFailedResponseHandler } from './cohere-error';
import { prepareTools } from './cohere-prepare-tools';
import {
  convertCohereUsage,
  type CohereUsageTokens,
} from './convert-cohere-usage';
import { convertToCohereChatPrompt } from './convert-to-cohere-chat-prompt';
import { mapCohereFinishReason } from './map-cohere-finish-reason';

type CohereChatConfig = {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  generateId: () => string;
};

export class CohereChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: CohereChatModelId;

  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [/^https?:\/\/.*$/],
  };

  private readonly config: CohereChatConfig;

  static [WORKFLOW_SERIALIZE](model: CohereChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: CohereChatModelId;
    config: CohereChatConfig;
  }) {
    return new CohereChatLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: CohereChatModelId, config: CohereChatConfig) {
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

    const cohereOptions =
      (await parseProviderOptions({
        provider: 'cohere',
        providerOptions,
        schema: cohereLanguageModelChatOptions,
      })) ?? {};

    const {
      messages: chatPrompt,
      documents: cohereDocuments,
      warnings: promptWarnings,
    } = await convertToCohereChatPrompt(prompt);

    const {
      tools: cohereTools,
      toolChoice: cohereToolChoice,
      toolWarnings,
    } = prepareTools({ tools, toolChoice });

    warnings.push(...toolWarnings, ...promptWarnings);

    return {
      args: {
        // model id:
        model: this.modelId,

        // standardized settings:
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        max_tokens: maxOutputTokens,
        temperature,
        p: topP,
        k: topK,
        seed,
        stop_sequences: stopSequences,

        // response format:
        response_format:
          responseFormat?.type === 'json'
            ? { type: 'json_object', json_schema: responseFormat.schema }
            : undefined,

        // messages:
        messages: chatPrompt,

        // tools:
        tools: cohereTools,
        tool_choice: cohereToolChoice,

        // documents for RAG:
        ...(cohereDocuments.length > 0 && { documents: cohereDocuments }),

        // reasoning:
        ...resolveCohereThinking({
          reasoning,
          cohereOptions,
          warnings,
        }),
      },
      warnings,
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { args, warnings } = await this.getArgs(options);

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/chat`,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: args,
      failedResponseHandler: cohereFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        cohereChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const content: Array<LanguageModelV4Content> = [];

    for (const item of response.message.content ?? []) {
      if (item.type === 'text' && item.text.length > 0) {
        content.push({ type: 'text', text: item.text });
        continue;
      }

      if (item.type === 'thinking' && item.thinking.length > 0) {
        content.push({ type: 'reasoning', text: item.thinking });
        continue;
      }
    }

    // citations:
    for (const citation of response.message.citations ?? []) {
      content.push({
        type: 'source',
        sourceType: 'document',
        id: this.config.generateId(),
        mediaType: 'text/plain',
        title: citation.sources[0]?.document?.title || 'Document',
        providerMetadata: {
          cohere: {
            start: citation.start,
            end: citation.end,
            text: citation.text,
            sources: citation.sources,
            ...(citation.type && { citationType: citation.type }),
          },
        },
      });
    }

    // tool calls:
    for (const toolCall of response.message.tool_calls ?? []) {
      content.push({
        type: 'tool-call' as const,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        // Cohere sometimes returns `null` for tool call arguments for tools
        // defined as having no arguments.
        input: toolCall.function.arguments.replace(/^null$/, '{}'),
      });
    }

    return {
      content,
      finishReason: {
        unified: mapCohereFinishReason(response.finish_reason),
        raw: response.finish_reason ?? undefined,
      },
      usage: convertCohereUsage(response.usage.tokens),
      request: { body: args },
      response: {
        // TODO timestamp, model id
        id: response.generation_id ?? undefined,
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const { args, warnings } = await this.getArgs(options);

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat`,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: { ...args, stream: true },
      failedResponseHandler: cohereFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        cohereChatChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: CohereUsageTokens | undefined = undefined;

    let pendingToolCall: {
      id: string;
      name: string;
      arguments: string;
      hasFinished: boolean;
    } | null = null;

    let isActiveReasoning = false;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof cohereChatChunkSchema>>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          async transform(chunk, controller) {
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
            const type = value.type;

            switch (type) {
              case 'content-start': {
                if (value.delta.message.content.type === 'thinking') {
                  controller.enqueue({
                    type: 'reasoning-start',
                    id: String(value.index),
                  });
                  isActiveReasoning = true;
                  return;
                }

                controller.enqueue({
                  type: 'text-start',
                  id: String(value.index),
                });
                return;
              }

              case 'content-delta': {
                if ('thinking' in value.delta.message.content) {
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: String(value.index),
                    delta: value.delta.message.content.thinking,
                  });
                  return;
                }

                controller.enqueue({
                  type: 'text-delta',
                  id: String(value.index),
                  delta: value.delta.message.content.text,
                });
                return;
              }

              case 'content-end': {
                if (isActiveReasoning) {
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: String(value.index),
                  });
                  isActiveReasoning = false;
                  return;
                }

                controller.enqueue({
                  type: 'text-end',
                  id: String(value.index),
                });

                return;
              }

              case 'tool-call-start': {
                const toolId = value.delta.message.tool_calls.id;
                const toolName = value.delta.message.tool_calls.function.name;
                const initialArgs =
                  value.delta.message.tool_calls.function.arguments;

                pendingToolCall = {
                  id: toolId,
                  name: toolName,
                  arguments: initialArgs,
                  hasFinished: false,
                };

                controller.enqueue({
                  type: 'tool-input-start',
                  id: toolId,
                  toolName,
                });

                if (initialArgs.length > 0) {
                  controller.enqueue({
                    type: 'tool-input-delta',
                    id: toolId,
                    delta: initialArgs,
                  });
                }
                return;
              }

              case 'tool-call-delta': {
                if (pendingToolCall && !pendingToolCall.hasFinished) {
                  const argsDelta =
                    value.delta.message.tool_calls.function.arguments;
                  pendingToolCall.arguments += argsDelta;

                  controller.enqueue({
                    type: 'tool-input-delta',
                    id: pendingToolCall.id,
                    delta: argsDelta,
                  });
                }
                return;
              }

              case 'tool-call-end': {
                if (pendingToolCall && !pendingToolCall.hasFinished) {
                  controller.enqueue({
                    type: 'tool-input-end',
                    id: pendingToolCall.id,
                  });

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: pendingToolCall.id,
                    toolName: pendingToolCall.name,
                    input: JSON.stringify(
                      await parseJSON({
                        text: pendingToolCall.arguments?.trim() || '{}',
                      }),
                    ),
                  });

                  pendingToolCall.hasFinished = true;
                  pendingToolCall = null;
                }
                return;
              }

              case 'message-start': {
                controller.enqueue({
                  type: 'response-metadata',
                  id: value.id ?? undefined,
                });
                return;
              }

              case 'message-end': {
                finishReason = {
                  unified: mapCohereFinishReason(value.delta.finish_reason),
                  raw: value.delta.finish_reason,
                };
                usage = value.delta.usage.tokens;
                return;
              }

              default: {
                return;
              }
            }
          },

          flush(controller) {
            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertCohereUsage(usage),
            });
          },
        }),
      ),
      request: { body: { ...args, stream: true } },
      response: { headers: responseHeaders },
    };
  }
}

function resolveCohereThinking({
  reasoning,
  cohereOptions,
  warnings,
}: {
  reasoning: LanguageModelV4CallOptions['reasoning'];
  cohereOptions: InferSchema<typeof cohereLanguageModelChatOptions>;
  warnings: SharedV4Warning[];
}): { thinking?: { type: string; token_budget?: number } } {
  if (cohereOptions.thinking) {
    return {
      thinking: {
        type: cohereOptions.thinking.type ?? 'enabled',
        token_budget: cohereOptions.thinking.tokenBudget,
      },
    };
  }

  if (!isCustomReasoning(reasoning)) {
    return {};
  }

  if (reasoning === 'none') {
    return { thinking: { type: 'disabled' } };
  }

  const tokenBudget = mapReasoningToProviderBudget({
    reasoning,
    maxOutputTokens: 32768,
    maxReasoningBudget: 32768,
    warnings,
  });

  if (tokenBudget == null) {
    return {};
  }

  return { thinking: { type: 'enabled', token_budget: tokenBudget } };
}

const cohereChatResponseSchema = z.object({
  generation_id: z.string().nullish(),
  message: z.object({
    role: z.string(),
    content: z
      .array(
        z.union([
          z.object({
            type: z.literal('text'),
            text: z.string(),
          }),
          z.object({
            type: z.literal('thinking'),
            thinking: z.string(),
          }),
        ]),
      )
      .nullish(),
    tool_plan: z.string().nullish(),
    tool_calls: z
      .array(
        z.object({
          id: z.string(),
          type: z.literal('function'),
          function: z.object({
            name: z.string(),
            arguments: z.string(),
          }),
        }),
      )
      .nullish(),
    citations: z
      .array(
        z.object({
          start: z.number(),
          end: z.number(),
          text: z.string(),
          sources: z.array(
            z.object({
              type: z.string().optional(),
              id: z.string().optional(),
              document: z.object({
                id: z.string().optional(),
                text: z.string(),
                title: z.string(),
              }),
            }),
          ),
          type: z.string().optional(),
        }),
      )
      .nullish(),
  }),
  finish_reason: z.string(),
  usage: z.object({
    billed_units: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    }),
    tokens: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    }),
  }),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const cohereChatChunkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('citation-start'),
  }),
  z.object({
    type: z.literal('citation-end'),
  }),
  z.object({
    type: z.literal('content-start'),
    index: z.number(),
    delta: z.object({
      message: z.object({
        content: z.union([
          z.object({
            type: z.literal('text'),
            text: z.string(),
          }),
          z.object({
            type: z.literal('thinking'),
            thinking: z.string(),
          }),
        ]),
      }),
    }),
  }),
  z.object({
    type: z.literal('content-delta'),
    index: z.number(),
    delta: z.object({
      message: z.object({
        content: z.union([
          z.object({
            text: z.string(),
          }),
          z.object({
            thinking: z.string(),
          }),
        ]),
      }),
    }),
  }),
  z.object({
    type: z.literal('content-end'),
    index: z.number(),
  }),
  z.object({
    type: z.literal('message-start'),
    id: z.string().nullish(),
  }),
  z.object({
    type: z.literal('message-end'),
    delta: z.object({
      finish_reason: z.string(),
      usage: z.object({
        tokens: z.object({
          input_tokens: z.number(),
          output_tokens: z.number(),
        }),
      }),
    }),
  }),
  // https://docs.cohere.com/v2/docs/streaming#tool-use-stream-events-for-tool-calling
  z.object({
    type: z.literal('tool-plan-delta'),
    delta: z.object({
      message: z.object({
        tool_plan: z.string(),
      }),
    }),
  }),
  z.object({
    type: z.literal('tool-call-start'),
    delta: z.object({
      message: z.object({
        tool_calls: z.object({
          id: z.string(),
          type: z.literal('function'),
          function: z.object({
            name: z.string(),
            arguments: z.string(),
          }),
        }),
      }),
    }),
  }),
  // A single tool call's `arguments` stream in chunks and must be accumulated
  // in a string and so the full tool object info can only be parsed once we see
  // `tool-call-end`.
  z.object({
    type: z.literal('tool-call-delta'),
    delta: z.object({
      message: z.object({
        tool_calls: z.object({
          function: z.object({
            arguments: z.string(),
          }),
        }),
      }),
    }),
  }),
  z.object({
    type: z.literal('tool-call-end'),
  }),
]);
