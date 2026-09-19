import {
  OpenAIChatLanguageModel,
  OpenAIResponsesLanguageModel,
} from '@ai-sdk/openai/internal';
import {
  NoSuchModelError,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadOptionalSetting,
  loadSetting,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import {
  createApiKeyFetchFunction,
  createSigV4FetchFunction,
  type AmazonBedrockCredentials,
} from '../amazon-bedrock-sigv4-fetch';
import type {
  BedrockMantleChatModelId,
  BedrockMantleResponsesModelId,
} from './bedrock-mantle-options';
import { VERSION } from '../version';

export interface BedrockMantleProvider extends ProviderV4 {
  /**
   * Creates a model for text generation using the Chat Completions API.
   * Chat Completions has the broadest model support on Mantle.
   */
  (modelId: BedrockMantleChatModelId): LanguageModelV4;

  /**
   * Creates a model for text generation using the Chat Completions API.
   */
  languageModel(modelId: BedrockMantleChatModelId): LanguageModelV4;

  /**
   * Creates a model for text generation using the Chat Completions API.
   */
  chat(modelId: BedrockMantleChatModelId): LanguageModelV4;

  /**
   * Creates a model for text generation using the Responses API.
   * Not all Mantle models support this API. Notably, gpt-oss-safeguard models
   * are Chat-only.
   */
  responses(modelId: BedrockMantleResponsesModelId): LanguageModelV4;

  /**
   * @deprecated Mantle does not support embedding models.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface BedrockMantleProviderSettings {
  /**
   * The AWS region to use for the Bedrock Mantle endpoint. Defaults to the value of the
   * `AWS_REGION` environment variable.
   */
  region?: string;

  /**
   * API key for authenticating requests using Bearer token authentication.
   * When provided, this will be used instead of AWS SigV4 authentication.
   * Defaults to the value of the `AWS_BEARER_TOKEN_BEDROCK` environment variable.
   */
  apiKey?: string;

  /**
   * The AWS access key ID to use for SigV4 authentication. Defaults to the value of the
   * `AWS_ACCESS_KEY_ID` environment variable.
   */
  accessKeyId?: string;

  /**
   * The AWS secret access key to use for SigV4 authentication. Defaults to the value of the
   * `AWS_SECRET_ACCESS_KEY` environment variable.
   */
  secretAccessKey?: string;

  /**
   * The AWS session token to use for SigV4 authentication. Defaults to the value of the
   * `AWS_SESSION_TOKEN` environment variable.
   */
  sessionToken?: string;

  /**
   * Base URL for the Bedrock Mantle API calls.
   */
  baseURL?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string | undefined>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  /**
   * The AWS credential provider to use for SigV4 authentication to get dynamic
   * credentials similar to the AWS SDK. Setting a provider here will cause its
   * credential values to be used instead of the `accessKeyId`, `secretAccessKey`,
   * and `sessionToken` settings.
   */
  credentialProvider?: () => PromiseLike<
    Omit<AmazonBedrockCredentials, 'region'>
  >;
}

/**
 * Create an Amazon Bedrock Mantle provider instance.
 * This provider uses the OpenAI-compatible Mantle API for models that are
 * only available through the Mantle endpoint (e.g. openai.gpt-oss-20b).
 */
export function createBedrockMantle(
  options: BedrockMantleProviderSettings = {},
): BedrockMantleProvider {
  // Check for API key authentication first
  const rawApiKey = loadOptionalSetting({
    settingValue: options.apiKey,
    environmentVariableName: 'AWS_BEARER_TOKEN_BEDROCK',
  });

  // Only use API key if it's a non-empty, non-whitespace string
  const apiKey =
    rawApiKey && rawApiKey.trim().length > 0 ? rawApiKey.trim() : undefined;

  // Use API key authentication if available, otherwise fall back to SigV4
  const fetchFunction = apiKey
    ? createApiKeyFetchFunction(apiKey, options.fetch)
    : createSigV4FetchFunction(
        async () => {
          const region = loadSetting({
            settingValue: options.region,
            settingName: 'region',
            environmentVariableName: 'AWS_REGION',
            description: 'AWS region',
          });

          // If a credential provider is provided, use it to get the credentials.
          if (options.credentialProvider) {
            try {
              return {
                ...(await options.credentialProvider()),
                region,
              };
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              throw new Error(
                `AWS credential provider failed: ${errorMessage}. ` +
                  'Please ensure your credential provider returns valid AWS credentials ' +
                  'with accessKeyId and secretAccessKey properties.',
              );
            }
          }

          try {
            return {
              region,
              accessKeyId: loadSetting({
                settingValue: options.accessKeyId,
                settingName: 'accessKeyId',
                environmentVariableName: 'AWS_ACCESS_KEY_ID',
                description: 'AWS access key ID',
              }),
              secretAccessKey: loadSetting({
                settingValue: options.secretAccessKey,
                settingName: 'secretAccessKey',
                environmentVariableName: 'AWS_SECRET_ACCESS_KEY',
                description: 'AWS secret access key',
              }),
              sessionToken: loadOptionalSetting({
                settingValue: options.sessionToken,
                environmentVariableName: 'AWS_SESSION_TOKEN',
              }),
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            if (
              errorMessage.includes('AWS_ACCESS_KEY_ID') ||
              errorMessage.includes('accessKeyId')
            ) {
              throw new Error(
                'AWS SigV4 authentication requires AWS credentials. Please provide either:\n' +
                  '1. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables\n' +
                  '2. Provide accessKeyId and secretAccessKey in options\n' +
                  '3. Use a credentialProvider function\n' +
                  '4. Use API key authentication with AWS_BEARER_TOKEN_BEDROCK or apiKey option\n' +
                  `Original error: ${errorMessage}`,
              );
            }
            if (
              errorMessage.includes('AWS_SECRET_ACCESS_KEY') ||
              errorMessage.includes('secretAccessKey')
            ) {
              throw new Error(
                'AWS SigV4 authentication requires both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY. ' +
                  'Please ensure both credentials are provided.\n' +
                  `Original error: ${errorMessage}`,
              );
            }
            throw error;
          }
        },
        options.fetch,
        'bedrock-mantle',
      );

  const getBaseURL = (): string =>
    withoutTrailingSlash(
      options.baseURL ??
        `https://bedrock-mantle.${loadSetting({
          settingValue: options.region,
          settingName: 'region',
          environmentVariableName: 'AWS_REGION',
          description: 'AWS region',
        })}.api.aws/v1`,
    ) ?? 'https://bedrock-mantle.us-east-1.api.aws/v1';

  const getHeaders = (): Record<string, string | undefined> =>
    withUserAgentSuffix(
      options.headers ?? {},
      `ai-sdk/amazon-bedrock/${VERSION}`,
    );

  const url = ({ path }: { path: string; modelId: string }): string =>
    `${getBaseURL()}${path}`;

  const createChatModel = (modelId: BedrockMantleChatModelId) =>
    new OpenAIChatLanguageModel(modelId, {
      provider: 'bedrock-mantle.chat',
      url,
      headers: getHeaders,
      fetch: fetchFunction,
    });

  const createResponsesModel = (modelId: BedrockMantleResponsesModelId) =>
    new OpenAIResponsesLanguageModel(modelId, {
      provider: 'bedrock-mantle.responses',
      url,
      headers: getHeaders,
      fetch: fetchFunction,
    });

  const provider = function (modelId: BedrockMantleChatModelId) {
    if (new.target) {
      throw new Error(
        'The Bedrock Mantle model function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.responses = createResponsesModel;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };
  provider.textEmbeddingModel = provider.embeddingModel;
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider as BedrockMantleProvider;
}

/**
 * Default Bedrock Mantle provider instance.
 */
export const bedrockMantle = createBedrockMantle();
