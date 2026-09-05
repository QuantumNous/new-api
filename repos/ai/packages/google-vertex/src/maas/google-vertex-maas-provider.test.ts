import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGoogleVertexMaas } from './google-vertex-maas-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type * as ProviderUtilsModule from '@ai-sdk/provider-utils';

// Mock the imported modules
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => {
    const provider: any = vi.fn();
    provider.specificationVersion = 'v4';
    provider.languageModel = vi.fn();
    provider.chatModel = vi.fn();
    provider.completionModel = vi.fn();
    provider.embeddingModel = vi.fn();
    provider.textEmbeddingModel = vi.fn();
    provider.imageModel = vi.fn();
    return provider;
  }),
}));

vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const actual = await importOriginal<typeof ProviderUtilsModule>();

  return {
    ...actual,
    loadSetting: vi.fn().mockImplementation(({ settingValue }) => {
      if (settingValue === undefined) {
        throw new Error('Setting is missing');
      }
      return settingValue;
    }),
    loadOptionalSetting: vi
      .fn()
      .mockImplementation(({ settingValue }) => settingValue),
  };
});

describe('google-vertex-maas-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not call createOpenAICompatible at provider creation time', () => {
    createGoogleVertexMaas({
      project: 'test-project',
      location: 'global',
    });

    expect(createOpenAICompatible).not.toHaveBeenCalled();
  });

  it('should create a provider with correct base URL for global location', () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      location: 'global',
    });

    // Trigger lazy init
    provider('test-model');

    expect(vi.mocked(createOpenAICompatible).mock.calls[0][0])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/endpoints/openapi",
          "fetch": undefined,
          "name": "vertex.maas",
        }
      `);
  });

  it('should create a provider with correct base URL for regional location', () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      location: 'us-central1',
    });

    provider('test-model');

    expect(vi.mocked(createOpenAICompatible).mock.calls[0][0])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/endpoints/openapi",
          "fetch": undefined,
          "name": "vertex.maas",
        }
      `);
  });

  it('should create a provider with correct base URL for multi-region location', () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      location: 'eu',
    });

    provider('test-model');

    expect(vi.mocked(createOpenAICompatible).mock.calls[0][0])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.eu.rep.googleapis.com/v1/projects/test-project/locations/eu/endpoints/openapi",
          "fetch": undefined,
          "name": "vertex.maas",
        }
      `);
  });

  it('should default to global location when not specified', () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
    });

    provider('test-model');

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'vertex.maas',
        baseURL:
          'https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/endpoints/openapi',
      }),
    );
  });

  it('should use custom baseURL when provided', () => {
    const customBaseURL = 'https://custom-endpoint.example.com';
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      baseURL: customBaseURL,
    });

    provider('test-model');

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'vertex.maas',
        baseURL: customBaseURL,
      }),
    );
  });

  it('should not pass headers to openai-compatible provider', () => {
    const customHeaders = { 'X-Custom': 'header-value' };
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      headers: customHeaders,
    });

    provider('test-model');

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'vertex.maas',
        baseURL: expect.any(String),
        fetch: undefined,
      }),
    );
    expect(createOpenAICompatible).not.toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.anything(),
      }),
    );
  });

  it('should pass custom fetch to openai-compatible provider', () => {
    const customFetch = vi.fn();
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      fetch: customFetch,
    });

    provider('test-model');

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch: customFetch,
      }),
    );
  });

  it('should construct correct URL with trailing slash removed from baseURL', () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      baseURL: 'https://custom-endpoint.example.com/',
    });

    provider('test-model');

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://custom-endpoint.example.com',
      }),
    );
  });

  it('should construct correct URL when baseURL is empty string', () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      location: 'us-central1',
      baseURL: '',
    });

    provider('test-model');

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL:
          'https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/endpoints/openapi',
      }),
    );
  });

  it('should cache the provider after first access', () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
    });

    provider('model-1');
    provider('model-2');

    expect(createOpenAICompatible).toHaveBeenCalledTimes(1);
  });
});
