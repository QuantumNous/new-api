import {
  NoSuchModelError,
  type ImageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { LumaImageModel } from './luma-image-model';
import type { LumaImageModelId } from './luma-image-settings';
import { VERSION } from './version';

export interface LumaProviderSettings {
  /**
   * Luma API key. Default value is taken from the `LUMA_API_KEY` environment
   * variable.
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

export interface LumaProvider extends ProviderV4 {
  /**
   * Creates a model for image generation.
   */
  image(modelId: LumaImageModelId): ImageModelV4;

  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: LumaImageModelId): ImageModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

const defaultBaseURL = 'https://api.lumalabs.ai';

export function createLuma(options: LumaProviderSettings = {}): LumaProvider {
  const baseURL = withoutTrailingSlash(options.baseURL ?? defaultBaseURL);
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'LUMA_API_KEY',
          description: 'Luma',
        })}`,
        ...options.headers,
      },
      `ai-sdk/luma/${VERSION}`,
    );

  const createImageModel = (modelId: LumaImageModelId) =>
    new LumaImageModel(modelId, {
      provider: 'luma.image',
      baseURL: baseURL ?? defaultBaseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
    });
  };

  return {
    specificationVersion: 'v4' as const,
    image: createImageModel,
    imageModel: createImageModel,
    languageModel: (modelId: string) => {
      throw new NoSuchModelError({
        modelId,
        modelType: 'languageModel',
      });
    },
    embeddingModel,
    textEmbeddingModel: embeddingModel,
  };
}

export const luma = createLuma();
