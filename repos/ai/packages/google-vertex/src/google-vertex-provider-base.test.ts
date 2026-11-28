import type * as ProviderUtilsModule from '@ai-sdk/provider-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGoogleVertex } from './google-vertex-provider-base';
import {
  GoogleInteractionsLanguageModel,
  GoogleLanguageModel,
  GoogleSpeechModel,
} from '@ai-sdk/google/internal';
import { GoogleVertexEmbeddingModel } from './google-vertex-embedding-model';
import { GoogleVertexImageModel } from './google-vertex-image-model';
import { GoogleVertexVideoModel } from './google-vertex-video-model';
import { GoogleVertexTranscriptionModel } from './google-vertex-transcription-model';

// Mock the imported modules
vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const actual = await importOriginal<typeof ProviderUtilsModule>();
  return {
    ...actual,
    loadSetting: vi.fn().mockImplementation(({ settingValue }) => settingValue),
    loadOptionalSetting: vi
      .fn()
      .mockImplementation(({ settingValue, environmentVariableName }) => {
        if (settingValue) return settingValue;
        if (
          environmentVariableName === 'GOOGLE_VERTEX_API_KEY' &&
          process.env.GOOGLE_VERTEX_API_KEY
        ) {
          return process.env.GOOGLE_VERTEX_API_KEY;
        }
        return undefined;
      }),
    generateId: vi.fn().mockReturnValue('mock-id'),
    withoutTrailingSlash: vi.fn().mockImplementation(url => url),
    resolve: vi.fn().mockImplementation(async value => {
      if (typeof value === 'function') return value();
      return value;
    }),
    withUserAgentSuffix: vi.fn().mockImplementation(headers => headers),
  };
});

vi.mock('@ai-sdk/google/internal', () => ({
  GoogleLanguageModel: vi.fn(),
  GoogleInteractionsLanguageModel: vi.fn(),
  GoogleSpeechModel: vi.fn(),
  googleTools: {
    googleSearch: vi.fn(),
    urlContext: vi.fn(),
    fileSearch: vi.fn(),
    codeExecution: vi.fn(),
  },
}));

vi.mock('./google-vertex-embedding-model', () => ({
  GoogleVertexEmbeddingModel: vi.fn(),
}));

vi.mock('./google-vertex-image-model', () => ({
  GoogleVertexImageModel: vi.fn(),
}));

vi.mock('./google-vertex-video-model', () => ({
  GoogleVertexVideoModel: vi.fn(),
}));

vi.mock('./google-vertex-transcription-model', () => ({
  GoogleVertexTranscriptionModel: vi.fn(),
}));

