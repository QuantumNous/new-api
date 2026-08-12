import { NoSuchModelError } from '@ai-sdk/provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGoogleVertexXai } from './google-vertex-xai-provider';

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => {
    const provider: any = vi.fn();
    provider.specificationVersion = 'v4';
    provider.languageModel = vi.fn();
    provider.chatModel = vi.fn();
    return provider;
  }),
}));

vi.mock('@ai-sdk/provider-utils', () => ({
  loadSetting: vi.fn().mockImplementation(({ settingValue }) => {
    if (settingValue === undefined) {
      throw new Error('Setting is missing');
    }
    return settingValue;
  }),
  loadOptionalSetting: vi
    .fn()
    .mockImplementation(({ settingValue }) => settingValue),
  withoutTrailingSlash: vi.fn().mockImplementation(url => {
    if (!url) return '';
    return url?.endsWith('/') ? url.slice(0, -1) : url;
  }),
}));

describe('google-vertex-xai-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not call createOpenAICompatible at provider creation time', () => {
    createGoogleVertexXai({
      project: 'test-project',
      location: 'global',
    });

    expect(createOpenAICompatible).not.toHaveBeenCalled();
  });

  it('should create a provider with correct base URL for global location', () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
      location: 'global',
    });

    provider('xai/grok-4.1-fast-reasoning');

    expect(vi.mocked(createOpenAICompatible).mock.calls[0][0])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/endpoints/openapi",
          "convertUsage": [Function],
          "fetch": undefined,
          "includeUsage": true,
          "name": "googleVertex.xai",
          "supportedUrls": [Function],
          "supportsStructuredOutputs": true,
          "transformRequestBody": [Function],
        }
      `);
  });

  it('should create a provider with correct base URL for regional location', () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
      location: 'us-central1',
    });

    provider('xai/grok-4.1-fast-reasoning');

    expect(vi.mocked(createOpenAICompatible).mock.calls[0][0])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/endpoints/openapi",
          "convertUsage": [Function],
          "fetch": undefined,
          "includeUsage": true,
          "name": "googleVertex.xai",
          "supportedUrls": [Function],
          "supportsStructuredOutputs": true,
          "transformRequestBody": [Function],
        }
      `);
  });

  it('should configure OpenAI-compatible behavior for Vertex Grok', () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
      location: 'global',
    });

    provider('xai/grok-4.1-fast-reasoning');

    expect(vi.mocked(createOpenAICompatible).mock.calls[0][0])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/endpoints/openapi",
          "convertUsage": [Function],
          "fetch": undefined,
          "includeUsage": true,
          "name": "googleVertex.xai",
          "supportedUrls": [Function],
          "supportsStructuredOutputs": true,
          "transformRequestBody": [Function],
        }
      `);
  });

  it('should strip reasoning_effort from request bodies', () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
      location: 'global',
    });

    provider('xai/grok-4.1-fast-reasoning');

    const [{ transformRequestBody }] = vi.mocked(createOpenAICompatible).mock
      .calls[0];

    expect(
      transformRequestBody?.({
        model: 'xai/grok-4.1-fast-reasoning',
        reasoning_effort: 'high',
        messages: [],
      }),
    ).toMatchInlineSnapshot(`
      {
        "messages": [],
        "model": "xai/grok-4.1-fast-reasoning",
      }
    `);
  });

  it('should count Grok reasoning tokens separately from completion tokens', () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
      location: 'global',
    });

    provider('xai/grok-4.1-fast-reasoning');

    const [{ convertUsage }] = vi.mocked(createOpenAICompatible).mock.calls[0];

    expect(
      convertUsage?.({
        prompt_tokens: 663,
        prompt_tokens_details: { cached_tokens: 654 },
        completion_tokens: 50,
        completion_tokens_details: { reasoning_tokens: 124 },
      }),
    ).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 654,
          "cacheWrite": undefined,
          "noCache": 9,
          "total": 663,
        },
        "outputTokens": {
          "reasoning": 124,
          "text": 50,
          "total": 174,
        },
        "raw": {
          "completion_tokens": 50,
          "completion_tokens_details": {
            "reasoning_tokens": 124,
          },
          "prompt_tokens": 663,
          "prompt_tokens_details": {
            "cached_tokens": 654,
          },
        },
      }
    `);
  });

  it('should support HTTP image URLs', () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
      location: 'global',
    });

    provider('xai/grok-4.1-fast-reasoning');

    const [{ supportedUrls }] = vi.mocked(createOpenAICompatible).mock.calls[0];

    expect(supportedUrls?.()).toMatchInlineSnapshot(`
      {
        "image/*": [
          /\\^https\\?:\\\\/\\\\/\\.\\*\\$/,
        ],
      }
    `);
  });

  it('should throw an error when using new keyword', () => {
    const provider = createGoogleVertexXai({ project: 'test-project' });

    expect(() => new (provider as any)('test-model-id')).toThrow(
      'The Google Vertex xAI model function cannot be called with the new keyword.',
    );
  });

  it('should throw NoSuchModelError for embedding and image models', () => {
    const provider = createGoogleVertexXai({ project: 'test-project' });

    expect(() => provider.embeddingModel('invalid-model-id')).toThrow(
      NoSuchModelError,
    );
    expect(() => provider.imageModel('invalid-model-id')).toThrow(
      NoSuchModelError,
    );
  });

  it('should cache the OpenAI-compatible provider after first access', () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
    });

    provider('xai/grok-4.1-fast-reasoning');
    provider('xai/grok-4.20-reasoning');

    expect(createOpenAICompatible).toHaveBeenCalledTimes(1);
  });
});
