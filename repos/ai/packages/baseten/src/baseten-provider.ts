import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleEmbeddingModel,
  type ProviderErrorStructure,
} from '@ai-sdk/openai-compatible';
import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { BasetenChatModelId } from './baseten-chat-options';
import type { BasetenEmbeddingModelId } from './baseten-embedding-options';
import { PerformanceClient } from '@basetenlabs/performance-client';
import { VERSION } from './version';

export type BasetenErrorData = z.infer<typeof basetenErrorSchema>;

const basetenErrorSchema = z.object({
  error: z.string(),
});

const basetenErrorStructure: ProviderErrorStructure<BasetenErrorData> = {
  errorSchema: basetenErrorSchema,
  errorToMessage: data => data.error,
};

export interface BasetenProviderSettings {
  /**
   * Baseten API key. Default value is taken from the `BASETEN_API_KEY`
   * environment variable.
   */
  apiKey?: string;

  /**
   * Base URL for the Model APIs. Default: 'https://inference.baseten.co/v1'
   */
  baseURL?: string;

  /**
   * Model URL for custom models (chat or embeddings).
   * If not supplied, the default Model APIs will be used.
   */
  modelURL?: string;
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

export interface BasetenProvider extends ProviderV4 {
  /**
   * Creates a chat model for text generation.
   */
  (modelId?: BasetenChatModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  chatModel(modelId?: BasetenChatModelId): LanguageModelV4;

  /**
   * Creates a language model for text generation. Alias for chatModel.
   */
  languageModel(modelId?: BasetenChatModelId): LanguageModelV4;

  /**
   * Creates a embedding model for text generation.
   */
  embeddingModel(modelId?: BasetenEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId?: BasetenEmbeddingModelId): EmbeddingModelV4;
}

// by default, we use the Model APIs
const defaultBaseURL = 'https://inference.baseten.co/v1';

export function createBaseten(
  options: BasetenProviderSettings = {},
): BasetenProvider {
  const baseURL = withoutTrailingSlash(options.baseURL ?? defaultBaseURL);
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'BASETEN_API_KEY',
          description: 'Baseten API key',
        })}`,
        ...options.headers,
      },
      `ai-sdk/baseten/${VERSION}`,
    );

  interface CommonModelConfig {
    provider: string;
    url: ({ path }: { path: string }) => string;
    headers: () => Record<string, string>;
    fetch?: FetchFunction;
  }

  const getCommonModelConfig = (
    modelType: string,
    customURL?: string,
  ): CommonModelConfig => ({
    provider: `baseten.${modelType}`,
    url: ({ path }) => {
      // For embeddings with /sync URLs (but not /sync/v1), we need to add /v1
      if (
        modelType === 'embedding' &&
        customURL?.includes('/sync') &&
        !customURL?.includes('/sync/v1')
      ) {
        return `${customURL}/v1${path}`;
      }
      return `${customURL || baseURL}${path}`;
    },
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createChatModel = (modelId?: BasetenChatModelId) => {
    // Use modelURL if provided, otherwise use default Model APIs
    const customURL = options.modelURL;

    if (customURL) {
      // Check if this is a /sync/v1 endpoint (OpenAI-compatible) or /predict endpoint (custom)
      const isOpenAICompatible = customURL.includes('/sync/v1');

      if (isOpenAICompatible) {
        // For /sync/v1 endpoints, use standard OpenAI-compatible format
        return new OpenAICompatibleChatLanguageModel(modelId ?? 'placeholder', {
          ...getCommonModelConfig('chat', customURL),
          errorStructure: basetenErrorStructure,
        });
      } else if (customURL.includes('/predict')) {
        throw new Error(
          'Not supported. You must use a /sync/v1 endpoint for chat models.',
        );
      }
    }

    // Use default OpenAI-compatible format for Model APIs
    return new OpenAICompatibleChatLanguageModel(modelId ?? 'chat', {
      ...getCommonModelConfig('chat'),
      errorStructure: basetenErrorStructure,
    });
  };

  const createEmbeddingModel = (modelId?: BasetenEmbeddingModelId) => {
    // Use modelURL if provided
    const customURL = options.modelURL;
    if (!customURL) {
      throw new Error(
        'No model URL provided for embeddings. Please set modelURL option for embeddings.',
      );
    }

    // Check if this is a /sync or /sync/v1 endpoint (OpenAI-compatible)
    // We support both /sync and /sync/v1, stripping /v1 before passing to Performance Client, as Performance Client adds /v1 itself
    const isOpenAICompatible = customURL.includes('/sync');

    if (isOpenAICompatible) {
      // Create the model using OpenAICompatibleEmbeddingModel and override doEmbed
      const model = new OpenAICompatibleEmbeddingModel(
        modelId ?? 'embeddings',
        {
          ...getCommonModelConfig('embedding', customURL),
          errorStructure: basetenErrorStructure,
        },
      );

      // Strip /v1 from URL if present before passing to Performance Client to avoid double /v1
      const performanceClientURL = customURL.replace('/sync/v1', '/sync');

      // Initialize the B10 Performance Client once for reuse
      const performanceClient = new PerformanceClient(
        performanceClientURL,
        loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'BASETEN_API_KEY',
          description: 'Baseten API key',
        }),
      );

      // Override the doEmbed method to use the pre-created Performance Client
      model.doEmbed = async params => {
        if (!params.values || !Array.isArray(params.values)) {
          throw new Error('params.values must be an array of strings');
        }

        // Performance Client handles batching internally, so we don't need to limit in 128 here
        const response = await performanceClient.embed(
          params.values,
          modelId ?? 'embeddings', // model_id is for Model APIs, we don't use it here for dedicated
        );
        // Transform the response to match the expected format
        const embeddings = response.data.map((item: any) => item.embedding);

        return {
          embeddings,
          usage: response.usage
            ? { tokens: response.usage.total_tokens }
            : undefined,
          response: { headers: {}, body: response },
          warnings: [],
        };
      };

      return model;
    } else {
      throw new Error(
        'Not supported. You must use a /sync or /sync/v1 endpoint for embeddings.',
      );
    }
  };

  const provider = (modelId?: BasetenChatModelId) => createChatModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.chatModel = createChatModel;
  provider.languageModel = createChatModel;
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  return provider;
}

export const baseten = createBaseten();
