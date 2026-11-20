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
import { z } from 'zod/v4';
import { MoonshotAIChatLanguageModel } from './moonshotai-chat-language-model';
import type { MoonshotAIChatModelId } from './moonshotai-chat-options';
import { VERSION } from './version';

export type MoonshotAIErrorData = z.infer<typeof moonshotaiErrorSchema>;

const moonshotaiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().nullish(),
  }),
});

const moonshotaiErrorStructure: ProviderErrorStructure<MoonshotAIErrorData> = {
  errorSchema: moonshotaiErrorSchema,
  errorToMessage: data => data.error.message,
};

export interface MoonshotAIProviderSettings {
  /**
   * Moonshot API key. Default value is taken from the `MOONSHOT_API_KEY`
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

export interface MoonshotAIProvider extends ProviderV4 {
  /**
   * Creates a model for text generation.
   */
  (modelId: MoonshotAIChatModelId): LanguageModelV4;

  /**
   * Creates a chat model for text generation.
   */
  chatModel(modelId: MoonshotAIChatModelId): LanguageModelV4;

  /**
   * Creates a language model for text generation.
   */
  languageModel(modelId: MoonshotAIChatModelId): LanguageModelV4;
}

const defaultBaseURL = 'https://api.moonshot.ai/v1';

export function getModelStructuredOutputSupport(
  modelId: MoonshotAIChatModelId,
): boolean {
  if (modelId.startsWith('kimi-k')) return true;
  return false;
}

export function createMoonshotAI(
  options: MoonshotAIProviderSettings = {},
): MoonshotAIProvider {
  const baseURL = withoutTrailingSlash(options.baseURL ?? defaultBaseURL);
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'MOONSHOT_API_KEY',
          description: 'Moonshot API key',
        })}`,
        ...options.headers,
      },
      `ai-sdk/moonshotai/${VERSION}`,
    );

  interface CommonModelConfig {
    provider: string;
    url: ({ path }: { path: string }) => string;
    headers: () => Record<string, string>;
    fetch?: FetchFunction;
  }

  const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
    provider: `moonshotai.${modelType}`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createChatModel = (modelId: MoonshotAIChatModelId) => {
    return new MoonshotAIChatLanguageModel(modelId, {
      ...getCommonModelConfig('chat'),
      includeUsage: true,
      errorStructure: moonshotaiErrorStructure,
      supportsStructuredOutputs: getModelStructuredOutputSupport(modelId),
      transformRequestBody: (args: Record<string, any>) => {
        const thinking = args.thinking as
          | { type?: string; budgetTokens?: number }
          | undefined;
        const reasoningHistory = args.reasoningHistory as string | undefined;

        const { thinking: _, reasoningHistory: __, ...rest } = args;

        const schema = rest.response_format?.json_schema?.schema;
        if (schema != null) {
          // kimi-k2.5 produces nonsensical output when the top-level `$schema`
          // keyword injected by the AI SDK is present, even though it otherwise
          // supports structured outputs. Strip it from the schema sent to
          // Moonshot; the full original schema is still used for result validation.
          const { $schema: _$schema, ...schemaWithoutDollarSchema } = schema;
          rest.response_format = {
            ...rest.response_format,
            json_schema: {
              ...rest.response_format.json_schema,
              schema: schemaWithoutDollarSchema,
            },
          };
        }

        return {
          ...rest,
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

  const provider = (modelId: MoonshotAIChatModelId) => createChatModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.chatModel = createChatModel;
  provider.languageModel = createChatModel;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

export const moonshotai = createMoonshotAI();
