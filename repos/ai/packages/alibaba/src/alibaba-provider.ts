import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type Experimental_VideoModelV4,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { AlibabaChatLanguageModel } from './alibaba-chat-language-model';
import type { AlibabaChatModelId } from './alibaba-chat-language-model-options';
import { AlibabaEmbeddingModel } from './alibaba-embedding-model';
import type { AlibabaEmbeddingModelId } from './alibaba-embedding-model-options';
import { AlibabaVideoModel } from './alibaba-video-model';
import type { AlibabaVideoModelId } from './alibaba-video-settings';
import { VERSION } from './version';

export type { AlibabaErrorData } from './alibaba-error';
export { alibabaFailedResponseHandler } from './alibaba-error';

export interface AlibabaProvider extends ProviderV4 {
  (modelId: AlibabaChatModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  languageModel(modelId: AlibabaChatModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  chatModel(modelId: AlibabaChatModelId): LanguageModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embedding(modelId: AlibabaEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embeddingModel(modelId: AlibabaEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for video generation.
   */
  video(modelId: AlibabaVideoModelId): Experimental_VideoModelV4;

  /**
   * Creates a model for video generation.
   */
  videoModel(modelId: AlibabaVideoModelId): Experimental_VideoModelV4;
}

export interface AlibabaProviderSettings {
  /**
   * Use a different URL prefix for API calls, e.g. to use proxy servers or regional endpoints.
   * The default prefix is `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`.
   */
  baseURL?: string;

  /**
   * Use a different URL prefix for video generation API calls.
   * The video API uses the DashScope native endpoint (not the OpenAI-compatible endpoint).
   * The default prefix is `https://dashscope-intl.aliyuncs.com`.
   */
  videoBaseURL?: string;

  /**
   * Use a different URL prefix for embedding API calls.
   * The embedding API uses the DashScope native endpoint (not the OpenAI-compatible endpoint).
   * The default prefix is `https://dashscope-intl.aliyuncs.com/api/v1`.
   */
  embeddingBaseURL?: string;

  /**
   * API key that is being sent using the `Authorization` header.
   * It defaults to the `ALIBABA_API_KEY` environment variable.
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

  /**
   * Include usage information in streaming responses.
   * When enabled, token usage will be included in the final chunk.
   *
   * @default true
   */
  includeUsage?: boolean;
}

/**
 * Create an Alibaba Cloud (Qwen) provider instance.
 */
export function createAlibaba(
  options: AlibabaProviderSettings = {},
): AlibabaProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ??
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

  const videoBaseURL =
    withoutTrailingSlash(options.videoBaseURL) ??
    'https://dashscope-intl.aliyuncs.com';

  const embeddingBaseURL =
    withoutTrailingSlash(options.embeddingBaseURL) ??
    'https://dashscope-intl.aliyuncs.com/api/v1';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'ALIBABA_API_KEY',
          description: 'Alibaba Cloud (DashScope)',
        })}`,
        ...options.headers,
      },
      `ai-sdk/alibaba/${VERSION}`,
    );

  const createLanguageModel = (modelId: AlibabaChatModelId) =>
    new AlibabaChatLanguageModel(modelId, {
      provider: 'alibaba.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      includeUsage: options.includeUsage ?? true,
    });

  const createEmbeddingModel = (modelId: AlibabaEmbeddingModelId) =>
    new AlibabaEmbeddingModel(modelId, {
      provider: 'alibaba.embedding',
      baseURL: embeddingBaseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createVideoModel = (modelId: AlibabaVideoModelId) =>
    new AlibabaVideoModel(modelId, {
      provider: 'alibaba.video',
      baseURL: videoBaseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: AlibabaChatModelId) {
    if (new.target) {
      throw new Error(
        'The Alibaba model function cannot be called with the new keyword.',
      );
    }

    return createLanguageModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createLanguageModel;
  provider.chatModel = createLanguageModel;
  provider.embedding = createEmbeddingModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.video = createVideoModel;
  provider.videoModel = createVideoModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

export const alibaba = createAlibaba();
