import { createBedrockMantle } from './bedrock-mantle-provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import {
  OpenAIChatLanguageModel,
  OpenAIResponsesLanguageModel,
} from '@ai-sdk/openai/internal';
import type * as ProviderUtilsModule from '@ai-sdk/provider-utils';
import {
  createApiKeyFetchFunction,
  createSigV4FetchFunction,
} from '../amazon-bedrock-sigv4-fetch';
import { vi, describe, beforeEach, it, expect } from 'vitest';

vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const actual = await importOriginal<typeof ProviderUtilsModule>();
  return {
    ...actual,
    loadOptionalSetting: vi.fn().mockImplementation(({ settingValue }) => {
      // Return undefined for API key to test SigV4 flow
      if (settingValue === undefined) return undefined;
      return settingValue;
    }),
    loadSetting: vi.fn().mockImplementation(({ settingValue, settingName }) => {
      if (settingValue) return settingValue;
      // Return mock values for required settings
      if (settingName === 'region') return 'us-east-1';
      if (settingName === 'accessKeyId') return 'mock-access-key';
      if (settingName === 'secretAccessKey') return 'mock-secret-key';
      return settingValue;
    }),
    withoutTrailingSlash: vi.fn().mockImplementation(url => url),
    withUserAgentSuffix: vi.fn().mockImplementation((headers, suffix) => ({
      ...headers,
      'user-agent': suffix,
    })),
  };
});

vi.mock('@ai-sdk/openai/internal', async () => {
  const originalModule = await vi.importActual('@ai-sdk/openai/internal');
  return {
    ...originalModule,
    OpenAIChatLanguageModel: vi.fn(),
    OpenAIResponsesLanguageModel: vi.fn(),
  };
});

vi.mock('../amazon-bedrock-sigv4-fetch', () => ({
  createSigV4FetchFunction: vi.fn().mockReturnValue(vi.fn()),
  createApiKeyFetchFunction: vi.fn().mockReturnValue(vi.fn()),
}));

describe('bedrock-mantle-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a chat model with default settings', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('openai.gpt-oss-20b');

    expect(OpenAIChatLanguageModel).toHaveBeenCalledWith(
      'openai.gpt-oss-20b',
      expect.objectContaining({
        provider: 'bedrock-mantle.chat',
        url: expect.any(Function),
        headers: expect.any(Function),
        fetch: expect.any(Function),
      }),
    );
  });

  it('should create a chat model via .chat()', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider.chat('openai.gpt-oss-20b');

    expect(OpenAIChatLanguageModel).toHaveBeenCalledWith(
      'openai.gpt-oss-20b',
      expect.objectContaining({
        provider: 'bedrock-mantle.chat',
        url: expect.any(Function),
        headers: expect.any(Function),
        fetch: expect.any(Function),
      }),
    );
  });

  it('should alias .languageModel() to chat model', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider.languageModel('test-model');

    expect(OpenAIChatLanguageModel).toHaveBeenCalledWith(
      'test-model',
      expect.objectContaining({
        provider: 'bedrock-mantle.chat',
      }),
    );
  });

  it('should create a responses model via .responses()', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider.responses('test-model');

    expect(OpenAIResponsesLanguageModel).toHaveBeenCalledWith(
      'test-model',
      expect.objectContaining({
        provider: 'bedrock-mantle.responses',
      }),
    );
  });

  it('should throw an error when using new keyword', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(() => new (provider as any)('test-model-id')).toThrow(
      'The Bedrock Mantle model function cannot be called with the new keyword.',
    );
  });

  it('should use default base URL with region', () => {
    const provider = createBedrockMantle({
      region: 'us-west-2',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model');

    const constructorCall = vi.mocked(OpenAIChatLanguageModel).mock.calls[
      vi.mocked(OpenAIChatLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const generatedUrl = config.url({
      path: '/responses',
      modelId: 'test-model',
    });
    expect(generatedUrl).toBe(
      'https://bedrock-mantle.us-west-2.api.aws/v1/responses',
    );
  });

  it('should pass custom baseURL to the model when created', () => {
    const customBaseURL = 'https://custom-mantle.example.com/v1';
    const provider = createBedrockMantle({
      region: 'us-east-1',
      baseURL: customBaseURL,
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model');

    const constructorCall = vi.mocked(OpenAIChatLanguageModel).mock.calls[
      vi.mocked(OpenAIChatLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const generatedUrl = config.url({
      path: '/chat/completions',
      modelId: 'test-model',
    });
    expect(generatedUrl).toBe(
      'https://custom-mantle.example.com/v1/chat/completions',
    );
  });

  it('should include custom headers with user-agent suffix', () => {
    const customHeaders = { 'Custom-Header': 'custom-value' };
    const provider = createBedrockMantle({
      region: 'us-east-1',
      headers: customHeaders,
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model');

    const constructorCall = vi.mocked(OpenAIChatLanguageModel).mock.calls[
      vi.mocked(OpenAIChatLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const resolvedHeaders = config.headers!();
    expect(resolvedHeaders).toMatchObject(customHeaders);
    expect(resolvedHeaders['user-agent']).toContain('ai-sdk/amazon-bedrock/');
  });

  it('should use createApiKeyFetchFunction when apiKey is provided', () => {
    createBedrockMantle({
      region: 'us-east-1',
      apiKey: 'test-api-key',
    });

    expect(createApiKeyFetchFunction).toHaveBeenCalledWith(
      'test-api-key',
      undefined,
    );
    expect(createSigV4FetchFunction).not.toHaveBeenCalled();
  });

  it('should use createSigV4FetchFunction with bedrock-mantle service when no apiKey', () => {
    createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(createSigV4FetchFunction).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      'bedrock-mantle',
    );
    expect(createApiKeyFetchFunction).not.toHaveBeenCalled();
  });

  it('should throw NoSuchModelError for embeddingModel', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(() => provider.embeddingModel('invalid-model-id')).toThrow(
      NoSuchModelError,
    );
  });

  it('should throw NoSuchModelError for imageModel', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(() => provider.imageModel('invalid-model-id')).toThrow(
      NoSuchModelError,
    );
  });

  it('should have correct specificationVersion', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(provider.specificationVersion).toBe('v4');
  });

  it('should provide languageModel as alias for responses', () => {
    const provider = createBedrockMantle({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(provider.languageModel).toBeDefined();
    expect(typeof provider.languageModel).toBe('function');
  });
});
