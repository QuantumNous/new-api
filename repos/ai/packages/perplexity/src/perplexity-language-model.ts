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
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  isCustomReasoning,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { convertPerplexityUsage } from './convert-perplexity-usage';
import { convertToPerplexityMessages } from './convert-to-perplexity-messages';
import { mapPerplexityFinishReason } from './map-perplexity-finish-reason';
import { perplexityLanguageModelOptions } from './perplexity-language-model-options';
import type { PerplexityLanguageModelId } from './perplexity-options';

type PerplexityChatConfig = {
  baseURL: string;
  headers?: () => Record<string, string | undefined>;
  generateId: () => string;
  fetch?: FetchFunction;
};

export class PerplexityLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider = 'perplexity';

  readonly modelId: PerplexityLanguageModelId;

  private readonly config: PerplexityChatConfig;

  static [WORKFLOW_SERIALIZE](model: PerplexityLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: PerplexityLanguageModelId;
    config: PerplexityChatConfig;
  }) {
    return new PerplexityLanguageModel(options.modelId, options.config);
  }

  constructor(
    modelId: PerplexityLanguageModelId,
    config: PerplexityChatConfig,
  ) {
    this.modelId = modelId;
    this.config = config;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    // No URLs are supported.
  };

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    reasoning,
    responseFormat,
    seed,
    providerOptions,
  }: LanguageModelV4CallOptions) {
    const warnings: SharedV4Warning[] = [];

    const perplexityOptions =
      (await parseProviderOptions({
        provider: 'perplexity',
        providerOptions,
        schema: perplexityLanguageModelOptions,
      })) ?? {};

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    if (stopSequences != null) {
      warnings.push({ type: 'unsupported', feature: 'stopSequences' });
    }

    if (seed != null) {
      warnings.push({ type: 'unsupported', feature: 'seed' });
    }

    if (isCustomReasoning(reasoning)) {
      warnings.push({
        type: 'unsupported',
        feature: 'reasoning',
        details: 'This provider does not support reasoning configuration.',
      });
    }

    return {
      args: {
        // model id:
        model: this.modelId,

        // standardized settings:
        frequency_penalty: frequencyPenalty,
        max_tokens: maxOutputTokens,
        presence_penalty: presencePenalty,
        temperature,
        top_k: topK,
        top_p: topP,

        // response format:
        response_format:
          responseFormat?.type === 'json'
            ? {
                type: 'json_schema',
                json_schema: { schema: responseFormat.schema },
              }
            : undefined,

        // provider extensions
        ...perplexityOptions,

        // messages:
        messages: convertToPerplexityMessages(prompt),
      },
      warnings,
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
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: perplexityErrorSchema,
        errorToMessage,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        perplexityResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const choice = response.choices[0];
    const content: Array<LanguageModelV4Content> = [];

    // text content:
    const text = choice.message.content;
    if (text.length > 0) {
      content.push({ type: 'text', text });
    }

    // sources:
    if (response.citations != null) {
      for (const url of response.citations) {
        content.push({
          type: 'source',
          sourceType: 'url',
          id: this.config.generateId(),
          url,
        });
      }
    }

    return {
      content,
      finishReason: {
        unified: mapPerplexityFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined,
      },
      usage: convertPerplexityUsage(response.usage),
      request: { body },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
      providerMetadata: {
        perplexity: {
          images:
            response.images?.map(image => ({
              imageUrl: image.image_url,
              originUrl: image.origin_url,
              height: image.height,
              width: image.width,
            })) ?? null,
          usage: {
            citationTokens: response.usage?.citation_tokens ?? null,
            numSearchQueries: response.usage?.num_search_queries ?? null,
          },
          cost: response.usage?.cost
            ? {
                inputTokensCost: response.usage.cost.input_tokens_cost ?? null,
                outputTokensCost:
                  response.usage.cost.output_tokens_cost ?? null,
                requestCost: response.usage.cost.request_cost ?? null,
                totalCost: response.usage.cost.total_cost ?? null,
              }
            : null,
        },
      },
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
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: perplexityErrorSchema,
        errorToMessage,
      }),
      successfulResponseHandler: createEventSourceResponseHandler(
        perplexityChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage:
      | {
          prompt_tokens: number | undefined;
          completion_tokens: number | undefined;
          reasoning_tokens?: number | null | undefined;
        }
      | undefined = undefined;

    const providerMetadata: {
      perplexity: {
        usage: {
          citationTokens: number | null;
          numSearchQueries: number | null;
        };
        cost: {
          inputTokensCost: number | null;
          outputTokensCost: number | null;
          requestCost: number | null;
          totalCost: number | null;
        } | null;
        images: Array<{
          imageUrl: string;
          originUrl: string;
          height: number;
          width: number;
        }> | null;
      };
    } = {
      perplexity: {
        usage: {
          citationTokens: null,
          numSearchQueries: null,
        },
        cost: null,
        images: null,
      },
    };
    let isFirstChunk = true;
    let isActive = false;

    const self = this;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof perplexityChunkSchema>>,
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
              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value),
              });

              value.citations?.forEach(url => {
                controller.enqueue({
                  type: 'source',
                  sourceType: 'url',
                  id: self.config.generateId(),
                  url,
                });
              });

              isFirstChunk = false;
            }

            if (value.usage != null) {
              usage = value.usage;

              providerMetadata.perplexity.usage = {
                citationTokens: value.usage.citation_tokens ?? null,
                numSearchQueries: value.usage.num_search_queries ?? null,
              };

              providerMetadata.perplexity.cost = value.usage.cost
                ? {
                    inputTokensCost: value.usage.cost.input_tokens_cost ?? null,
                    outputTokensCost:
                      value.usage.cost.output_tokens_cost ?? null,
                    requestCost: value.usage.cost.request_cost ?? null,
                    totalCost: value.usage.cost.total_cost ?? null,
                  }
                : null;
            }

            if (value.images != null) {
              providerMetadata.perplexity.images = value.images.map(image => ({
                imageUrl: image.image_url,
                originUrl: image.origin_url,
                height: image.height,
                width: image.width,
              }));
            }

            const choice = value.choices[0];
            if (choice?.finish_reason != null) {
              finishReason = {
                unified: mapPerplexityFinishReason(choice.finish_reason),
                raw: choice.finish_reason,
              };
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;
            const textContent = delta.content;

            if (textContent != null) {
              if (!isActive) {
                controller.enqueue({ type: 'text-start', id: '0' });
                isActive = true;
              }

              controller.enqueue({
                type: 'text-delta',
                id: '0',
                delta: textContent,
              });
            }
          },

          flush(controller) {
            if (isActive) {
              controller.enqueue({ type: 'text-end', id: '0' });
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertPerplexityUsage(usage),
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

function getResponseMetadata({
  id,
  model,
  created,
}: {
  id: string;
  created: number;
  model: string;
}) {
  return {
    id,
    modelId: model,
    timestamp: new Date(created * 1000),
  };
}

const perplexityCostSchema = z.object({
  input_tokens_cost: z.number().nullish(),
  output_tokens_cost: z.number().nullish(),
  request_cost: z.number().nullish(),
  total_cost: z.number().nullish(),
});

const perplexityUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number().nullish(),
  citation_tokens: z.number().nullish(),
  num_search_queries: z.number().nullish(),
  reasoning_tokens: z.number().nullish(),
  cost: perplexityCostSchema.nullish(),
});

export const perplexityImageSchema = z.object({
  image_url: z.string(),
  origin_url: z.string(),
  height: z.number(),
  width: z.number(),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const perplexityResponseSchema = z.object({
  id: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant'),
        content: z.string(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  citations: z.array(z.string()).nullish(),
  images: z.array(perplexityImageSchema).nullish(),
  usage: perplexityUsageSchema.nullish(),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const perplexityChunkSchema = z.object({
  id: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      delta: z.object({
        role: z.literal('assistant').optional(),
        content: z.string().nullish(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  citations: z.array(z.string()).nullish(),
  images: z.array(perplexityImageSchema).nullish(),
  usage: perplexityUsageSchema.nullish(),
});

export const perplexityErrorSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string().nullish(),
    type: z.string().nullish(),
  }),
});

export type PerplexityErrorData = z.infer<typeof perplexityErrorSchema>;

const errorToMessage = (data: PerplexityErrorData) => {
  return data.error.message ?? data.error.type ?? 'unknown error';
};
