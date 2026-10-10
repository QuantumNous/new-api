import {
  createGoogleVertexAnthropic,
  googleVertexAnthropicTools,
} from './google-vertex-anthropic-provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { AnthropicLanguageModel } from '@ai-sdk/anthropic/internal';
import { vi, describe, beforeEach, it, expect } from 'vitest';

// Mock the imported modules
vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    loadOptionalSetting: vi
      .fn()
      .mockImplementation(({ settingValue }) => settingValue),
    withoutTrailingSlash: vi.fn().mockImplementation(url => url),
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

describe('google-vertex-anthropic-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a language model with default settings', () => {
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      location: 'test-location',
    });
    provider('test-model-id');

    // Assert that the model constructor was called with the correct arguments
    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        baseURL: expect.stringContaining(
          '/projects/test-project/locations/test-location/publishers/anthropic/models',
        ),
        provider: 'googleVertex.anthropic.messages',
        headers: expect.any(Object),
        buildRequestUrl: expect.any(Function),
        transformRequestBody: expect.any(Function),
        supportsNativeStructuredOutput: false,
        supportsStrictTools: false,
      }),
    );
  });

  it('should throw an error when using new keyword', () => {
    const provider = createGoogleVertexAnthropic({ project: 'test-project' });

    expect(() => new (provider as any)('test-model-id')).toThrow(
      'The Anthropic model function cannot be called with the new keyword.',
    );
  });

  it('should pass baseURL to the model when created', () => {
    const customBaseURL = 'https://custom-url.com';
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      baseURL: customBaseURL,
    });
    provider('test-model-id');

    // Assert that the constructor was called with the correct baseURL
    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      expect.anything(), // modelId
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });

  it('should throw NoSuchModelError for textEmbeddingModel', () => {
    const provider = createGoogleVertexAnthropic({ project: 'test-project' });

    expect(() => provider.embeddingModel('invalid-model-id')).toThrow(
      NoSuchModelError,
    );
  });

  it('should include googleVertexAnthropicTools (subset of anthropicTools)', () => {
    const provider = createGoogleVertexAnthropic({ project: 'test-project' });

    expect(provider.tools).toBe(googleVertexAnthropicTools);
    expect(provider.tools).toHaveProperty('bash_20241022');
    expect(provider.tools).toHaveProperty('bash_20250124');
    expect(provider.tools).toHaveProperty('textEditor_20241022');
    expect(provider.tools).toHaveProperty('textEditor_20250124');
    expect(provider.tools).toHaveProperty('textEditor_20250429');
    expect(provider.tools).toHaveProperty('textEditor_20250728');
    expect(provider.tools).toHaveProperty('computer_20241022');
    expect(provider.tools).toHaveProperty('webSearch_20250305');
    expect(provider.tools).toHaveProperty('toolSearchRegex_20251119');
    expect(provider.tools).toHaveProperty('toolSearchBm25_20251119');
    expect(provider.tools).not.toHaveProperty('codeExecution_20250825');
    expect(provider.tools).not.toHaveProperty('codeExecution_20260120');
  });

  it('should pass custom headers to the model constructor', () => {
    const customHeaders = { 'Custom-Header': 'custom-value' };
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      headers: customHeaders,
    });
    provider('test-model-id');

    // Assert that the model constructor was called with the correct headers
    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      expect.anything(), // modelId
      expect.objectContaining({
        headers: customHeaders,
      }),
    );
  });

  it('should create a Google Vertex Anthropic provider instance with custom settings', () => {
    const customProvider = createGoogleVertexAnthropic({
      project: 'custom-project',
      location: 'custom-location',
      baseURL: 'https://custom.base.url',
      headers: { 'Custom-Header': 'value' },
    });

    expect(customProvider).toBeDefined();
    expect(typeof customProvider).toBe('function');
    expect(customProvider.languageModel).toBeDefined();
  });

  it('should not support URL sources to force base64 conversion', () => {
    const provider = createGoogleVertexAnthropic();
    provider('test-model-id');

    // Assert that the model constructor was called with supportedUrls function
    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        supportedUrls: expect.any(Function),
      }),
    );

    // Get the actual config passed to the constructor
    const constructorCall = vi.mocked(AnthropicLanguageModel).mock.calls[
      vi.mocked(AnthropicLanguageModel).mock.calls.length - 1
    ];
    const config = constructorCall[1];

    // Verify that supportedUrls returns empty object to force base64 conversion
    expect(config.supportedUrls?.()).toEqual({});
  });

  it('should use correct URL for global location', () => {
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      location: 'global',
    });
    provider('test-model-id');

    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        baseURL:
          'https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/anthropic/models',
        provider: 'googleVertex.anthropic.messages',
      }),
    );
  });

  it('should use region-prefixed URL for non-global locations', () => {
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      location: 'us-east5',
    });
    provider('test-model-id');

    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        baseURL:
          'https://us-east5-aiplatform.googleapis.com/v1/projects/test-project/locations/us-east5/publishers/anthropic/models',
        provider: 'googleVertex.anthropic.messages',
      }),
    );
  });

  it('should use multi-region URL for eu location', () => {
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      location: 'eu',
    });
    provider('test-model-id');

    expect(vi.mocked(AnthropicLanguageModel).mock.calls[0][1])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.eu.rep.googleapis.com/v1/projects/test-project/locations/eu/publishers/anthropic/models",
          "buildRequestUrl": [Function],
          "fetch": undefined,
          "headers": {},
          "provider": "googleVertex.anthropic.messages",
          "supportedUrls": [Function],
          "supportsNativeStructuredOutput": false,
          "supportsStrictTools": false,
          "transformRequestBody": [Function],
        }
      `);
  });

  it('should use multi-region URL for us location', () => {
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      location: 'us',
    });
    provider('test-model-id');

    expect(vi.mocked(AnthropicLanguageModel).mock.calls[0][1])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.us.rep.googleapis.com/v1/projects/test-project/locations/us/publishers/anthropic/models",
          "buildRequestUrl": [Function],
          "fetch": undefined,
          "headers": {},
          "provider": "googleVertex.anthropic.messages",
          "supportedUrls": [Function],
          "supportsNativeStructuredOutput": false,
          "supportsStrictTools": false,
          "transformRequestBody": [Function],
        }
      `);
  });

  it('should support combining tools with structured outputs (inherited from Anthropic)', () => {
    const provider = createGoogleVertexAnthropic({
      project: 'test-project',
      location: 'us-east5',
    });

    // Create a model instance
    const model = provider('claude-3-5-sonnet-v2@20241022');

    // Verify the model was created using AnthropicLanguageModel
    // which already supports combining tools with structured outputs
    expect(AnthropicLanguageModel).toHaveBeenCalledWith(
      'claude-3-5-sonnet-v2@20241022',
      expect.objectContaining({
        provider: 'googleVertex.anthropic.messages',
      }),
    );
  });
});
