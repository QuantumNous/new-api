import {
  NoSuchModelError,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadOptionalSetting,
  loadSetting,
  resolve,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import {
  anthropicTools,
  AnthropicLanguageModel,
} from '@ai-sdk/anthropic/internal';
import {
  createApiKeyFetchFunction,
  createSigV4FetchFunction,
  type AmazonBedrockCredentials,
} from '../amazon-bedrock-sigv4-fetch';
import { createAmazonBedrockAnthropicFetch } from './amazon-bedrock-anthropic-fetch';
import type { AmazonBedrockAnthropicModelId } from './amazon-bedrock-anthropic-options';
import { VERSION } from '../version';

// Bedrock requires newer tool versions than the default Anthropic SDK versions
const BEDROCK_TOOL_VERSION_MAP = {
  bash_20241022: 'bash_20250124',
  text_editor_20241022: 'text_editor_20250728',
  computer_20241022: 'computer_20250124',
} as const;

// Tool name mappings when upgrading versions (text_editor_20250728 requires different name)
const BEDROCK_TOOL_NAME_MAP: Record<string, string> = {
  text_editor_20250728: 'str_replace_based_edit_tool',
};

// Map tool types to required anthropic_beta values for Bedrock
const BEDROCK_TOOL_BETA_MAP: Record<string, string> = {
  bash_20250124: 'computer-use-2025-01-24',
  bash_20241022: 'computer-use-2024-10-22',
  text_editor_20250124: 'computer-use-2025-01-24',
  text_editor_20241022: 'computer-use-2024-10-22',
  text_editor_20250429: 'computer-use-2025-01-24',
  text_editor_20250728: 'computer-use-2025-01-24',
  computer_20250124: 'computer-use-2025-01-24',
  computer_20241022: 'computer-use-2024-10-22',
  tool_search_tool_regex_20251119: 'tool-search-tool-2025-10-19',
  // BM25 is not currently supported on Bedrock, but including the beta flag
  // so that Bedrock returns a more useful error message if it's used.
  tool_search_tool_bm25_20251119: 'tool-search-tool-2025-10-19',
};

export interface AmazonBedrockAnthropicProvider extends ProviderV4 {
  /**
   * Creates a model for text generation.
   */
  (modelId: AmazonBedrockAnthropicModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  languageModel(modelId: AmazonBedrockAnthropicModelId): LanguageModelV4;

  /**
   * Anthropic-specific computer use tool.
   */
  tools: typeof anthropicTools;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface AmazonBedrockAnthropicProviderSettings {
  /**
   * The AWS region to use for the Bedrock provider. Defaults to the value of the
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
   * The AWS access key ID to use for the Bedrock provider. Defaults to the value of the
   * `AWS_ACCESS_KEY_ID` environment variable.
   */
  accessKeyId?: string;

  /**
   * The AWS secret access key to use for the Bedrock provider. Defaults to the value of the
   * `AWS_SECRET_ACCESS_KEY` environment variable.
   */
  secretAccessKey?: string;

  /**
   * The AWS session token to use for the Bedrock provider. Defaults to the value of the
   * `AWS_SESSION_TOKEN` environment variable.
   */
  sessionToken?: string;

  /**
   * Base URL for the Bedrock API calls.
   */
  baseURL?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Resolvable<Record<string, string | undefined>>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  /**
   * The AWS credential provider to use for the Bedrock provider to get dynamic
   * credentials similar to the AWS SDK. Setting a provider here will cause its
   * credential values to be used instead of the `accessKeyId`, `secretAccessKey`,
   * and `sessionToken` settings.
   */
  credentialProvider?: () => PromiseLike<
    Omit<AmazonBedrockCredentials, 'region'>
  >;
}

/**
 * Create an Amazon Bedrock Anthropic provider instance.
 * This provider uses the native Anthropic API through Bedrock's InvokeModel endpoint,
 * bypassing the Converse API for better feature compatibility.
 */
export function createAmazonBedrockAnthropic(
  options: AmazonBedrockAnthropicProviderSettings = {},
): AmazonBedrockAnthropicProvider {
  // Check for API key authentication first
  const rawApiKey = loadOptionalSetting({
    settingValue: options.apiKey,
    environmentVariableName: 'AWS_BEARER_TOKEN_BEDROCK',
  });

  // Only use API key if it's a non-empty, non-whitespace string
  const apiKey =
    rawApiKey && rawApiKey.trim().length > 0 ? rawApiKey.trim() : undefined;

  // Use API key authentication if available, otherwise fall back to SigV4
  const baseFetchFunction = apiKey
    ? createApiKeyFetchFunction(apiKey, options.fetch)
    : createSigV4FetchFunction(async () => {
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
      }, options.fetch);

  // Wrap with Bedrock event stream to SSE transformer for streaming support
  const fetchFunction = createAmazonBedrockAnthropicFetch(baseFetchFunction);

  const getBaseURL = (): string =>
    withoutTrailingSlash(
      options.baseURL ??
        `https://bedrock-runtime.${loadSetting({
          settingValue: options.region,
          settingName: 'region',
          environmentVariableName: 'AWS_REGION',
          description: 'AWS region',
        })}.amazonaws.com`,
    ) ?? 'https://bedrock-runtime.us-east-1.amazonaws.com';

  const getHeaders = async () => {
    const baseHeaders = (await resolve(options.headers)) ?? {};
    return withUserAgentSuffix(baseHeaders, `ai-sdk/amazon-bedrock/${VERSION}`);
  };

  const createChatModel = (modelId: AmazonBedrockAnthropicModelId) =>
    new AnthropicLanguageModel(modelId, {
      provider: 'bedrock.anthropic.messages',
      baseURL: getBaseURL(),
      headers: getHeaders,
      fetch: fetchFunction,

      buildRequestUrl: (baseURL, isStreaming) =>
        `${baseURL}/model/${encodeURIComponent(modelId)}/${
          isStreaming ? 'invoke-with-response-stream' : 'invoke'
        }`,

      transformRequestBody: (args, betas) => {
        const {
          model: _model,
          stream: _stream,
          tool_choice,
          tools,
          ...rest
        } = args;

        const transformedToolChoice =
          tool_choice != null
            ? {
                type: tool_choice.type,
                ...(tool_choice.name != null ? { name: tool_choice.name } : {}),
              }
            : undefined;

        const requiredBetas = new Set<string>(betas);
        const transformedTools = tools?.map(
          (rawTool: Record<string, unknown>) => {
            // Bedrock rejects the per-tool eager_input_streaming field even when
            // the fine-grained-tool-streaming beta is declared, but the beta alone
            // enables the same behavior, so translate the field into the beta
            const { eager_input_streaming: eagerInputStreaming, ...tool } =
              rawTool;
            if (eagerInputStreaming === true) {
              requiredBetas.add('fine-grained-tool-streaming-2025-05-14');
            }

            const toolType = tool.type as string | undefined;

            if (toolType && toolType in BEDROCK_TOOL_VERSION_MAP) {
              const newType =
                BEDROCK_TOOL_VERSION_MAP[
                  toolType as keyof typeof BEDROCK_TOOL_VERSION_MAP
                ];
              if (newType in BEDROCK_TOOL_BETA_MAP) {
                requiredBetas.add(BEDROCK_TOOL_BETA_MAP[newType]);
              }
              const newName =
                newType in BEDROCK_TOOL_NAME_MAP
                  ? BEDROCK_TOOL_NAME_MAP[newType]
                  : tool.name;
              return {
                ...tool,
                type: newType,
                name: newName,
              };
            }

            if (toolType && toolType in BEDROCK_TOOL_BETA_MAP) {
              requiredBetas.add(BEDROCK_TOOL_BETA_MAP[toolType]);
            }

            if (toolType && toolType in BEDROCK_TOOL_NAME_MAP) {
              return {
                ...tool,
                name: BEDROCK_TOOL_NAME_MAP[toolType],
              };
            }

            return tool;
          },
        );

        return {
          ...rest,
          ...(transformedTools != null ? { tools: transformedTools } : {}),
          ...(transformedToolChoice != null
            ? { tool_choice: transformedToolChoice }
            : {}),
          ...(requiredBetas.size > 0
            ? { anthropic_beta: Array.from(requiredBetas) }
            : {}),
          anthropic_version: 'bedrock-2023-05-31',
        };
      },

      // Bedrock Anthropic doesn't support URL sources, force download and base64 conversion
      supportedUrls: () => ({}),
      // native structured output via output_config.format is supported on Bedrock
      // Bedrock rejects `output_config.format` for `claude-opus-4-7`, `claude-opus-4-8`, `claude-fable-5`, and `claude-sonnet-5`
      supportsNativeStructuredOutput:
        !modelId.includes('claude-opus-4-7') &&
        !modelId.includes('claude-opus-4-8') &&
        !modelId.includes('claude-fable-5') &&
        !modelId.includes('claude-sonnet-5'),
    });

  const provider = function (modelId: AmazonBedrockAnthropicModelId) {
    if (new.target) {
      throw new Error(
        'The Bedrock Anthropic model function cannot be called with the new keyword.',
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

  provider.tools = anthropicTools;

  return provider;
}

/**
 * Default Bedrock Anthropic provider instance.
 */
export const amazonBedrockAnthropic = createAmazonBedrockAnthropic();
