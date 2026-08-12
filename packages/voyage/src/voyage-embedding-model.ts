import {
  TooManyEmbeddingValuesForCallError,
  type EmbeddingModelV4,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  voyageEmbeddingModelOptions,
  type VoyageEmbeddingModelId,
} from './voyage-embedding-model-options';
import { voyageFailedResponseHandler } from './voyage-error';

type VoyageEmbeddingConfig = {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class VoyageEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: VoyageEmbeddingModelId;

  readonly maxEmbeddingsPerCall = 128;
  readonly supportsParallelCalls = true;

  private readonly config: VoyageEmbeddingConfig;

  static [WORKFLOW_SERIALIZE](model: VoyageEmbeddingModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: VoyageEmbeddingModelId;
    config: VoyageEmbeddingConfig;
  }) {
    return new VoyageEmbeddingModel(options.modelId, options.config);
  }

  constructor(modelId: VoyageEmbeddingModelId, config: VoyageEmbeddingConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<EmbeddingModelV4['doEmbed']>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>
  > {
    const embeddingOptions = await parseProviderOptions({
      provider: 'voyage',
      providerOptions,
      schema: voyageEmbeddingModelOptions,
    });

    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/embeddings`,
      headers: combineHeaders(this.config.headers?.(), headers),
      body: {
        input: values,
        model: this.modelId,
        input_type: embeddingOptions?.inputType,
        truncation: embeddingOptions?.truncation,
        output_dimension: embeddingOptions?.outputDimension,
        output_dtype: embeddingOptions?.outputDtype,
      },
      failedResponseHandler: voyageFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        voyageEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      warnings: [],
      embeddings: response.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding),
      usage: { tokens: response.usage?.total_tokens ?? 0 },
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}

const voyageEmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number(),
    }),
  ),
  model: z.string(),
  usage: z
    .object({
      total_tokens: z.number(),
    })
    .nullish(),
});
