import {
  NoSuchModelError,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  generateId,
  loadApiKey,
  withoutTrailingSlash,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { HuggingFaceResponsesLanguageModel } from './responses/huggingface-responses-language-model';
import type { HuggingFaceResponsesModelId } from './responses/huggingface-responses-settings';

export interface HuggingFaceProviderSettings {
  /**
   * Hugging Face API key.
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

  generateId?: () => string;
}

export interface HuggingFaceProvider extends ProviderV4 {
  /**
   * Creates a Hugging Face responses model for text generation.
   */
  (modelId: HuggingFaceResponsesModelId): LanguageModelV4;

  /**
   * Creates a Hugging Face responses model for text generation.
   */
  languageModel(modelId: HuggingFaceResponsesModelId): LanguageModelV4;

  /**
   * Creates a Hugging Face responses model for text generation.
   */
  responses(modelId: HuggingFaceResponsesModelId): LanguageModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

/**
 * Create a Hugging Face provider instance.
 */
export function createHuggingFace(
  options: HuggingFaceProviderSettings = {},
): HuggingFaceProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ?? 'https://router.huggingface.co/v1';

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'HUGGINGFACE_API_KEY',
      description: 'Hugging Face',
    })}`,
    ...options.headers,
  });

  const createResponsesModel = (modelId: HuggingFaceResponsesModelId) => {
    return new HuggingFaceResponsesLanguageModel(modelId, {
      provider: 'huggingface.responses',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId ?? generateId,
    });
  };

  const provider = (modelId: HuggingFaceResponsesModelId) =>
    createResponsesModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createResponsesModel;
  provider.responses = createResponsesModel;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message:
        'Hugging Face Responses API does not support text embeddings. Use the Hugging Face Inference API directly for embeddings.',
    });
  };
  provider.textEmbeddingModel = provider.embeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message:
        'Hugging Face Responses API does not support image generation. Use the Hugging Face Inference API directly for image models.',
    });
  };

  return provider;
}

/**
 * Default Hugging Face provider instance.
 */
export const huggingFace = createHuggingFace();
