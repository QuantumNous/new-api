import {
  TooManyEmbeddingValuesForCallError,
  UnsupportedFunctionalityError,
  type EmbeddingModelV4,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  alibabaEmbeddingModelOptions,
  type AlibabaEmbeddingModelId,
} from './alibaba-embedding-model-options';
import type { AlibabaConfig } from './alibaba-config';

// TODO: Add Alibaba multimodal embedding support in a follow-up change.
const alibabaEmbeddingFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: z.object({
    code: z.string().nullish(),
    message: z.string(),
    request_id: z.string().nullish(),
  }),
  errorToMessage: data => data.message,
});

export class AlibabaEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: AlibabaEmbeddingModelId;
  readonly maxEmbeddingsPerCall = 10;
  readonly supportsParallelCalls = false;

  private readonly config: AlibabaConfig;

  static [WORKFLOW_SERIALIZE](model: AlibabaEmbeddingModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: AlibabaEmbeddingModelId;
    config: AlibabaConfig;
  }) {
    return new AlibabaEmbeddingModel(options.modelId, options.config);
  }

  constructor(modelId: AlibabaEmbeddingModelId, config: AlibabaConfig) {
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
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    const alibabaOptions = await parseProviderOptions({
      provider: 'alibaba',
      providerOptions,
      schema: alibabaEmbeddingModelOptions,
    });

    // TODO: Explore first-class sparse embedding support in AI SDK core.
    if (alibabaOptions?.outputType === 'sparse') {
      throw new UnsupportedFunctionalityError({
        functionality: "Alibaba embedding outputType 'sparse'",
        message:
          "Alibaba embedding outputType 'sparse' is not supported because AI SDK embeddings require dense number arrays. Use 'dense' or 'dense&sparse' instead.",
      });
    }

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/services/embeddings/text-embedding/text-embedding`,
      headers: combineHeaders(this.config.headers?.(), headers),
      body: {
        model: this.modelId,
        input: {
          texts: values,
        },
        parameters: {
          text_type: alibabaOptions?.textType,
          dimension: alibabaOptions?.dimension,
          output_type: alibabaOptions?.outputType,
        },
      },
      failedResponseHandler: alibabaEmbeddingFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        alibabaTextEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const sortedEmbeddings = response.output.embeddings.sort(
      (a, b) => a.text_index - b.text_index,
    );
    const sparseEmbeddings = sortedEmbeddings
      .map(item =>
        item.sparse_embedding == null
          ? undefined
          : {
              textIndex: item.text_index,
              sparseEmbedding: item.sparse_embedding,
            },
      )
      .filter(item => item != null);

    return {
      warnings: [],
      embeddings: sortedEmbeddings.map(item => item.embedding),
      usage: response.usage
        ? { tokens: response.usage.total_tokens }
        : undefined,
      providerMetadata:
        sparseEmbeddings.length > 0
          ? {
              alibaba: {
                sparseEmbeddings,
              },
            }
          : undefined,
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}

const alibabaTextEmbeddingSparseEmbeddingSchema = z.object({
  index: z.number(),
  value: z.number(),
  token: z.string().nullish(),
});

const alibabaTextEmbeddingResponseSchema = z.object({
  output: z.object({
    embeddings: z.array(
      z.object({
        embedding: z.array(z.number()),
        text_index: z.number(),
        sparse_embedding: z
          .array(alibabaTextEmbeddingSparseEmbeddingSchema)
          .nullish(),
      }),
    ),
  }),
  usage: z
    .object({
      total_tokens: z.number(),
    })
    .nullish(),
});
