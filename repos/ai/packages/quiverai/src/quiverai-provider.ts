import {
  NoSuchModelError,
  type ImageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  loadOptionalSetting,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { QuiverAIImageModel } from './quiverai-image-model';
import type { QuiverAIImageModelId } from './quiverai-image-settings';
import { VERSION } from './version';

export interface QuiverAIProviderSettings {
  /**
   * QuiverAI API key. Default value is taken from the `QUIVERAI_API_KEY`
   * environment variable.
   */
  apiKey?: string;

  /**
   * Base URL for the API calls. Defaults to `https://api.quiver.ai/v1` and
   * falls back to the `QUIVERAI_BASE_URL` environment variable.
   */
  baseURL?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept
   * requests, or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;
}

export interface QuiverAIProvider extends ProviderV4 {
  /**
   * Creates a model for image generation.
   */
  image(modelId: QuiverAIImageModelId): ImageModelV4;

  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: QuiverAIImageModelId): ImageModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

const defaultBaseURL = 'https://api.quiver.ai/v1';

export function createQuiverAI(
  options: QuiverAIProviderSettings = {},
): QuiverAIProvider {
  const baseURL =
    withoutTrailingSlash(
      loadOptionalSetting({
        settingValue: options.baseURL,
        environmentVariableName: 'QUIVERAI_BASE_URL',
      }),
    ) ?? defaultBaseURL;

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'QUIVERAI_API_KEY',
          description: 'QuiverAI',
        })}`,
        ...options.headers,
      },
      `ai-sdk/quiverai/${VERSION}`,
    );

  const createImageModel = (modelId: QuiverAIImageModelId) =>
    new QuiverAIImageModel(modelId, {
      provider: 'quiverai.image',
      baseURL,
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
    specificationVersion: 'v4',
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

export const quiverai = createQuiverAI();
