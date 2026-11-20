import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type LanguageModelV4,
  type RerankingModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  generateId,
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { CohereChatLanguageModel } from './cohere-chat-language-model';
import type { CohereChatModelId } from './cohere-chat-language-model-options';
import { CohereEmbeddingModel } from './cohere-embedding-model';
import type { CohereRerankingModelId } from './reranking/cohere-reranking-model-options';
import { CohereRerankingModel } from './reranking/cohere-reranking-model';
import type { CohereEmbeddingModelId } from './cohere-embedding-model-options';
import { VERSION } from './version';

export interface CohereProvider extends ProviderV4 {
  (modelId: CohereChatModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  languageModel(modelId: CohereChatModelId): LanguageModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embedding(modelId: CohereEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embeddingModel(modelId: CohereEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embedding` instead.
   */
  textEmbedding(modelId: CohereEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: CohereEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for reranking.
   */
  reranking(modelId: CohereRerankingModelId): RerankingModelV4;

  /**
   * Creates a model for reranking.
   */
  rerankingModel(modelId: CohereRerankingModelId): RerankingModelV4;
}

export interface CohereProviderSettings {
  /**
   * Use a different URL prefix for API calls, e.g. to use proxy servers.
   * The default prefix is `https://api.cohere.com/v2`.
   */
  baseURL?: string;

  /**
   * API key that is being send using the `Authorization` header.
   * It defaults to the `COHERE_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  /**
   * Optional function to generate a unique ID for each request.
   */
  generateId?: () => string;
}

/**
 * Create a Cohere AI provider instance.
 */
export function createCohere(
  options: CohereProviderSettings = {},
): CohereProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ?? 'https://api.cohere.com/v2';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'COHERE_API_KEY',
          description: 'Cohere',
        })}`,
        ...options.headers,
      },
      `ai-sdk/cohere/${VERSION}`,
    );

  const createChatModel = (modelId: CohereChatModelId) =>
    new CohereChatLanguageModel(modelId, {
      provider: 'cohere.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId ?? generateId,
    });

  const createEmbeddingModel = (modelId: CohereEmbeddingModelId) =>
    new CohereEmbeddingModel(modelId, {
      provider: 'cohere.textEmbedding',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createRerankingModel = (modelId: CohereRerankingModelId) =>
    new CohereRerankingModel(modelId, {
      provider: 'cohere.reranking',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: CohereChatModelId) {
    if (new.target) {
      throw new Error(
        'The Cohere model function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createChatModel;
  provider.embedding = createEmbeddingModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.reranking = createRerankingModel;
  provider.rerankingModel = createRerankingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

/**
 * Default Cohere provider instance.
 */
export const cohere = createCohere();
