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
  generateId,
  injectJsonInstructionIntoMessages,
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
import {
  convertMistralUsage,
  type MistralUsage,
} from './convert-mistral-usage';
import { convertToMistralChatMessages } from './convert-to-mistral-chat-messages';
import { getResponseMetadata } from './get-response-metadata';
import { mapMistralFinishReason } from './map-mistral-finish-reason';
import {
  mistralLanguageModelChatOptions,
  type MistralChatModelId,
} from './mistral-chat-language-model-options';
import { mistralFailedResponseHandler } from './mistral-error';
import { prepareTools } from './mistral-prepare-tools';

type MistralChatConfig = {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  generateId?: () => string;
};

export class MistralChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: MistralChatModelId;

  private readonly config: MistralChatConfig;
  private readonly generateId: () => string;

  static [WORKFLOW_SERIALIZE](model: MistralChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: MistralChatModelId;
    config: MistralChatConfig;
  }) {
    return new MistralChatLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: MistralChatModelId, config: MistralChatConfig) {
    this.modelId = modelId;
    this.config = config;
    this.generateId = config.generateId ?? generateId;
  }

  get provider(): string {
    return this.config.provider;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    'application/pdf': [/^https:\/\/.*$/],
  };

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    reasoning,
    stopSequences,
    responseFormat,
    seed,
    providerOptions,
    tools,
    toolChoice,
  }: LanguageModelV4CallOptions) {
    const warnings: SharedV4Warning[] = [];

    const options =
      (await parseProviderOptions({
        provider: 'mistral',
        providerOptions,
        schema: mistralLanguageModelChatOptions,
      })) ?? {};

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    if (frequencyPenalty != null) {
      warnings.push({ type: 'unsupported', feature: 'frequencyPenalty' });
    }

    if (presencePenalty != null) {
      warnings.push({ type: 'unsupported', feature: 'presencePenalty' });
    }

    const supportsReasoningEffort =
      this.modelId === 'mistral-small-latest' ||
      this.modelId === 'mistral-small-2603' ||
      this.modelId === 'mistral-medium-3' ||
      this.modelId === 'mistral-medium-3.5';

    let resolvedReasoningEffort: string | undefined;
    if (supportsReasoningEffort) {
      resolvedReasoningEffort =
        options.reasoningEffort ??
        (isCustomReasoning(reasoning)
          ? reasoning === 'none'
            ? 'none'
            : mapReasoningToProviderEffort({
                reasoning,
                effortMap: {
                  minimal: 'high',
                  low: 'high',
                  medium: 'high',
                  high: 'high',
                  xhigh: 'high',
                },
                warnings,
              })
          : undefined);
    } else if (isCustomReasoning(reasoning)) {
      warnings.push({
        type: 'unsupported',
        feature: 'reasoning',
        details: 'This model does not support reasoning configuration.',
      });
    }

    const structuredOutputs = options.structuredOutputs ?? true;
    const strictJsonSchema = options.strictJsonSchema ?? false;

    // For Mistral we need to need to instruct the model to return a JSON object.
    // https://docs.mistral.ai/capabilities/structured-output/structured_output_overview/
    if (responseFormat?.type === 'json' && !responseFormat?.schema) {
      prompt = injectJsonInstructionIntoMessages({
        messages: prompt,
        schema: responseFormat.schema,
      });
    }

    const baseArgs = {
      // model id:
      model: this.modelId,

      // model specific settings:
      safe_prompt: options.safePrompt,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      stop: stopSequences,
      random_seed: seed,
      reasoning_effort: resolvedReasoningEffort,

      // response format:
      response_format:
        responseFormat?.type === 'json'
          ? structuredOutputs && responseFormat?.schema != null
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

      // mistral-specific provider options:
      document_image_limit: options.documentImageLimit,
      document_page_limit: options.documentPageLimit,

      // messages:
      messages: convertToMistralChatMessages(prompt),
    };

    const {
      tools: mistralTools,
      toolChoice: mistralToolChoice,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
    });

    return {
      args: {
        ...baseArgs,
        tools: mistralTools,
        tool_choice: mistralToolChoice,
        ...(mistralTools != null && options.parallelToolCalls !== undefined
          ? { parallel_tool_calls: options.parallelToolCalls }
          : {}),
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
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: mistralFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        mistralChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const choice = response.choices[0];
    const content: Array<LanguageModelV4Content> = [];

    // process content parts in order to preserve sequence
    if (
      choice.message.content != null &&
      Array.isArray(choice.message.content)
    ) {
      for (const part of choice.message.content) {
        if (part.type === 'thinking') {
          const reasoningText = extractReasoningContent(part.thinking);
          if (reasoningText.length > 0) {
            content.push({ type: 'reasoning', text: reasoningText });
          }
        } else if (part.type === 'text') {
          if (part.text.length > 0) {
            content.push({ type: 'text', text: part.text });
          }
        }
      }
    } else {
      // handle legacy string content
      const text = extractTextContent(choice.message.content);
      if (text != null && text.length > 0) {
        content.push({ type: 'text', text });
      }
    }

    // when there is a trailing assistant message, mistral will send the
    // content of that message again. we skip this repeated content to
    // avoid duplication, e.g. in continuation mode.

    // tool calls:
    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments!,
        });
      }
    }

    return {
      content,
      finishReason: {
        unified: mapMistralFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined,
      },
      usage: convertMistralUsage(response.usage),
      request: { body },
      response: {
        ...getResponseMetadata(response),
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
    const body = { ...args, stream: true };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: mistralFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        mistralChatChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: MistralUsage | undefined = undefined;

    let isFirstChunk = true;
    let activeText = false;
    let activeReasoningId: string | null = null;

    const generateId = this.generateId;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof mistralChatChunkSchema>>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            // Emit raw chunk if requested (before anything else)
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            if (!chunk.success) {
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

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
            const delta = choice.delta;

            const textContent = extractTextContent(delta.content);

            if (delta.content != null && Array.isArray(delta.content)) {
              for (const part of delta.content) {
                if (part.type === 'thinking') {
                  const reasoningDelta = extractReasoningContent(part.thinking);
                  if (reasoningDelta.length > 0) {
                    if (activeReasoningId == null) {
                      // end any active text before starting reasoning
                      if (activeText) {
                        controller.enqueue({ type: 'text-end', id: '0' });
                        activeText = false;
                      }

                      activeReasoningId = generateId();
                      controller.enqueue({
                        type: 'reasoning-start',
                        id: activeReasoningId,
                      });
                    }
                    controller.enqueue({
                      type: 'reasoning-delta',
                      id: activeReasoningId,
                      delta: reasoningDelta,
                    });
                  }
                }
              }
            }

            if (textContent != null && textContent.length > 0) {
              if (!activeText) {
                // if we were in reasoning mode, end it before starting text
                if (activeReasoningId != null) {
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: activeReasoningId,
                  });
                  activeReasoningId = null;
                }
                controller.enqueue({ type: 'text-start', id: '0' });
                activeText = true;
              }

              controller.enqueue({
                type: 'text-delta',
                id: '0',
                delta: textContent,
              });
            }

            if (delta?.tool_calls != null) {
              for (const toolCall of delta.tool_calls) {
                const toolCallId = toolCall.id;
                const toolName = toolCall.function.name;
                const input = toolCall.function.arguments;

                controller.enqueue({
                  type: 'tool-input-start',
                  id: toolCallId,
                  toolName,
                });

                controller.enqueue({
                  type: 'tool-input-delta',
                  id: toolCallId,
                  delta: input,
                });

                controller.enqueue({
                  type: 'tool-input-end',
                  id: toolCallId,
                });

                controller.enqueue({
                  type: 'tool-call',
                  toolCallId,
                  toolName,
                  input,
                });
              }
            }

            if (choice.finish_reason != null) {
              finishReason = {
                unified: mapMistralFinishReason(choice.finish_reason),
                raw: choice.finish_reason,
              };
            }
          },

          flush(controller) {
            if (activeReasoningId != null) {
              controller.enqueue({
                type: 'reasoning-end',
                id: activeReasoningId,
              });
            }
            if (activeText) {
              controller.enqueue({ type: 'text-end', id: '0' });
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertMistralUsage(usage),
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}

function extractReasoningContent(
  thinking: Array<{ type: string; text: string }>,
) {
  return thinking
    .filter(chunk => chunk.type === 'text')
    .map(chunk => chunk.text)
    .join('');
}

function extractTextContent(content: z.infer<typeof mistralContentSchema>) {
  if (typeof content === 'string') {
    return content;
  }

  if (content == null) {
    return undefined;
  }

  const textContent: string[] = [];

  for (const chunk of content) {
    const { type } = chunk;

    switch (type) {
      case 'text':
        textContent.push(chunk.text);
        break;
      case 'thinking':
      case 'image_url':
      case 'reference':
        // thinking, image content, and reference content are currently ignored
        break;
      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }

  return textContent.length ? textContent.join('') : undefined;
}

const mistralContentSchema = z
  .union([
    z.string(),
    z.array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('text'),
          text: z.string(),
        }),
        z.object({
          type: z.literal('image_url'),
          image_url: z.union([
            z.string(),
            z.object({
              url: z.string(),
              detail: z.string().nullable(),
            }),
          ]),
        }),
        z.object({
          type: z.literal('reference'),
          reference_ids: z.array(z.union([z.string(), z.number()])),
        }),
        z.object({
          type: z.literal('thinking'),
          thinking: z.array(
            z.object({
              type: z.literal('text'),
              text: z.string(),
            }),
          ),
        }),
      ]),
    ),
  ])
  .nullish();

const mistralUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  num_cached_tokens: z.number().nullish(),
  prompt_tokens_details: z
    .object({ cached_tokens: z.number().nullish() })
    .nullish(),
  prompt_token_details: z
    .object({ cached_tokens: z.number().nullish() })
    .nullish(),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const mistralChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant'),
        content: mistralContentSchema,
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .nullish(),
      }),
      index: z.number(),
      finish_reason: z.string().nullish(),
    }),
  ),
  object: z.literal('chat.completion'),
  usage: mistralUsageSchema,
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const mistralChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z.object({
        role: z.enum(['assistant']).optional(),
        content: mistralContentSchema,
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .nullish(),
      }),
      finish_reason: z.string().nullish(),
      index: z.number(),
    }),
  ),
  usage: mistralUsageSchema.nullish(),
});
