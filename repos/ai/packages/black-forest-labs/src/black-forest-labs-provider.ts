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
import { BlackForestLabsImageModel } from './black-forest-labs-image-model';
import type { BlackForestLabsImageModelId } from './black-forest-labs-image-settings';
import { VERSION } from './version';

export interface BlackForestLabsProviderSettings {
  /**
   * Black Forest Labs API key. Default value is taken from the `BFL_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Base URL for the API calls. Defaults to `https://api.bfl.ai/v1`.
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

  /**
   * Poll interval in milliseconds between status checks. Defaults to 500ms.
   */
  pollIntervalMillis?: number;

  /**
   * Overall timeout in milliseconds for polling before giving up. Defaults to 60s.
   */
  pollTimeoutMillis?: number;
}

export interface BlackForestLabsProvider extends ProviderV4 {
  /**
   * Creates a model for image generation.
   */
  image(modelId: BlackForestLabsImageModelId): ImageModelV4;

  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: BlackForestLabsImageModelId): ImageModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

const defaultBaseURL = 'https://api.bfl.ai/v1';

export function createBlackForestLabs(
  options: BlackForestLabsProviderSettings = {},
): BlackForestLabsProvider {
  const baseURL = withoutTrailingSlash(options.baseURL ?? defaultBaseURL);
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        'x-key': loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'BFL_API_KEY',
          description: 'Black Forest Labs',
        }),
        ...options.headers,
      },
      `ai-sdk/black-forest-labs/${VERSION}`,
    );

  const createImageModel = (modelId: BlackForestLabsImageModelId) =>
    new BlackForestLabsImageModel(modelId, {
      provider: 'black-forest-labs.image',
      baseURL: baseURL ?? defaultBaseURL,
      headers: getHeaders,
      fetch: options.fetch,
      pollIntervalMillis: options.pollIntervalMillis,
      pollTimeoutMillis: options.pollTimeoutMillis,
    });

  const embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
    });
  };

  return {
    specificationVersion: 'v4',
    imageModel: createImageModel,
    image: createImageModel,
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

export const blackForestLabs = createBlackForestLabs();
