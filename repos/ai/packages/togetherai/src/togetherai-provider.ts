import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
} from '@ai-sdk/openai-compatible';
import type {
  EmbeddingModelV4,
  ImageModelV4,
  LanguageModelV4,
  ProviderV4,
  RerankingModelV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { TogetherAIRerankingModel } from './reranking/togetherai-reranking-model';
import type { TogetherAIRerankingModelId } from './reranking/togetherai-reranking-model-options';
import type { TogetherAIChatModelId } from './togetherai-chat-options';
import type { TogetherAICompletionModelId } from './togetherai-completion-options';
import type { TogetherAIEmbeddingModelId } from './togetherai-embedding-options';
import { TogetherAIImageModel } from './togetherai-image-model';
import type { TogetherAIImageModelId } from './togetherai-image-settings';
import { VERSION } from './version';

export interface TogetherAIProviderSettings {
  /**
   * TogetherAI API key.
   */
  apiKey?: string;
  /**
   * Base URL for the API calls.
   */
  baseURL?: string;
  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;
  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;
}

export interface TogetherAIProvider extends ProviderV4 {
  /**
   * Creates a model for text generation.
   */
  (modelId: TogetherAIChatModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  chatModel(modelId: TogetherAIChatModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  languageModel(modelId: TogetherAIChatModelId): LanguageModelV4;

  /**
   * Creates a completion model for text generation.
   */
  completionModel(modelId: TogetherAICompletionModelId): LanguageModelV4;

  /**
   * Creates a text embedding model for text generation.
   */
  embeddingModel(modelId: TogetherAIEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: TogetherAIEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for image generation.
   */
  image(modelId: TogetherAIImageModelId): ImageModelV4;

  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: TogetherAIImageModelId): ImageModelV4;

  /**
   * Creates a model for reranking.
   */
  reranking(modelId: TogetherAIRerankingModelId): RerankingModelV4;

  /**
   * Creates a model for reranking.
   */
  rerankingModel(modelId: TogetherAIRerankingModelId): RerankingModelV4;
}

function loadDeprecatedApiKey(): string | undefined {
  if (typeof process === 'undefined') {
    return undefined;
  }
  // If the new env var is set, let loadApiKey handle it
  if (typeof process.env.TOGETHER_API_KEY === 'string') {
    return undefined;
  }
  const key = process.env.TOGETHER_AI_API_KEY;
  if (typeof key === 'string') {
    console.warn(
      'TOGETHER_AI_API_KEY is deprecated and will be removed in a future release. Please use TOGETHER_API_KEY instead.',
    );
  }
  return key;
}

export function createTogetherAI(
  options: TogetherAIProviderSettings = {},
): TogetherAIProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://api.together.xyz/v1/',
  );
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey ?? loadDeprecatedApiKey(),
          environmentVariableName: 'TOGETHER_API_KEY',
          description: 'TogetherAI',
        })}`,
        ...options.headers,
      },
      `ai-sdk/togetherai/${VERSION}`,
    );

  interface CommonModelConfig {
    provider: string;
    url: ({ path }: { path: string }) => string;
    headers: () => Record<string, string>;
    fetch?: FetchFunction;
  }

  const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
    provider: `togetherai.${modelType}`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createChatModel = (modelId: TogetherAIChatModelId) => {
    return new OpenAICompatibleChatLanguageModel(
      modelId,
      getCommonModelConfig('chat'),
    );
  };

  const createCompletionModel = (modelId: TogetherAICompletionModelId) =>
    new OpenAICompatibleCompletionLanguageModel(
      modelId,
      getCommonModelConfig('completion'),
    );

  const createEmbeddingModel = (modelId: TogetherAIEmbeddingModelId) =>
    new OpenAICompatibleEmbeddingModel(
      modelId,
      getCommonModelConfig('embedding'),
    );

  const createImageModel = (modelId: TogetherAIImageModelId) =>
    new TogetherAIImageModel(modelId, {
      ...getCommonModelConfig('image'),
      baseURL: baseURL ?? 'https://api.together.xyz/v1/',
    });

  const createRerankingModel = (modelId: TogetherAIRerankingModelId) =>
    new TogetherAIRerankingModel(modelId, {
      ...getCommonModelConfig('reranking'),
      baseURL: baseURL ?? 'https://api.together.xyz/v1/',
    });

  const provider = (modelId: TogetherAIChatModelId) => createChatModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.completionModel = createCompletionModel;
  provider.languageModel = createChatModel;
  provider.chatModel = createChatModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.reranking = createRerankingModel;
  provider.rerankingModel = createRerankingModel;

  return provider;
}

export const togetherai = createTogetherAI();
