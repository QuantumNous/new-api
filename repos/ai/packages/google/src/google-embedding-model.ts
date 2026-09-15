import {
  TooManyEmbeddingValuesForCallError,
  type EmbeddingModelV4,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  lazySchema,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  zodSchema,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { googleFailedResponseHandler } from './google-error';
import {
  googleEmbeddingModelOptions,
  type GoogleEmbeddingModelId,
} from './google-embedding-model-options';
type GoogleEmbeddingConfig = {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class GoogleEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: GoogleEmbeddingModelId;
  readonly maxEmbeddingsPerCall = 100;
  readonly supportsParallelCalls = true;

  private readonly config: GoogleEmbeddingConfig;

  static [WORKFLOW_SERIALIZE](model: GoogleEmbeddingModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: GoogleEmbeddingConfig;
  }) {
    return new GoogleEmbeddingModel(options.modelId, options.config);
  }

  get provider(): string {
    return this.config.provider;
  }
  constructor(modelId: GoogleEmbeddingModelId, config: GoogleEmbeddingConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<EmbeddingModelV4['doEmbed']>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>
  > {
    // Parse provider options
    const googleOptions = await parseProviderOptions({
      provider: 'google',
      providerOptions,
      schema: googleEmbeddingModelOptions,
    });

    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    const mergedHeaders = combineHeaders(
      this.config.headers ? await resolve(this.config.headers) : undefined,
      headers,
    );

    const multimodalContent = googleOptions?.content;

    if (
      multimodalContent != null &&
      multimodalContent.length !== values.length
    ) {
      throw new Error(
        `The number of multimodal content entries (${multimodalContent.length}) must match the number of values (${values.length}).`,
      );
    }

    // For single embeddings, use the single endpoint
    if (values.length === 1) {
      const valueParts = multimodalContent?.[0];
      const textPart = values[0] ? [{ text: values[0] }] : [];
      const parts =
        valueParts != null
          ? [...textPart, ...valueParts]
          : [{ text: values[0] }];

      const {
        responseHeaders,
        value: response,
        rawValue,
      } = await postJsonToApi({
        url: `${this.config.baseURL}/models/${this.modelId}:embedContent`,
        headers: mergedHeaders,
        body: {
          model: `models/${this.modelId}`,
          content: {
            parts,
          },
          outputDimensionality: googleOptions?.outputDimensionality,
          taskType: googleOptions?.taskType,
        },
        failedResponseHandler: googleFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          googleGenerativeAISingleEmbeddingResponseSchema,
        ),
        abortSignal,
        fetch: this.config.fetch,
      });

      return {
        warnings: [],
        embeddings: [response.embedding.values],
        usage: undefined,
        response: { headers: responseHeaders, body: rawValue },
      };
    }

    // For multiple values, use the batch endpoint
    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/models/${this.modelId}:batchEmbedContents`,
      headers: mergedHeaders,
      body: {
        requests: values.map((value, index) => {
          const valueParts = multimodalContent?.[index];
          const textPart = value ? [{ text: value }] : [];
          return {
            model: `models/${this.modelId}`,
            content: {
              role: 'user',
              parts:
                valueParts != null
                  ? [...textPart, ...valueParts]
                  : [{ text: value }],
            },
            outputDimensionality: googleOptions?.outputDimensionality,
            taskType: googleOptions?.taskType,
          };
        }),
      },
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        googleGenerativeAITextEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      warnings: [],
      embeddings: response.embeddings.map(item => item.values),
      usage: undefined,
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}

// minimal version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const googleGenerativeAITextEmbeddingResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      embeddings: z.array(z.object({ values: z.array(z.number()) })),
    }),
  ),
);

// Schema for single embedding response
const googleGenerativeAISingleEmbeddingResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      embedding: z.object({ values: z.array(z.number()) }),
    }),
  ),
);
