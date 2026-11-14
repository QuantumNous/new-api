import type * as AnthropicModule from '@ai-sdk/anthropic';
import { anthropicTools } from '@ai-sdk/anthropic/internal';
import { loadOptionalSetting } from '@ai-sdk/provider-utils';
import type * as ProviderUtilsModule from '@ai-sdk/provider-utils';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AmazonBedrockChatLanguageModel } from './amazon-bedrock-chat-language-model';
import { AmazonBedrockEmbeddingModel } from './amazon-bedrock-embedding-model';
import { AmazonBedrockImageModel } from './amazon-bedrock-image-model';
import { createAmazonBedrock } from './amazon-bedrock-provider';
import {
  createApiKeyFetchFunction,
  createSigV4FetchFunction,
} from './amazon-bedrock-sigv4-fetch';

// Add type assertions for the mocked classes
const AmazonBedrockChatLanguageModelMock =
  AmazonBedrockChatLanguageModel as unknown as Mock;
const AmazonBedrockEmbeddingModelMock =
  AmazonBedrockEmbeddingModel as unknown as Mock;
const AmazonBedrockImageModelMock = AmazonBedrockImageModel as unknown as Mock;

vi.mock('./amazon-bedrock-chat-language-model', () => ({
  AmazonBedrockChatLanguageModel: vi.fn(),
}));

vi.mock('./amazon-bedrock-embedding-model', () => ({
  AmazonBedrockEmbeddingModel: vi.fn(),
}));

vi.mock('./amazon-bedrock-image-model', () => ({
  AmazonBedrockImageModel: vi.fn(),
}));

vi.mock('./amazon-bedrock-sigv4-fetch', () => ({
  createSigV4FetchFunction: vi.fn(),
  createApiKeyFetchFunction: vi.fn(),
}));

vi.mock('@ai-sdk/anthropic', async importOriginal => {
  const original = await importOriginal<typeof AnthropicModule>();
  return {
    ...original,
    anthropicTools: { mock: 'tools' },
    prepareTools: vi.fn(),
  };
});

vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const original = await importOriginal<typeof ProviderUtilsModule>();
  return {
    ...original,
    loadSetting: vi
      .fn()
      .mockImplementation(({ settingValue }) => settingValue || 'us-east-1'),
    loadOptionalSetting: vi
      .fn()
      .mockImplementation(({ settingValue }) => settingValue),
    withoutTrailingSlash: vi.fn(url => url),
    generateId: vi.fn().mockReturnValue('mock-id'),
    createJsonErrorResponseHandler: vi.fn(),
    createJsonResponseHandler: vi.fn(),
    postJsonToApi: vi.fn(),
    resolve: vi.fn(val => Promise.resolve(val)),
    combineHeaders: vi.fn((...headers) => Object.assign({}, ...headers)),
    parseProviderOptions: vi.fn(),
    asSchema: vi.fn(schema => ({ jsonSchema: schema })),
  };
});

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const mockCreateSigV4FetchFunction = vi.mocked(createSigV4FetchFunction);
const mockCreateApiKeyFetchFunction = vi.mocked(createApiKeyFetchFunction);
const mockLoadOptionalSetting = vi.mocked(loadOptionalSetting);

