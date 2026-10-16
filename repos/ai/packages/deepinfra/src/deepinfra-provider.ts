import type {
  LanguageModelV4,
  EmbeddingModelV4,
  ProviderV4,
  ImageModelV4,
} from '@ai-sdk/provider';
import {
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
} from '@ai-sdk/openai-compatible';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import type { DeepInfraChatModelId } from './deepinfra-chat-options';
import type { DeepInfraEmbeddingModelId } from './deepinfra-embedding-options';
import type { DeepInfraCompletionModelId } from './deepinfra-completion-options';
import type { DeepInfraImageModelId } from './deepinfra-image-settings';
import { DeepInfraImageModel } from './deepinfra-image-model';
import { DeepInfraChatLanguageModel } from './deepinfra-chat-language-model';
import { VERSION } from './version';

export interface DeepInfraProviderSettings {
  /**
   * DeepInfra API key.
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

export interface DeepInfraProvider extends ProviderV4 {
  /**
   * Creates a model for text generation.
   */
  (modelId: DeepInfraChatModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  chatModel(modelId: DeepInfraChatModelId): LanguageModelV4;

  /**
   * Creates a model for image generation.
   */
  image(modelId: DeepInfraImageModelId): ImageModelV4;

  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: DeepInfraImageModelId): ImageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  languageModel(modelId: DeepInfraChatModelId): LanguageModelV4;

  /**
   * Creates a completion model for text generation.
   */
  completionModel(modelId: DeepInfraCompletionModelId): LanguageModelV4;

  /**
   * Creates a embedding model for text generation.
   */
  embeddingModel(modelId: DeepInfraEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: DeepInfraEmbeddingModelId): EmbeddingModelV4;
}

export function createDeepInfra(
  options: DeepInfraProviderSettings = {},
): DeepInfraProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://api.deepinfra.com/v1',
  );
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'DEEPINFRA_API_KEY',
          description: "DeepInfra's API key",
        })}`,
        ...options.headers,
      },
      `ai-sdk/deepinfra/${VERSION}`,
    );

  interface CommonModelConfig {
    provider: string;
    url: ({ path }: { path: string }) => string;
    headers: () => Record<string, string>;
    fetch?: FetchFunction;
  }

  const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
    provider: `deepinfra.${modelType}`,
    url: ({ path }) => `${baseURL}/openai${path}`,
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createChatModel = (modelId: DeepInfraChatModelId) => {
    return new DeepInfraChatLanguageModel(
      modelId,
      getCommonModelConfig('chat'),
    );
  };

  const createCompletionModel = (modelId: DeepInfraCompletionModelId) =>
    new OpenAICompatibleCompletionLanguageModel(
      modelId,
      getCommonModelConfig('completion'),
    );

  const createEmbeddingModel = (modelId: DeepInfraEmbeddingModelId) =>
    new OpenAICompatibleEmbeddingModel(
      modelId,
      getCommonModelConfig('embedding'),
    );

  const createImageModel = (modelId: DeepInfraImageModelId) =>
    new DeepInfraImageModel(modelId, {
      ...getCommonModelConfig('image'),
      baseURL: baseURL
        ? `${baseURL}/inference`
        : 'https://api.deepinfra.com/v1/inference',
    });

  const provider = (modelId: DeepInfraChatModelId) => createChatModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.completionModel = createCompletionModel;
  provider.chatModel = createChatModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.languageModel = createChatModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;

  return provider;
}

export const deepInfra = createDeepInfra();
