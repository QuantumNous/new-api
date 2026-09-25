import {
  NoSuchModelError,
  type FilesV4,
  type LanguageModelV4,
  type ProviderV4,
  type SkillsV4,
} from '@ai-sdk/provider';
import {
  loadOptionalSetting,
  loadSetting,
  withoutTrailingSlash,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import {
  AnthropicFiles,
  AnthropicLanguageModel,
  AnthropicSkills,
  anthropicTools,
  type AnthropicModelId,
} from '@ai-sdk/anthropic/internal';
import {
  createApiKeyFetchFunction,
  createSigV4FetchFunction,
  type AnthropicAwsCredentials,
} from './anthropic-aws-fetch';

export interface AnthropicAwsProvider extends ProviderV4 {
  /**
   * Creates a model for text generation.
   */
  (modelId: AnthropicModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  languageModel(modelId: AnthropicModelId): LanguageModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;

  files(): FilesV4;

  /**
   * Returns a SkillsV4 interface for uploading skills to Anthropic.
   */
  skills(): SkillsV4;

  tools: typeof anthropicTools;
}

export interface AnthropicAwsProviderSettings {
  /**
   * The AWS region to use for Claude Platform on AWS. Defaults to the value of the
   * `AWS_REGION` environment variable. Required — there is no fallback default.
   */
  region?: string;

  /**
   * The Anthropic workspace ID for this AWS account. Sent on every request via the
   * `anthropic-workspace-id` header. Defaults to the value of the
   * `ANTHROPIC_AWS_WORKSPACE_ID` environment variable.
   */
  workspaceId?: string;

  /**
   * API key for authenticating requests via the `x-api-key` header.
   * When provided, this will be used instead of AWS SigV4 authentication.
   * Defaults to the value of the `ANTHROPIC_AWS_API_KEY` environment variable.
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
   * Base URL for the Claude Platform on AWS API calls.
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
   * The AWS credential provider to use to get dynamic credentials similar to the
   * AWS SDK. Setting a provider here will cause its credential values to be used
   * instead of the `accessKeyId`, `secretAccessKey`, and `sessionToken` settings.
   */
  credentialProvider?: () => PromiseLike<
    Omit<AnthropicAwsCredentials, 'region'>
  >;

  generateId?: () => string;
}

/**
 * Create a Claude Platform on AWS provider instance.
 * This provider uses the Anthropic Messages API hosted in AWS, authenticated
 * with AWS SigV4 or an AWS-provisioned API key.
 */
export function createAnthropicAws(
  options: AnthropicAwsProviderSettings = {},
): AnthropicAwsProvider {
  const apiKey = loadOptionalSetting({
    settingValue: options.apiKey,
    environmentVariableName: 'ANTHROPIC_AWS_API_KEY',
  });

  const fetchFunction = apiKey
    ? createApiKeyFetchFunction(apiKey, options.fetch)
    : createSigV4FetchFunction(async () => {
        const region = loadSetting({
          settingValue: options.region,
          settingName: 'region',
          environmentVariableName: 'AWS_REGION',
          description: 'AWS region',
        });

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
                '4. Use API key authentication with ANTHROPIC_AWS_API_KEY or apiKey option\n' +
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
      }, options.fetch);

  const getBaseURL = (): string =>
    withoutTrailingSlash(options.baseURL) ??
    `https://aws-external-anthropic.${loadSetting({
      settingValue: options.region,
      settingName: 'region',
      environmentVariableName: 'AWS_REGION',
      description: 'AWS region',
    })}.api.aws/v1`;

  const getHeaders = (): Record<string, string | undefined> => ({
    'anthropic-version': '2023-06-01',
    'anthropic-workspace-id': loadSetting({
      settingValue: options.workspaceId,
      settingName: 'workspaceId',
      environmentVariableName: 'ANTHROPIC_AWS_WORKSPACE_ID',
      description: 'Anthropic AWS workspace ID',
    }),
    ...options.headers,
  });

  const createChatModel = (modelId: AnthropicModelId) =>
    new AnthropicLanguageModel(modelId, {
      provider: 'anthropic-aws.messages',
      baseURL: getBaseURL(),
      headers: getHeaders,
      fetch: fetchFunction,
      generateId: options.generateId,
      supportedUrls: () => ({
        'image/*': [/^https?:\/\/.*$/],
        'application/pdf': [/^https?:\/\/.*$/],
      }),
    });

  const provider = function (modelId: AnthropicModelId) {
    if (new.target) {
      throw new Error(
        'The Anthropic AWS model function cannot be called with the new keyword.',
      );
    }
    return createChatModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.messages = createChatModel;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };
  provider.textEmbeddingModel = provider.embeddingModel;
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  provider.files = () =>
    new AnthropicFiles({
      provider: 'anthropic-aws.messages',
      baseURL: getBaseURL(),
      headers: getHeaders,
      fetch: fetchFunction,
    });

  provider.skills = () =>
    new AnthropicSkills({
      provider: 'anthropic-aws.skills',
      baseURL: getBaseURL(),
      headers: getHeaders,
      fetch: fetchFunction,
    });

  provider.tools = anthropicTools;

  return provider;
}

/**
 * Default Claude Platform on AWS provider instance.
 */
export const anthropicAws = createAnthropicAws();
