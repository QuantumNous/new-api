import {
  NoSuchModelError,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  generateId,
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { PerplexityLanguageModel } from './perplexity-language-model';
import type { PerplexityLanguageModelId } from './perplexity-options';
import { VERSION } from './version';

export interface PerplexityProvider extends ProviderV4 {
  /**
   * Creates an Perplexity chat model for text generation.
   */
  (modelId: PerplexityLanguageModelId): LanguageModelV4;

  /**
   * Creates an Perplexity language model for text generation.
   */
  languageModel(modelId: PerplexityLanguageModelId): LanguageModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface PerplexityProviderSettings {
  /**
   * Base URL for the perplexity API calls.
   */
  baseURL?: string;

  /**
   * API key for authenticating requests.
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
}

export function createPerplexity(
  options: PerplexityProviderSettings = {},
): PerplexityProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'PERPLEXITY_API_KEY',
          description: 'Perplexity',
        })}`,
        ...options.headers,
      },
      `ai-sdk/perplexity/${VERSION}`,
    );

  const createLanguageModel = (modelId: PerplexityLanguageModelId) => {
    return new PerplexityLanguageModel(modelId, {
      baseURL: withoutTrailingSlash(
        options.baseURL ?? 'https://api.perplexity.ai',
      )!,
      headers: getHeaders,
      generateId,
      fetch: options.fetch,
    });
  };

  const provider = (modelId: PerplexityLanguageModelId) =>
    createLanguageModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createLanguageModel;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };
  provider.textEmbeddingModel = provider.embeddingModel;
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

export const perplexity = createPerplexity();
