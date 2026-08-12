import {
  NoSuchModelError,
  type Experimental_VideoModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { ReplicateImageModel } from './replicate-image-model';
import type { ReplicateImageModelId } from './replicate-image-settings';
import { ReplicateVideoModel } from './replicate-video-model';
import type { ReplicateVideoModelId } from './replicate-video-settings';
import { VERSION } from './version';

export interface ReplicateProviderSettings {
  /**
   * API token that is being send using the `Authorization` header.
   * It defaults to the `REPLICATE_API_TOKEN` environment variable.
   */
  apiToken?: string;

  /**
   * Use a different URL prefix for API calls, e.g. to use proxy servers.
   * The default prefix is `https://api.replicate.com/v1`.
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

export interface ReplicateProvider extends ProviderV4 {
  /**
   * Creates a Replicate image generation model.
   */
  image(modelId: ReplicateImageModelId): ReplicateImageModel;

  /**
   * Creates a Replicate image generation model.
   */
  imageModel(modelId: ReplicateImageModelId): ReplicateImageModel;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;

  /**
   * Creates a Replicate video generation model.
   */
  video(modelId: ReplicateVideoModelId): Experimental_VideoModelV4;

  /**
   * Creates a Replicate video generation model.
   */
  videoModel(modelId: ReplicateVideoModelId): Experimental_VideoModelV4;
}

/**
 * Create a Replicate provider instance.
 */
export function createReplicate(
  options: ReplicateProviderSettings = {},
): ReplicateProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiToken,
          environmentVariableName: 'REPLICATE_API_TOKEN',
          description: 'Replicate',
        })}`,
        ...options.headers,
      },
      `ai-sdk/replicate/${VERSION}`,
    );

  const createImageModel = (modelId: ReplicateImageModelId) =>
    new ReplicateImageModel(modelId, {
      provider: 'replicate',
      baseURL: options.baseURL ?? 'https://api.replicate.com/v1',
      headers: getHeaders(),
      fetch: options.fetch,
    });

  const createVideoModel = (modelId: ReplicateVideoModelId) =>
    new ReplicateVideoModel(modelId, {
      provider: 'replicate.video',
      baseURL: options.baseURL ?? 'https://api.replicate.com/v1',
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
    video: createVideoModel,
    videoModel: createVideoModel,
  };
}

/**
 * Default Replicate provider instance.
 */
export const replicate = createReplicate();
