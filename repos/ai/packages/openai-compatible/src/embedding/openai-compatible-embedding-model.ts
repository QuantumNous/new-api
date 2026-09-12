import {
  TooManyEmbeddingValuesForCallError,
  type EmbeddingModelV4,
  type SharedV4Warning,
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
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  openaiCompatibleEmbeddingModelOptions,
  type OpenAICompatibleEmbeddingModelId,
} from './openai-compatible-embedding-model-options';
import {
  defaultOpenAICompatibleErrorStructure,
  type ProviderErrorStructure,
} from '../openai-compatible-error';
import { warnIfDeprecatedProviderOptionsKey } from '../utils/to-camel-case';

type OpenAICompatibleEmbeddingConfig = {
  /**
   * Override the maximum number of embeddings per call.
   */
  maxEmbeddingsPerCall?: number;

  /**
   * Override the parallelism of embedding calls.
   */
  supportsParallelCalls?: boolean;

  provider: string;
  url: (options: { modelId: string; path: string }) => string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  errorStructure?: ProviderErrorStructure<any>;
};

export class OpenAICompatibleEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: OpenAICompatibleEmbeddingModelId;

  private readonly config: OpenAICompatibleEmbeddingConfig;

  get provider(): string {
    return this.config.provider;
  }

  get maxEmbeddingsPerCall(): number {
    return this.config.maxEmbeddingsPerCall ?? 2048;
  }

  get supportsParallelCalls(): boolean {
    return this.config.supportsParallelCalls ?? true;
  }

  static [WORKFLOW_SERIALIZE](model: OpenAICompatibleEmbeddingModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: OpenAICompatibleEmbeddingConfig;
  }) {
    return new OpenAICompatibleEmbeddingModel(options.modelId, options.config);
  }

  constructor(
    modelId: OpenAICompatibleEmbeddingModelId,
    config: OpenAICompatibleEmbeddingConfig,
  ) {
    this.modelId = modelId;
    this.config = config;
  }

  private get providerOptionsName(): string {
    return this.config.provider.split('.')[0].trim();
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<EmbeddingModelV4['doEmbed']>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>
  > {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options - check for deprecated 'openai-compatible' key
    const deprecatedOptions = await parseProviderOptions({
      provider: 'openai-compatible',
      providerOptions,
      schema: openaiCompatibleEmbeddingModelOptions,
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
        schema: openaiCompatibleEmbeddingModelOptions,
      })) ?? {},
      (await parseProviderOptions({
        provider: this.providerOptionsName,
        providerOptions,
        schema: openaiCompatibleEmbeddingModelOptions,
      })) ?? {},
    );

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
      url: this.config.url({
        path: '/embeddings',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: 'float',
        dimensions: compatibleOptions.dimensions,
        user: compatibleOptions.user,
      },
      failedResponseHandler: createJsonErrorResponseHandler(
        this.config.errorStructure ?? defaultOpenAICompatibleErrorStructure,
      ),
      successfulResponseHandler: createJsonResponseHandler(
        openaiTextEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      warnings,
      embeddings: response.data.map(item => item.embedding),
      usage: response.usage
        ? { tokens: response.usage.prompt_tokens }
        : undefined,
      providerMetadata: response.providerMetadata,
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}

// minimal version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const openaiTextEmbeddingResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })),
  usage: z.object({ prompt_tokens: z.number() }).nullish(),
  providerMetadata: z
    .record(z.string(), z.record(z.string(), z.any()))
    .optional(),
});
