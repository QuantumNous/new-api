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
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from '@ai-sdk/provider-utils';
import type { OpenAIConfig } from '../openai-config';
import { openaiFailedResponseHandler } from '../openai-error';
import {
  openaiEmbeddingModelOptions,
  type OpenAIEmbeddingModelId,
} from './openai-embedding-model-options';
import { openaiTextEmbeddingResponseSchema } from './openai-embedding-api';

export class OpenAIEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: OpenAIEmbeddingModelId;
  readonly maxEmbeddingsPerCall = 2048;
  readonly supportsParallelCalls = true;

  private readonly config: OpenAIConfig;

  static [WORKFLOW_SERIALIZE](model: OpenAIEmbeddingModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: OpenAIEmbeddingModelId;
    config: OpenAIConfig;
  }) {
    return new OpenAIEmbeddingModel(options.modelId, options.config);
  }

  get provider(): string {
    return this.config.provider;
  }

  constructor(modelId: OpenAIEmbeddingModelId, config: OpenAIConfig) {
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
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    // Parse provider options
    const openaiOptions =
      (await parseProviderOptions({
        provider: 'openai',
        providerOptions,
        schema: openaiEmbeddingModelOptions,
      })) ?? {};

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/embeddings',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: 'float',
        dimensions: openaiOptions.dimensions,
        user: openaiOptions.user,
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiTextEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      warnings: [],
      embeddings: response.data.map(item => item.embedding),
      usage: response.usage
        ? { tokens: response.usage.prompt_tokens }
        : undefined,
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}
