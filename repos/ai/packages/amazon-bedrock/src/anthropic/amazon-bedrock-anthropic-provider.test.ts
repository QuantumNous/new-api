import { createAmazonBedrockAnthropic } from './amazon-bedrock-anthropic-provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import {
  AnthropicLanguageModel,
  anthropicTools,
} from '@ai-sdk/anthropic/internal';
import { vi, describe, beforeEach, it, expect } from 'vitest';

vi.mock('@ai-sdk/provider-utils', async () => {
  const actual = await vi.importActual('@ai-sdk/provider-utils');
  return {
    WORKFLOW_SERIALIZE: (actual as any).WORKFLOW_SERIALIZE,
    WORKFLOW_DESERIALIZE: (actual as any).WORKFLOW_DESERIALIZE,
    serializeModelOptions: (actual as any).serializeModelOptions,
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
    resolve: vi.fn().mockImplementation(async value => {
      if (typeof value === 'function') return value();
      return value;
    }),
    createJsonErrorResponseHandler: vi.fn(),
    createProviderDefinedToolFactory: vi.fn(),
    createProviderDefinedToolFactoryWithOutputSchema: vi.fn(),
    createProviderExecutedToolFactory: vi.fn(),
    lazySchema: vi.fn(),
    zodSchema: vi.fn(),
  };
});

vi.mock('@ai-sdk/anthropic/internal', async () => {
  const originalModule = await vi.importActual('@ai-sdk/anthropic/internal');
  return {
    ...originalModule,
    AnthropicLanguageModel: vi.fn(),
  };
});

vi.mock('../amazon-bedrock-sigv4-fetch', () => ({
  createSigV4FetchFunction: vi.fn().mockReturnValue(vi.fn()),
  createApiKeyFetchFunction: vi.fn().mockReturnValue(vi.fn()),
}));

