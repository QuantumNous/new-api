import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
  type ProviderErrorStructure,
} from '@ai-sdk/openai-compatible';
import type {
  EmbeddingModelV4,
  ImageModelV4,
  LanguageModelV4,
  ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { FireworksChatModelId } from './fireworks-chat-options';
import type { FireworksCompletionModelId } from './fireworks-completion-options';
import type { FireworksEmbeddingModelId } from './fireworks-embedding-options';
import { FireworksImageModel } from './fireworks-image-model';
import type { FireworksImageModelId } from './fireworks-image-options';
import { VERSION } from './version';

export type FireworksErrorData = z.infer<typeof fireworksErrorSchema>;

const fireworksErrorSchema = z.object({
  error: z.string(),
});

const fireworksErrorStructure: ProviderErrorStructure<FireworksErrorData> = {
  errorSchema: fireworksErrorSchema,
  errorToMessage: data => data.error,
};

export interface FireworksProviderSettings {
  /**
   * Fireworks API key. Default value is taken from the `FIREWORKS_API_KEY`
   * environment variable.
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

export interface FireworksProvider extends ProviderV4 {
  /**
   * Creates a model for text generation.
   */
  (modelId: FireworksChatModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  chatModel(modelId: FireworksChatModelId): LanguageModelV4;

  /**
   * Creates a completion model for text generation.
   */
  completionModel(modelId: FireworksCompletionModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  languageModel(modelId: FireworksChatModelId): LanguageModelV4;

  /**
   * Creates a text embedding model for text generation.
   */
  embeddingModel(modelId: FireworksEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: FireworksEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for image generation.
   */
  image(modelId: FireworksImageModelId): ImageModelV4;

  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: FireworksImageModelId): ImageModelV4;
}

const defaultBaseURL = 'https://api.fireworks.ai/inference/v1';

export function createFireworks(
  options: FireworksProviderSettings = {},
): FireworksProvider {
  const baseURL = withoutTrailingSlash(options.baseURL ?? defaultBaseURL);
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'FIREWORKS_API_KEY',
          description: 'Fireworks API key',
        })}`,
        ...options.headers,
      },
      `ai-sdk/fireworks/${VERSION}`,
    );

  interface CommonModelConfig {
    provider: string;
    url: ({ path }: { path: string }) => string;
    headers: () => Record<string, string>;
    fetch?: FetchFunction;
  }

  const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
    provider: `fireworks.${modelType}`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createChatModel = (modelId: FireworksChatModelId) => {
    return new OpenAICompatibleChatLanguageModel(modelId, {
      ...getCommonModelConfig('chat'),
      includeUsage: true,
      errorStructure: fireworksErrorStructure,
      transformRequestBody: args => {
        const thinking = args.thinking as
          | { type?: string; budgetTokens?: number }
          | undefined;
        const reasoningHistory = args.reasoningHistory as string | undefined;
        const promptCacheKey = args.promptCacheKey as string | undefined;
        const serviceTier = args.serviceTier as string | undefined;

        const {
          thinking: _,
          reasoningHistory: __,
          promptCacheKey: ___,
          serviceTier: ____,
          reasoning_effort,
          ...rest
        } = args;

        return {
          ...rest,
          ...(reasoning_effort != null && {
            // Workaround since OpenAI spec allows for 5 reasoning levels, but Fireworks only supports 3 of them.
            reasoning_effort:
              reasoning_effort === 'minimal'
                ? 'low'
                : reasoning_effort === 'xhigh'
                  ? 'high'
                  : reasoning_effort,
          }),
          ...(promptCacheKey !== undefined && {
            prompt_cache_key: promptCacheKey,
          }),
          ...(serviceTier !== undefined && {
            service_tier: serviceTier,
          }),
          ...(thinking && {
            thinking: {
              type: thinking.type,
              ...(thinking.budgetTokens !== undefined && {
                budget_tokens: thinking.budgetTokens,
              }),
            },
          }),
          ...(reasoningHistory && {
            reasoning_history: reasoningHistory,
          }),
        };
      },
    });
  };

  const createCompletionModel = (modelId: FireworksCompletionModelId) =>
    new OpenAICompatibleCompletionLanguageModel(modelId, {
      ...getCommonModelConfig('completion'),
      includeUsage: true,
      errorStructure: fireworksErrorStructure,
    });

  const createEmbeddingModel = (modelId: FireworksEmbeddingModelId) =>
    new OpenAICompatibleEmbeddingModel(modelId, {
      ...getCommonModelConfig('embedding'),
      errorStructure: fireworksErrorStructure,
    });

  const createImageModel = (modelId: FireworksImageModelId) =>
    new FireworksImageModel(modelId, {
      ...getCommonModelConfig('image'),
      baseURL: baseURL ?? defaultBaseURL,
    });

  const provider = (modelId: FireworksChatModelId) => createChatModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.completionModel = createCompletionModel;
  provider.chatModel = createChatModel;
  provider.languageModel = createChatModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  return provider;
}

export const fireworks = createFireworks();
