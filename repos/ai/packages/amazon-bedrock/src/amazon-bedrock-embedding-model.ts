import {
  TooManyEmbeddingValuesForCallError,
  type EmbeddingModelV4,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import {
  amazonBedrockEmbeddingModelOptionsSchema,
  type AmazonBedrockEmbeddingModelId,
} from './amazon-bedrock-embedding-model-options';
import { AmazonBedrockErrorSchema } from './amazon-bedrock-error';
import { z } from 'zod/v4';

type AmazonBedrockEmbeddingConfig = {
  baseUrl: () => string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
};

type DoEmbedResponse = Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>;

export class AmazonBedrockEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider = 'amazon-bedrock';
  readonly supportsParallelCalls = true;

  get maxEmbeddingsPerCall() {
    return isCohereEmbeddingModel(this.modelId) ? 96 : 1;
  }

  static [WORKFLOW_SERIALIZE](model: AmazonBedrockEmbeddingModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: AmazonBedrockEmbeddingConfig;
  }) {
    return new AmazonBedrockEmbeddingModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: AmazonBedrockEmbeddingModelId,
    private readonly config: AmazonBedrockEmbeddingConfig,
  ) {}

  private getUrl(modelId: string): string {
    const encodedModelId = encodeURIComponent(modelId);
    return `${this.config.baseUrl()}/model/${encodedModelId}/invoke`;
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<EmbeddingModelV4['doEmbed']>[0]): Promise<DoEmbedResponse> {
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    // Parse provider options. Prefer `amazonBedrock`; fall back to legacy
    // `bedrock` key for backward compatibility.
    const amazonBedrockOptions =
      (await parseProviderOptions({
        provider: 'amazonBedrock',
        providerOptions,
        schema: amazonBedrockEmbeddingModelOptionsSchema,
      })) ??
      (await parseProviderOptions({
        provider: 'bedrock',
        providerOptions,
        schema: amazonBedrockEmbeddingModelOptionsSchema,
      })) ??
      {};

    // https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html
    //
    // Note: Different embedding model families expect different request/response
    // payloads (e.g. Titan vs Cohere vs Nova). We keep the public interface stable and
    // adapt here based on the modelId.
    const isNovaModel = isNovaEmbeddingModel(this.modelId);
    const isCohereModel = isCohereEmbeddingModel(this.modelId);

    const args = isNovaModel
      ? {
          taskType: 'SINGLE_EMBEDDING',
          singleEmbeddingParams: {
            embeddingPurpose:
              amazonBedrockOptions.embeddingPurpose ?? 'GENERIC_INDEX',
            embeddingDimension: amazonBedrockOptions.embeddingDimension ?? 1024,
            text: {
              truncationMode: amazonBedrockOptions.truncate ?? 'END',
              value: values[0],
            },
          },
        }
      : isCohereModel
        ? {
            // Cohere embedding models on Bedrock require `input_type`.
            // Without it, the service attempts other schema branches and rejects the request.
            input_type: amazonBedrockOptions.inputType ?? 'search_query',
            texts: values,
            truncate: amazonBedrockOptions.truncate,
            output_dimension: amazonBedrockOptions.outputDimension,
          }
        : {
            inputText: values[0],
            dimensions: amazonBedrockOptions.dimensions,
            normalize: amazonBedrockOptions.normalize,
          };

    const url = this.getUrl(this.modelId);
    const { value: response, responseHeaders } = await postJsonToApi({
      url,
      headers: await resolve(
        combineHeaders(
          this.config.headers ? await resolve(this.config.headers) : undefined,
          headers,
        ),
      ),
      body: args,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: AmazonBedrockErrorSchema,
        errorToMessage: error => `${error.type}: ${error.message}`,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        AmazonBedrockEmbeddingResponseSchema,
      ),
      fetch: this.config.fetch,
      abortSignal,
    });

    // Extract embeddings based on response format
    let embeddings: number[][];
    if ('embedding' in response) {
      // Titan response
      embeddings = [response.embedding];
    } else if (Array.isArray(response.embeddings)) {
      const firstEmbedding = response.embeddings[0];
      if (
        typeof firstEmbedding === 'object' &&
        firstEmbedding !== null &&
        'embeddingType' in firstEmbedding
      ) {
        // Nova response
        embeddings = [firstEmbedding.embedding];
      } else {
        // Cohere v3 response
        embeddings = response.embeddings as number[][];
      }
    } else {
      // Cohere v4 response
      embeddings = response.embeddings.float;
    }

    // Extract token count based on response format
    const headerTokenCount = Number(
      responseHeaders?.['x-amzn-bedrock-input-token-count'],
    );
    const tokens =
      'inputTextTokenCount' in response
        ? response.inputTextTokenCount // Titan response
        : 'inputTokenCount' in response
          ? (response.inputTokenCount ?? 0) // Nova response
          : headerTokenCount;

    return {
      embeddings,
      usage: { tokens },
      warnings: [],
    };
  }
}

function isCohereEmbeddingModel(modelId: string) {
  // Use `includes` so cross-region inference profile ids (e.g.
  // `us.cohere.embed-v4:0`, `global.cohere.embed-v4:0`) are detected too.
  return modelId.includes('cohere.embed-');
}

function isNovaEmbeddingModel(modelId: string) {
  return modelId.startsWith('amazon.nova-') && modelId.includes('embed');
}

const AmazonBedrockEmbeddingResponseSchema = z.union([
  // Titan-style response
  z.object({
    embedding: z.array(z.number()),
    inputTextTokenCount: z.number(),
  }),
  // Nova-style response
  z.object({
    embeddings: z.array(
      z.object({
        embeddingType: z.string(),
        embedding: z.array(z.number()),
      }),
    ),
    inputTokenCount: z.number().optional(),
  }),
  // Cohere v3-style response
  z.object({
    embeddings: z.array(z.array(z.number())),
  }),
  // Cohere v4-style response
  z.object({
    embeddings: z.object({
      float: z.array(z.array(z.number())),
    }),
  }),
]);