describe('AmazonBedrockProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockCreateSigV4FetchFunction.mockReturnValue(vi.fn());
    mockCreateApiKeyFetchFunction.mockReturnValue(vi.fn());
    mockLoadOptionalSetting.mockImplementation(
      ({ settingValue }) => settingValue,
    );
  });

  describe('createAmazonBedrock', () => {
    it('should create a provider instance with default options', () => {
      const provider = createAmazonBedrock();
      const model = provider('anthropic.claude-v2');

      const constructorCall = AmazonBedrockChatLanguageModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe('anthropic.claude-v2');
      expect(constructorCall[1].headers()).toMatchObject({});
      expect(constructorCall[1].headers()['user-agent']).toContain(
        'ai-sdk/amazon-bedrock/0.0.0-test',
      );
      expect(constructorCall[1].baseUrl()).toBe(
        'https://bedrock-runtime.us-east-1.amazonaws.com',
      );
    });

    it('should create a provider instance with custom options', () => {
      const customHeaders = { 'custom-header': 'value' };
      const options = {
        region: 'eu-west-1',
        baseURL: 'https://custom.url',
        headers: customHeaders,
      };

      const provider = createAmazonBedrock(options);
      provider('anthropic.claude-v2');

      const constructorCall = AmazonBedrockChatLanguageModelMock.mock.calls[0];
      expect(constructorCall[1].headers()).toMatchObject(customHeaders);
      expect(constructorCall[1].headers()['user-agent']).toContain(
        'ai-sdk/amazon-bedrock/0.0.0-test',
      );
      expect(constructorCall[1].baseUrl()).toBe('https://custom.url');
    });

    it('should accept a credentialProvider in options', () => {
      const mockCredentialProvider = vi.fn().mockResolvedValue({
        accessKeyId: 'dynamic-access-key',
        secretAccessKey: 'dynamic-secret-key',
        sessionToken: 'dynamic-session-token',
      });

      const provider = createAmazonBedrock({
        credentialProvider: mockCredentialProvider,
      });

      provider('anthropic.claude-v2');

      const constructorCall = AmazonBedrockChatLanguageModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe('anthropic.claude-v2');
      expect(constructorCall[1].headers()).toMatchObject({});
      expect(constructorCall[1].headers()['user-agent']).toContain(
        'ai-sdk/amazon-bedrock/0.0.0-test',
      );
      expect(constructorCall[1].baseUrl()).toBe(
        'https://bedrock-runtime.us-east-1.amazonaws.com',
      );
    });

    it('should prioritize credentialProvider over static credentials', () => {
      const mockCredentialProvider = vi.fn().mockResolvedValue({
        accessKeyId: 'dynamic-access-key',
        secretAccessKey: 'dynamic-secret-key',
        sessionToken: 'dynamic-session-token',
      });

      const provider = createAmazonBedrock({
        accessKeyId: 'static-access-key',
        secretAccessKey: 'static-secret-key',
        sessionToken: 'static-session-token',
        credentialProvider: mockCredentialProvider,
      });

      provider('anthropic.claude-v2');
      const constructorCall = AmazonBedrockChatLanguageModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe('anthropic.claude-v2');
    });

    it('should pass headers to embedding model', () => {
      const customHeaders = { 'custom-header': 'value' };
      const provider = createAmazonBedrock({
        headers: customHeaders,
      });

      provider.embedding('amazon.titan-embed-text-v1');

      const constructorCall = AmazonBedrockEmbeddingModelMock.mock.calls[0];
      expect(constructorCall[1].headers()).toMatchObject(customHeaders);
      expect(constructorCall[1].headers()['user-agent']).toContain(
        'ai-sdk/amazon-bedrock/0.0.0-test',
      );
    });

    it('should throw error when called with new keyword', () => {
      const provider = createAmazonBedrock();
      expect(() => {
        new (provider as any)();
      }).toThrow(
        'The Amazon Bedrock model function cannot be called with the new keyword.',
      );
    });

    describe('API Key Authentication', () => {
      it('should use API key when provided in options', () => {
        const provider = createAmazonBedrock({
          apiKey: 'test-api-key',
          region: 'us-east-1',
        });

        // Verify that createApiKeyFetchFunction was called with the correct API key
        expect(mockCreateApiKeyFetchFunction).toHaveBeenCalledWith(
          'test-api-key',
          undefined, // fetch function
        );
        expect(mockCreateSigV4FetchFunction).not.toHaveBeenCalled();

        provider('anthropic.claude-v2');

        const constructorCall =
          AmazonBedrockChatLanguageModelMock.mock.calls[0];
        expect(constructorCall[0]).toBe('anthropic.claude-v2');
        expect(constructorCall[1].headers()).toMatchObject({});
        expect(constructorCall[1].headers()['user-agent']).toContain(
          'ai-sdk/amazon-bedrock/',
        );
        expect(constructorCall[1].baseUrl()).toBe(
          'https://bedrock-runtime.us-east-1.amazonaws.com',
        );
      });

      it('should use API key from environment variable', () => {
        // Mock loadOptionalSetting to return environment variable value
        mockLoadOptionalSetting.mockImplementation(
          ({ settingValue, environmentVariableName }) => {
            if (environmentVariableName === 'AWS_BEARER_TOKEN_BEDROCK') {
              return 'env-api-key';
            }
            return settingValue;
          },
        );

        const provider = createAmazonBedrock({
          region: 'us-east-1',
        });

        // Verify that createApiKeyFetchFunction was called with the environment variable value
        expect(mockCreateApiKeyFetchFunction).toHaveBeenCalledWith(
          'env-api-key',
          undefined,
        );
        expect(mockCreateSigV4FetchFunction).not.toHaveBeenCalled();
      });

      it('should prioritize options.apiKey over environment variable', () => {
        // Mock loadOptionalSetting to return environment variable value when no settingValue
        mockLoadOptionalSetting.mockImplementation(
          ({ settingValue, environmentVariableName }) => {
            if (settingValue) {
              return settingValue;
            }
            if (environmentVariableName === 'AWS_BEARER_TOKEN_BEDROCK') {
              return 'env-api-key';
            }
            return undefined;
          },
        );

        const provider = createAmazonBedrock({
          apiKey: 'options-api-key',
          region: 'us-east-1',
        });

        // Verify that options.apiKey takes precedence
        expect(mockCreateApiKeyFetchFunction).toHaveBeenCalledWith(
          'options-api-key',
          undefined,
        );
        expect(mockCreateSigV4FetchFunction).not.toHaveBeenCalled();
      });

      it('should fall back to SigV4 when no API key provided', () => {
        // Mock loadOptionalSetting to return undefined (no API key)
        mockLoadOptionalSetting.mockImplementation(() => undefined);

        const provider = createAmazonBedrock({
          region: 'us-east-1',
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        });

        // Verify that SigV4 authentication is used as fallback
        expect(mockCreateApiKeyFetchFunction).not.toHaveBeenCalled();
        expect(mockCreateSigV4FetchFunction).toHaveBeenCalled();

        provider('anthropic.claude-v2');

        const constructorCall =
          AmazonBedrockChatLanguageModelMock.mock.calls[0];
        expect(constructorCall[0]).toBe('anthropic.claude-v2');
      });

      it('should pass custom fetch function to API key authentication', () => {
        const customFetch = vi.fn();

        const provider = createAmazonBedrock({
          apiKey: 'test-api-key',
          region: 'us-east-1',
          fetch: customFetch,
        });

        // Verify that custom fetch function is passed to createApiKeyFetchFunction
        expect(mockCreateApiKeyFetchFunction).toHaveBeenCalledWith(
          'test-api-key',
          customFetch,
        );
      });

      it('should pass custom fetch function to SigV4 authentication', () => {
        // Mock loadOptionalSetting to return undefined (no API key)
        mockLoadOptionalSetting.mockImplementation(() => undefined);

        const customFetch = vi.fn();

        const provider = createAmazonBedrock({
          region: 'us-east-1',
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          fetch: customFetch,
        });

        // Verify that custom fetch function is passed to createSigV4FetchFunction
        expect(mockCreateSigV4FetchFunction).toHaveBeenCalledWith(
          expect.any(Function), // credentials function
          customFetch,
        );
      });

      it('should work with embedding models when using API key', () => {
        const provider = createAmazonBedrock({
          apiKey: 'test-api-key',
          region: 'us-east-1',
          headers: { 'custom-header': 'value' },
        });

        provider.embedding('amazon.titan-embed-text-v1');

        const constructorCall = AmazonBedrockEmbeddingModelMock.mock.calls[0];
        expect(constructorCall[0]).toBe('amazon.titan-embed-text-v1');
        expect(constructorCall[1].headers()).toMatchObject({
          'custom-header': 'value',
        });
        expect(constructorCall[1].headers()['user-agent']).toContain(
          'ai-sdk/amazon-bedrock/0.0.0-test',
        );
        expect(mockCreateApiKeyFetchFunction).toHaveBeenCalledWith(
          'test-api-key',
          undefined,
        );
      });

      it('should work with image models when using API key', () => {
        const provider = createAmazonBedrock({
          apiKey: 'test-api-key',
          region: 'us-east-1',
          headers: { 'custom-header': 'value' },
        });

        provider.image('amazon.titan-image-generator');

        const constructorCall = AmazonBedrockImageModelMock.mock.calls[0];
        expect(constructorCall[0]).toBe('amazon.titan-image-generator');
        expect(constructorCall[1].headers()).toMatchObject({
          'custom-header': 'value',
        });
        expect(constructorCall[1].headers()['user-agent']).toContain(
          'ai-sdk/amazon-bedrock/0.0.0-test',
        );
        expect(mockCreateApiKeyFetchFunction).toHaveBeenCalledWith(
          'test-api-key',
          undefined,
        );
      });

      it('should maintain backward compatibility with existing SigV4 authentication', () => {
        // Mock loadOptionalSetting to return undefined (no API key)
        mockLoadOptionalSetting.mockImplementation(() => undefined);

        const provider = createAmazonBedrock({
          region: 'eu-west-1',
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          sessionToken: 'test-session-token',
        });

        provider('anthropic.claude-v2');

        // Verify SigV4 is used when no API key is provided
        expect(mockCreateSigV4FetchFunction).toHaveBeenCalled();
        expect(mockCreateApiKeyFetchFunction).not.toHaveBeenCalled();

        const constructorCall =
          AmazonBedrockChatLanguageModelMock.mock.calls[0];
        expect(constructorCall[0]).toBe('anthropic.claude-v2');
        expect(constructorCall[1].baseUrl()).toBe(
          'https://bedrock-runtime.eu-west-1.amazonaws.com',
        );
      });

      it('does not use AWS_SESSION_TOKEN from env when both access keys are passed as options', async () => {
        mockLoadOptionalSetting.mockImplementation(
          ({ settingValue, environmentVariableName }) => {
            if (environmentVariableName === 'AWS_BEARER_TOKEN_BEDROCK') {
              return settingValue;
            }
            if (environmentVariableName === 'AWS_SESSION_TOKEN') {
              return 'env-session-token-should-not-be-used';
            }
            return settingValue;
          },
        );

        createAmazonBedrock({
          region: 'us-east-1',
          accessKeyId: 'from-options-ak',
          secretAccessKey: 'from-options-sk',
        });

        const getCredentials = mockCreateSigV4FetchFunction.mock.calls[0][0];
        await expect(getCredentials()).resolves.toMatchObject({
          accessKeyId: 'from-options-ak',
          secretAccessKey: 'from-options-sk',
          sessionToken: undefined,
        });
      });

      it('uses options.sessionToken when both access keys are passed as options', async () => {
        mockLoadOptionalSetting.mockImplementation(() => undefined);

        createAmazonBedrock({
          region: 'us-east-1',
          accessKeyId: 'from-options-ak',
          secretAccessKey: 'from-options-sk',
          sessionToken: 'explicit-session',
        });

        const getCredentials = mockCreateSigV4FetchFunction.mock.calls[0][0];
        await expect(getCredentials()).resolves.toMatchObject({
          sessionToken: 'explicit-session',
        });
      });

      it('should work with credential provider when no API key is provided', () => {
        // Mock loadOptionalSetting to return undefined (no API key)
        mockLoadOptionalSetting.mockImplementation(() => undefined);

        const mockCredentialProvider = vi.fn().mockResolvedValue({
          accessKeyId: 'dynamic-access-key',
          secretAccessKey: 'dynamic-secret-key',
          sessionToken: 'dynamic-session-token',
        });

        const provider = createAmazonBedrock({
          region: 'us-east-1',
          credentialProvider: mockCredentialProvider,
        });

        provider('anthropic.claude-v2');

        // Verify SigV4 is used with credential provider when no API key
        expect(mockCreateSigV4FetchFunction).toHaveBeenCalled();
        expect(mockCreateApiKeyFetchFunction).not.toHaveBeenCalled();
      });
    });
  });

  describe('provider methods', () => {
    it('should create an embedding model', () => {
      const provider = createAmazonBedrock();
      const modelId = 'amazon.titan-embed-text-v1';

      const model = provider.embedding(modelId);

      const constructorCall = AmazonBedrockEmbeddingModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe(modelId);
      expect(model).toBeInstanceOf(AmazonBedrockEmbeddingModel);
    });

    it('should create an image model', () => {
      const provider = createAmazonBedrock();
      const modelId = 'amazon.titan-image-generator';

      const model = provider.image(modelId);

      const constructorCall = AmazonBedrockImageModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe(modelId);
      expect(model).toBeInstanceOf(AmazonBedrockImageModel);
    });

    it('should create an image model via imageModel method', () => {
      const provider = createAmazonBedrock();
      const modelId = 'amazon.titan-image-generator';

      const model = provider.imageModel(modelId);

      const constructorCall = AmazonBedrockImageModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe(modelId);
      expect(model).toBeInstanceOf(AmazonBedrockImageModel);
    });

    it('should expose anthropicTools', () => {
      const provider = createAmazonBedrock();
      expect(provider.tools).toBe(anthropicTools);
    });
  });
});