describe('google-vertex-provider-base', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GOOGLE_VERTEX_API_KEY;
  });

  afterEach(() => {
    delete process.env.GOOGLE_VERTEX_API_KEY;
  });

  it('should create a language model with default settings', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        provider: 'google.vertex.chat',
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/publishers/google',
        headers: expect.any(Function),
        generateId: expect.any(Function),
      }),
    );
  });

  it('should create an interactions model targeting the location-scoped interactions resource', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider.interactions('gemini-omni-flash-preview');

    expect(GoogleInteractionsLanguageModel).toHaveBeenCalledWith(
      'gemini-omni-flash-preview',
      expect.objectContaining({
        provider: 'google.vertex.interactions',
        // No `/publishers/google` suffix — the interactions model appends
        // `/interactions` to reach `.../locations/{region}/interactions`.
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location',
        headers: expect.any(Function),
        generateId: expect.any(Function),
      }),
    );
  });

  it('should throw for interactions models when an Express Mode API key is set', () => {
    process.env.GOOGLE_VERTEX_API_KEY = 'test-api-key';
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });

    expect(() => provider.interactions('gemini-omni-flash-preview')).toThrow(
      /do not support Express Mode API keys/,
    );
  });

  it('should throw an error when using new keyword', () => {
    const provider = createGoogleVertex({ project: 'test-project' });

    expect(() => new (provider as any)('test-model-id')).toThrow(
      'The Google Vertex AI model function cannot be called with the new keyword.',
    );
  });

  it('should create an embedding model with correct settings', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider.embeddingModel('test-embedding-model');

    expect(GoogleVertexEmbeddingModel).toHaveBeenCalledWith(
      'test-embedding-model',
      expect.objectContaining({
        provider: 'google.vertex.embedding',
        headers: expect.any(Function),
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/publishers/google',
      }),
    );
  });

  it('should create a speech model with correct settings', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider.speech('gemini-2.5-flash-tts');

    expect(GoogleSpeechModel).toHaveBeenCalledWith(
      'gemini-2.5-flash-tts',
      expect.objectContaining({
        provider: 'google.vertex.speech',
        headers: expect.any(Function),
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/publishers/google',
      }),
    );
  });

  it('should create a speech model via speechModel()', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider.speechModel('gemini-2.5-pro-tts');

    expect(GoogleSpeechModel).toHaveBeenCalledWith(
      'gemini-2.5-pro-tts',
      expect.objectContaining({ provider: 'google.vertex.speech' }),
    );
  });

  it('should create a transcription model with correct settings', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'us-central1',
    });
    provider.transcription('chirp_2');

    expect(GoogleVertexTranscriptionModel).toHaveBeenCalledWith(
      'chirp_2',
      expect.objectContaining({
        provider: 'google.vertex.transcription',
        project: 'test-project',
        location: 'us-central1',
        headers: expect.any(Function),
      }),
    );
  });

  it('should create a transcription model via transcriptionModel()', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'us-central1',
    });
    provider.transcriptionModel('chirp_3');

    expect(GoogleVertexTranscriptionModel).toHaveBeenCalledWith(
      'chirp_3',
      expect.objectContaining({ provider: 'google.vertex.transcription' }),
    );
  });

  it('should reject Express Mode for transcription models', () => {
    const provider = createGoogleVertex({
      apiKey: 'test-api-key',
    });

    expect(() => provider.transcription('chirp_3')).toThrow(
      'Google Vertex transcription models do not support Express Mode API keys. Use standard Google Cloud credentials instead.',
    );
  });

  it('should pass custom headers to the model constructor', () => {
    const customHeaders = { 'Custom-Header': 'custom-value' };
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
      headers: customHeaders,
    });
    provider('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.any(Function),
      }),
    );
  });

  it('should pass custom generateId function to the model constructor', () => {
    const customGenerateId = () => 'custom-id';
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
      generateId: customGenerateId,
    });
    provider('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        generateId: customGenerateId,
      }),
    );
  });

  it('should use languageModel method to create a model', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider.languageModel('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.any(Object),
    );
  });

  it('should use custom baseURL when provided', () => {
    const customBaseURL = 'https://custom-endpoint.example.com';
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
      baseURL: customBaseURL,
    });
    provider('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });

  it('should use a tuned model endpoints/ id with no publishers/google suffix', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider('endpoints/1234567890');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'endpoints/1234567890',
      expect.objectContaining({
        provider: 'google.vertex.chat',
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location',
        headers: expect.any(Function),
        generateId: expect.any(Function),
      }),
    );
  });

  it('should leave base model ids and the publishers/google base URL unchanged', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider('gemini-2.5-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'gemini-2.5-pro',
      expect.objectContaining({
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/publishers/google',
      }),
    );
  });

  it('should respect a custom baseURL for tuned model endpoints/ ids', () => {
    const customBaseURL = 'https://custom-endpoint.example.com';
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
      baseURL: customBaseURL,
    });
    provider('endpoints/1234567890');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'endpoints/1234567890',
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });

  it('should reject Express Mode for tuned models', () => {
    const provider = createGoogleVertex({
      apiKey: 'test-api-key',
    });

    expect(() => provider('endpoints/1234567890')).toThrow(
      'Google Vertex tuned models do not support Express Mode API keys. Use standard Google Cloud credentials instead.',
    );
  });

  it('should create an image model with default settings', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider.image('imagen-3.0-generate-002');

    expect(GoogleVertexImageModel).toHaveBeenCalledWith(
      'imagen-3.0-generate-002',
      expect.objectContaining({
        provider: 'google.vertex.image',
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/publishers/google',
        headers: expect.any(Function),
      }),
    );
  });

  it('should use correct URL for global region', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'global',
    });
    provider('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        provider: 'google.vertex.chat',
        baseURL:
          'https://aiplatform.googleapis.com/v1beta1/projects/test-project/locations/global/publishers/google',
        headers: expect.any(Function),
        generateId: expect.any(Function),
      }),
    );
  });

  it('should use correct URL for global region with embedding model', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'global',
    });
    provider.embeddingModel('test-embedding-model');

    expect(GoogleVertexEmbeddingModel).toHaveBeenCalledWith(
      'test-embedding-model',
      expect.objectContaining({
        provider: 'google.vertex.embedding',
        headers: expect.any(Function),
        baseURL:
          'https://aiplatform.googleapis.com/v1beta1/projects/test-project/locations/global/publishers/google',
      }),
    );
  });

  it('should use correct URL for global region with image model', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'global',
    });
    provider.image('imagen-3.0-generate-002');

    expect(GoogleVertexImageModel).toHaveBeenCalledWith(
      'imagen-3.0-generate-002',
      expect.objectContaining({
        provider: 'google.vertex.image',
        baseURL:
          'https://aiplatform.googleapis.com/v1beta1/projects/test-project/locations/global/publishers/google',
        headers: expect.any(Function),
      }),
    );
  });

  it('should expose tools', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });

    expect(provider.tools).toBeDefined();
    expect(provider.tools.googleSearch).toBeDefined();
    expect(provider.tools.urlContext).toBeDefined();
    expect(provider.tools.codeExecution).toBeDefined();
  });

  it('should use region-prefixed URL for non-global regions', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'us-central1',
    });
    provider('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        provider: 'google.vertex.chat',
        baseURL:
          'https://us-central1-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/us-central1/publishers/google',
        headers: expect.any(Function),
        generateId: expect.any(Function),
      }),
    );
  });

  it('should use multi-region REP URL for us location', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'us',
    });
    provider('test-model-id');

    expect(vi.mocked(GoogleLanguageModel).mock.calls[0][1])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.us.rep.googleapis.com/v1beta1/projects/test-project/locations/us/publishers/google",
          "fetch": undefined,
          "generateId": [MockFunction],
          "headers": [Function],
          "provider": "google.vertex.chat",
          "supportedUrls": [Function],
        }
      `);
  });

  it('should use multi-region REP URL for eu location', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'eu',
    });
    provider('test-model-id');

    expect(vi.mocked(GoogleLanguageModel).mock.calls[0][1])
      .toMatchInlineSnapshot(`
        {
          "baseURL": "https://aiplatform.eu.rep.googleapis.com/v1beta1/projects/test-project/locations/eu/publishers/google",
          "fetch": undefined,
          "generateId": [MockFunction],
          "headers": [Function],
          "provider": "google.vertex.chat",
          "supportedUrls": [Function],
        }
      `);
  });

  it('should use express mode base URL when apiKey is provided', () => {
    const provider = createGoogleVertex({
      apiKey: 'test-api-key',
    });
    provider('test-model-id');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'test-model-id',
      expect.objectContaining({
        baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google',
      }),
    );
  });

  it('should add API key as query parameter via custom fetch', async () => {
    const provider = createGoogleVertex({
      apiKey: 'test-api-key',
    });
    provider('test-model-id');

    const calledConfig = vi.mocked(GoogleLanguageModel).mock.calls[0][1];
    const customFetch = calledConfig.fetch;

    expect(customFetch).toBeDefined();

    const mockResponse = new Response('{}');
    const originalFetch = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', originalFetch);

    await customFetch!(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:streamGenerateContent',
      {},
    );

    expect(originalFetch).toHaveBeenCalledWith(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:streamGenerateContent',
      {
        headers: {
          'x-goog-api-key': 'test-api-key',
        },
      },
    );

    vi.unstubAllGlobals();
  });

  it('should create a video model with default settings', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
    });
    provider.video('veo-2.0-generate-001');

    expect(GoogleVertexVideoModel).toHaveBeenCalledWith(
      'veo-2.0-generate-001',
      expect.objectContaining({
        provider: 'google.vertex.video',
        baseURL:
          'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/publishers/google',
        headers: expect.any(Function),
        generateId: expect.any(Function),
      }),
    );
  });

  it('should use correct URL for global region with video model', () => {
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'global',
    });
    provider.video('veo-3.0-generate-001');

    expect(GoogleVertexVideoModel).toHaveBeenCalledWith(
      'veo-3.0-generate-001',
      expect.objectContaining({
        provider: 'google.vertex.video',
        baseURL:
          'https://aiplatform.googleapis.com/v1beta1/projects/test-project/locations/global/publishers/google',
        headers: expect.any(Function),
      }),
    );
  });

  it('should use custom baseURL for video model when provided', () => {
    const customBaseURL = 'https://custom-endpoint.example.com';
    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'test-location',
      baseURL: customBaseURL,
    });
    provider.video('veo-2.0-generate-001');

    expect(GoogleVertexVideoModel).toHaveBeenCalledWith(
      'veo-2.0-generate-001',
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });
});
