import {
  NoSuchModelError,
  type Experimental_VideoModelV4 as VideoModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { generateKlingAIAuthToken } from './klingai-auth';
import { KlingAIVideoModel } from './klingai-video-model';
import type { KlingAIVideoModelId } from './klingai-video-settings';
import { VERSION } from './version';

export interface KlingAIProviderSettings {
  /**
   * KlingAI Access key. Default value is taken from the `KLINGAI_ACCESS_KEY`
   * environment variable.
   */
  accessKey?: string;
  /**
   * KlingAI Secret key. Default value is taken from the `KLINGAI_SECRET_KEY`
   * environment variable.
   */
  secretKey?: string;
  /**
   * Base URL for the API calls.
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

export interface KlingAIProvider extends ProviderV4 {
  /**
   * Creates a model for video generation.
   */
  video(modelId: KlingAIVideoModelId): VideoModelV4;

  /**
   * Creates a model for video generation.
   */
  videoModel(modelId: KlingAIVideoModelId): VideoModelV4;
}

const defaultBaseURL = 'https://api-singapore.klingai.com';

/**
 * Create a KlingAI provider instance.
 */
export function createKlingAI(
  options: KlingAIProviderSettings = {},
): KlingAIProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL ?? defaultBaseURL) ?? defaultBaseURL;

  const getHeaders = async () => {
    const token = await generateKlingAIAuthToken({
      accessKey: options.accessKey,
      secretKey: options.secretKey,
    });

    return withUserAgentSuffix(
      {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      `ai-sdk/klingai/${VERSION}`,
    );
  };

  const createVideoModel = (modelId: KlingAIVideoModelId): VideoModelV4 =>
    new KlingAIVideoModel(modelId, {
      provider: 'klingai.video',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const noSuchModel = (
    modelId: string,
    modelType:
      | 'languageModel'
      | 'embeddingModel'
      | 'imageModel'
      | 'transcriptionModel'
      | 'speechModel'
      | 'rerankingModel',
  ): never => {
    throw new NoSuchModelError({ modelId, modelType });
  };

  const provider: KlingAIProvider = {
    specificationVersion: 'v4' as const,
    video: createVideoModel,
    videoModel: createVideoModel,
    languageModel: (modelId: string) => noSuchModel(modelId, 'languageModel'),
    embeddingModel: (modelId: string) => noSuchModel(modelId, 'embeddingModel'),
    imageModel: (modelId: string) => noSuchModel(modelId, 'imageModel'),
  };

  return provider;
}

/**
 * Default KlingAI provider instance.
 */
export const klingai = createKlingAI();
