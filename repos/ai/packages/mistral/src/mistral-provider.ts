import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { MistralChatLanguageModel } from './mistral-chat-language-model';
import type { MistralChatModelId } from './mistral-chat-language-model-options';
import { MistralEmbeddingModel } from './mistral-embedding-model';
import type { MistralEmbeddingModelId } from './mistral-embedding-options';
import { VERSION } from './version';

export interface MistralProvider extends ProviderV4 {
  (modelId: MistralChatModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  languageModel(modelId: MistralChatModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  chat(modelId: MistralChatModelId): LanguageModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embedding(modelId: MistralEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embeddingModel: (modelId: MistralEmbeddingModelId) => EmbeddingModelV4;

  /**
   * @deprecated Use `embedding` instead.
   */
  textEmbedding(modelId: MistralEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: MistralEmbeddingModelId): EmbeddingModelV4;
}

export interface MistralProviderSettings {
  /**
   * Use a different URL prefix for API calls, e.g. to use proxy servers.
   * The default prefix is `https://api.mistral.ai/v1`.
   */
  baseURL?: string;

  /**
   * API key that is being send using the `Authorization` header.
   * It defaults to the `MISTRAL_API_KEY` environment variable.
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

  generateId?: () => string;
}

/**
 * Create a Mistral AI provider instance.
 */
export function createMistral(
  options: MistralProviderSettings = {},
): MistralProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ?? 'https://api.mistral.ai/v1';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'MISTRAL_API_KEY',
          description: 'Mistral',
        })}`,
        ...options.headers,
      },
      `ai-sdk/mistral/${VERSION}`,
    );

  const createChatModel = (modelId: MistralChatModelId) =>
    new MistralChatLanguageModel(modelId, {
      provider: 'mistral.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId,
    });

  const createEmbeddingModel = (modelId: MistralEmbeddingModelId) =>
    new MistralEmbeddingModel(modelId, {
      provider: 'mistral.embedding',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: MistralChatModelId) {
    if (new.target) {
      throw new Error(
        'The Mistral model function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.embedding = createEmbeddingModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

/**
 * Default Mistral provider instance.
 */
export const mistral = createMistral();