describe('amazon-bedrock-anthropic-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a language model with default settings', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('anthropic.claude-3-5-sonnet-20241022-v2:0');

    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      expect.objectContaining({
        baseURL: expect.stringContaining('bedrock-runtime'),
        provider: 'bedrock.anthropic.messages',
        headers: expect.any(Function),
        buildRequestUrl: expect.any(Function),
        transformRequestBody: expect.any(Function),
        supportedUrls: expect.any(Function),
        supportsNativeStructuredOutput: true,
      }),
    );
  });

  it.each([
    'anthropic.claude-opus-4-7',
    'us.anthropic.claude-opus-4-7',
    'eu.anthropic.claude-opus-4-7',
    'anthropic.claude-opus-4-8',
    'us.anthropic.claude-opus-4-8',
    'eu.anthropic.claude-opus-4-8',
    'anthropic.claude-fable-5',
    'us.anthropic.claude-fable-5',
    'eu.anthropic.claude-fable-5',
    'anthropic.claude-sonnet-5',
    'us.anthropic.claude-sonnet-5',
    'eu.anthropic.claude-sonnet-5',
  ])(
    'should disable native structured output for %s (Bedrock rejects output_config.format)',
    modelId => {
      const provider = createAmazonBedrockAnthropic({
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });
      provider(modelId as Parameters<typeof provider>[0]);

      expect(AnthropicLanguageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          supportsNativeStructuredOutput: false,
        }),
      );
    },
  );

  it('should throw an error when using new keyword', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(() => new (provider as any)('test-model-id')).toThrow(
      'The Bedrock Anthropic model function cannot be called with the new keyword.',
    );
  });

  it('should pass custom baseURL to the model when created', () => {
    const customBaseURL = 'https://custom-bedrock.amazonaws.com';
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      baseURL: customBaseURL,
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });

  it('should throw NoSuchModelError for embeddingModel', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(() => provider.embeddingModel('invalid-model-id')).toThrow(
      NoSuchModelError,
    );
  });

  it('should throw NoSuchModelError for imageModel', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(() => provider.imageModel('invalid-model-id')).toThrow(
      NoSuchModelError,
    );
  });

  it('should include anthropicTools', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(provider.tools).toBe(anthropicTools);
  });

  it('should pass custom headers wrapped in a function with user-agent suffix', async () => {
    const customHeaders = { 'Custom-Header': 'custom-value' };
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      headers: customHeaders,
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.any(Function),
      }),
    );

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    expect(config.headers).toEqual(expect.any(Function));
    const resolvedHeaders = await (config.headers as Function)();
    expect(resolvedHeaders).toMatchObject(customHeaders);
    expect(resolvedHeaders['user-agent']).toContain('ai-sdk/amazon-bedrock/');
  });

  it('should build correct URL for non-streaming requests', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('anthropic.claude-3-sonnet-20240229-v1:0');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const url = config.buildRequestUrl?.(
      'https://bedrock-runtime.us-east-1.amazonaws.com',
      false,
    );
    expect(url).toBe(
      'https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-sonnet-20240229-v1%3A0/invoke',
    );
  });

  it('should build correct URL for streaming requests', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('anthropic.claude-3-sonnet-20240229-v1:0');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const url = config.buildRequestUrl?.(
      'https://bedrock-runtime.us-east-1.amazonaws.com',
      true,
    );
    expect(url).toBe(
      'https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-sonnet-20240229-v1%3A0/invoke-with-response-stream',
    );
  });

  it('should transform request body to add anthropic_version and remove model', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
      },
      new Set(),
    );

    expect(transformedBody).toEqual({
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1024,
      anthropic_version: 'bedrock-2023-05-31',
    });
    expect(transformedBody).not.toHaveProperty('model');
  });

  it('should strip stream parameter from request body', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        stream: true,
      },
      new Set(),
    );

    expect(transformedBody).not.toHaveProperty('stream');
    expect(transformedBody).toHaveProperty('anthropic_version');
  });

  it('should strip disable_parallel_tool_use from tool_choice', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tool_choice: {
          type: 'auto',
          disable_parallel_tool_use: true,
        },
      },
      new Set(),
    );

    expect(transformedBody?.tool_choice).toEqual({ type: 'auto' });
    expect(transformedBody?.tool_choice).not.toHaveProperty(
      'disable_parallel_tool_use',
    );
  });

  it('should preserve tool_choice name when present', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tool_choice: {
          type: 'tool',
          name: 'my_tool',
          disable_parallel_tool_use: true,
        },
      },
      new Set(),
    );

    expect(transformedBody?.tool_choice).toEqual({
      type: 'tool',
      name: 'my_tool',
    });
  });

  it('should map old tool versions to Bedrock-supported versions', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tools: [
          { type: 'bash_20241022', name: 'bash' },
          { type: 'text_editor_20241022', name: 'str_replace_editor' },
          { type: 'computer_20241022', name: 'computer' },
        ],
      },
      new Set(),
    );

    expect(transformedBody?.tools).toEqual([
      { type: 'bash_20250124', name: 'bash' },
      { type: 'text_editor_20250728', name: 'str_replace_based_edit_tool' },
      { type: 'computer_20250124', name: 'computer' },
    ]);
  });

  it('should add anthropic_beta when computer use tools are detected', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tools: [{ type: 'bash_20250124', name: 'bash' }],
      },
      new Set(),
    );

    expect(transformedBody?.anthropic_beta).toContain(
      'computer-use-2025-01-24',
    );
  });

  it('should include betas passed to transformRequestBody in anthropic_beta body field', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
      },
      new Set(),
    );

    expect(transformedBody).toHaveProperty(
      'anthropic_version',
      'bedrock-2023-05-31',
    );
    expect(transformedBody).not.toHaveProperty('anthropic_beta');
  });

  it('should not add anthropic_beta when no computer use tools are present', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            input_schema: { type: 'object', properties: {} },
          },
        ],
      },
      new Set(),
    );

    expect(transformedBody?.anthropic_beta).toBeUndefined();
  });

  it('should translate eager_input_streaming on tools into the fine-grained-tool-streaming beta', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tools: [
          {
            name: 'get_weather',
            input_schema: { type: 'object', properties: {} },
            eager_input_streaming: true,
          },
          {
            name: 'get_time',
            input_schema: { type: 'object', properties: {} },
          },
        ],
      },
      new Set(),
    );

    expect(transformedBody?.tools).toEqual([
      { name: 'get_weather', input_schema: { type: 'object', properties: {} } },
      { name: 'get_time', input_schema: { type: 'object', properties: {} } },
    ]);
    expect(transformedBody?.anthropic_beta).toEqual([
      'fine-grained-tool-streaming-2025-05-14',
    ]);
  });

  it('should not add the fine-grained-tool-streaming beta when no tool has eager_input_streaming', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tools: [
          {
            name: 'get_weather',
            input_schema: { type: 'object', properties: {} },
          },
        ],
      },
      new Set(),
    );

    expect(transformedBody?.anthropic_beta).toBeUndefined();
  });

  it('should strip eager_input_streaming from tools that also get version remapped', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tools: [
          {
            name: 'get_weather',
            input_schema: { type: 'object', properties: {} },
            eager_input_streaming: true,
          },
          { type: 'bash_20241022', name: 'bash' },
        ],
      },
      new Set(),
    );

    expect(transformedBody?.tools).toEqual([
      { name: 'get_weather', input_schema: { type: 'object', properties: {} } },
      { type: 'bash_20250124', name: 'bash' },
    ]);
    expect(transformedBody?.anthropic_beta).toEqual(
      expect.arrayContaining([
        'fine-grained-tool-streaming-2025-05-14',
        'computer-use-2025-01-24',
      ]),
    );
  });

  it('should not support URL sources to force base64 conversion', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    expect(config.supportedUrls?.()).toEqual({});
  });

  it('should have correct specificationVersion', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(provider.specificationVersion).toBe('v4');
  });

  it('should provide languageModel as alias', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    expect(provider.languageModel).toBeDefined();
    expect(typeof provider.languageModel).toBe('function');
  });

  it('should add tool-search-tool beta when tool search tools are present', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('test-model-id');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const transformedBody = config.transformRequestBody?.(
      {
        model: 'test-model-id',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        tools: [
          { type: 'tool_search_tool_regex_20251119', name: 'tool_search' },
          { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_bm25' },
        ],
      },
      new Set(),
    );

    expect(transformedBody?.anthropic_beta).toContain(
      'tool-search-tool-2025-10-19',
    );
  });

  it('should handle models with us. prefix for inference profiles', () => {
    const provider = createAmazonBedrockAnthropic({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    provider('us.anthropic.claude-3-5-sonnet-20240620-v1:0');

    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    const url = config.buildRequestUrl?.(
      'https://bedrock-runtime.us-east-1.amazonaws.com',
      false,
    );
    expect(url).toBe(
      'https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-3-5-sonnet-20240620-v1%3A0/invoke',
    );
  });
});
