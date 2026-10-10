import type { ProviderErrorStructure } from '@ai-sdk/openai-compatible';
import {
  NoSuchModelError,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { CerebrasChatLanguageModel } from './cerebras-chat-language-model';
import type { CerebrasChatModelId } from './cerebras-chat-options';
import { z } from 'zod/v4';
import { VERSION } from './version';

// Add error schema and structure
const cerebrasErrorSchema = z.object({
  message: z.string(),
  type: z.string(),
  param: z.string(),
  code: z.string(),
});

export type CerebrasErrorData = z.infer<typeof cerebrasErrorSchema>;

const cerebrasErrorStructure: ProviderErrorStructure<CerebrasErrorData> = {
  errorSchema: cerebrasErrorSchema,
  errorToMessage: data => data.message,
};

/**
 * Cerebras expects assistant reasoning history in the `reasoning` field, while
 * the shared OpenAI-compatible converter serializes it as `reasoning_content`.
 */
function transformCerebrasRequestBody(
  args: Record<string, any>,
): Record<string, any> {
  return {
    ...args,
    messages: Array.isArray(args.messages)
      ? args.messages.map(message => {
          if (
            message == null ||
            typeof message !== 'object' ||
            message.role !== 'assistant' ||
            !('reasoning_content' in message)
          ) {
            return message;
          }

          const { reasoning_content, ...rest } = message;

          return {
            ...rest,
            ...(!('reasoning' in rest) && reasoning_content !== undefined
              ? { reasoning: reasoning_content }
              : {}),
          };
        })
      : args.messages,
  };
}

export interface CerebrasProviderSettings {
  /**
   * Cerebras API key.
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

export interface CerebrasProvider extends ProviderV4 {
  /**
   * Creates a Cerebras model for text generation.
   */
  (modelId: CerebrasChatModelId): LanguageModelV4;

  /**
   * Creates a Cerebras model for text generation.
   */
  languageModel(modelId: CerebrasChatModelId): LanguageModelV4;

  /**
   * Creates a Cerebras chat model for text generation.
   */
  chat(modelId: CerebrasChatModelId): LanguageModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export function createCerebras(
  options: CerebrasProviderSettings = {},
): CerebrasProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://api.cerebras.ai/v1',
  );
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'CEREBRAS_API_KEY',
          description: 'Cerebras API key',
        })}`,
        ...options.headers,
      },
      `ai-sdk/cerebras/${VERSION}`,
    );

  const createLanguageModel = (modelId: CerebrasChatModelId) => {
    return new CerebrasChatLanguageModel(modelId, {
      provider: `cerebras.chat`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      errorStructure: cerebrasErrorStructure,
      supportsStructuredOutputs: true,
      transformRequestBody: transformCerebrasRequestBody,
    });
  };

  const provider = (modelId: CerebrasChatModelId) =>
    createLanguageModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createLanguageModel;
  provider.chat = createLanguageModel;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };
  provider.textEmbeddingModel = provider.embeddingModel;
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

export const cerebras = createCerebras();
