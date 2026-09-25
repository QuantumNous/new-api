import type * as ProviderUtilsModule from '@ai-sdk/provider-utils';
import { isUrlSupported } from '@ai-sdk/provider-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGoogle } from './google-provider';
import { GoogleLanguageModel } from './google-language-model';
import { GoogleEmbeddingModel } from './google-embedding-model';
import { GoogleImageModel } from './google-image-model';
import { GoogleVideoModel } from './google-video-model';
import { GoogleSpeechModel } from './google-speech-model';

// Mock the imported modules using a partial mock to preserve original exports
vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const mod = await importOriginal<typeof ProviderUtilsModule>();
  return {
    ...mod,
    loadApiKey: vi.fn().mockImplementation(({ apiKey }) => apiKey),
    generateId: vi.fn().mockReturnValue('mock-id'),
    withoutTrailingSlash: vi.fn().mockImplementation(url => url),
  };
});

vi.mock('./google-language-model', () => ({
  GoogleLanguageModel: vi.fn(),
}));

vi.mock('./google-embedding-model', () => ({
  GoogleEmbeddingModel: vi.fn(),
}));
vi.mock('./google-image-model', () => ({
  GoogleImageModel: vi.fn(),
}));
vi.mock('./google-video-model', () => ({
  GoogleVideoModel: vi.fn(),
}));
vi.mock('./google-speech-model', () => ({
  GoogleSpeechModel: vi.fn(),
}));
vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));
describe('google-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a language model with default settings', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider('gemini-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'gemini-pro',
      expect.objectContaining({
        provider: 'google.generative-ai',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: expect.any(Function),
        generateId: expect.any(Function),
        supportedUrls: expect.any(Function),
      }),
    );
  });

  it('should create an embedding model with correct settings', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider.embeddingModel('embedding-001');

    expect(GoogleEmbeddingModel).toHaveBeenCalledWith(
      'embedding-001',
      expect.objectContaining({
        provider: 'google.generative-ai',
        headers: expect.any(Function),
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      }),
    );
  });

  it('should pass custom headers to the model constructor', () => {
    const customHeaders = { 'Custom-Header': 'custom-value' };
    const provider = createGoogle({
      apiKey: 'test-api-key',
      headers: customHeaders,
    });
    provider('gemini-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.any(Function),
      }),
    );

    const options = (GoogleLanguageModel as any).mock.calls[0][1];
    const headers = options.headers();
    expect(headers).toEqual({
      'x-goog-api-key': 'test-api-key',
      'custom-header': 'custom-value',
      'user-agent': 'ai-sdk/google/0.0.0-test',
    });
  });

  it('should pass custom generateId function to the model constructor', () => {
    const customGenerateId = () => 'custom-id';
    const provider = createGoogle({
      apiKey: 'test-api-key',
      generateId: customGenerateId,
    });
    provider('gemini-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        generateId: customGenerateId,
      }),
    );
  });

  it('should use chat method to create a model', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider.chat('gemini-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'gemini-pro',
      expect.any(Object),
    );
  });

  it('should use custom baseURL when provided', () => {
    const customBaseURL = 'https://custom-endpoint.example.com';
    const provider = createGoogle({
      apiKey: 'test-api-key',
      baseURL: customBaseURL,
    });
    provider('gemini-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'gemini-pro',
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });

  it('should create an image model with default settings', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider.image('imagen-3.0-generate-002');

    expect(GoogleImageModel).toHaveBeenCalledWith(
      'imagen-3.0-generate-002',
      {},
      expect.objectContaining({
        provider: 'google.generative-ai',
        headers: expect.any(Function),
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      }),
    );
  });

  it('should create an image model with custom maxImagesPerCall', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    const imageSettings = {
      maxImagesPerCall: 3,
    };
    provider.image('imagen-3.0-generate-002', imageSettings);

    expect(GoogleImageModel).toHaveBeenCalledWith(
      'imagen-3.0-generate-002',
      imageSettings,
      expect.objectContaining({
        provider: 'google.generative-ai',
        headers: expect.any(Function),
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      }),
    );
  });

  it('should support deprecated methods', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });

    provider.generativeAI('gemini-pro');
    provider.embedding('embedding-001');
    provider.embeddingModel('embedding-001');

    expect(GoogleLanguageModel).toHaveBeenCalledTimes(1);
    expect(GoogleEmbeddingModel).toHaveBeenCalledTimes(2);
  });

  it('should include YouTube URLs in supportedUrls', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider('gemini-pro');

    const call = vi.mocked(GoogleLanguageModel).mock.calls[0];
    const supportedUrlsFunction = call[1].supportedUrls;

    expect(supportedUrlsFunction).toBeDefined();

    const supportedUrls = supportedUrlsFunction!() as Record<string, RegExp[]>;
    const patterns = supportedUrls['*'];

    expect(patterns).toBeDefined();
    expect(Array.isArray(patterns)).toBe(true);

    const testResults = {
      supportedUrls: [
        'https://generativelanguage.googleapis.com/v1beta/files/test123',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
      ].map(url => ({
        url,
        isSupported: patterns.some((pattern: RegExp) => pattern.test(url)),
      })),
      unsupportedUrls: [
        'https://example.com',
        'https://vimeo.com/123456789',
        'https://youtube.com/channel/UCdQw4w9WgXcQ',
      ].map(url => ({
        url,
        isSupported: patterns.some((pattern: RegExp) => pattern.test(url)),
      })),
    };

    expect(testResults).toMatchInlineSnapshot(`
      {
        "supportedUrls": [
          {
            "isSupported": true,
            "url": "https://generativelanguage.googleapis.com/v1beta/files/test123",
          },
          {
            "isSupported": true,
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          {
            "isSupported": true,
            "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
          },
          {
            "isSupported": true,
            "url": "https://youtu.be/dQw4w9WgXcQ",
          },
        ],
        "unsupportedUrls": [
          {
            "isSupported": false,
            "url": "https://example.com",
          },
          {
            "isSupported": false,
            "url": "https://vimeo.com/123456789",
          },
          {
            "isSupported": false,
            "url": "https://youtube.com/channel/UCdQw4w9WgXcQ",
          },
        ],
      }
    `);
  });

  it('should support documented external HTTPS URLs for Gemini models that accept external URLs', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider('gemini-3.5-flash');

    const call = vi.mocked(GoogleLanguageModel).mock.calls[0];
    const supportedUrlsFunction = call[1].supportedUrls;

    expect(supportedUrlsFunction).toBeDefined();

    const supportedUrls = supportedUrlsFunction!() as Record<string, RegExp[]>;

    const supportedExternalUrlMediaTypes = [
      'text/html',
      'text/css',
      'text/plain',
      'text/xml',
      'text/csv',
      'text/rtf',
      'text/javascript',
      'application/json',
      'application/pdf',
      'image/bmp',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/avi',
      'video/x-flv',
      'video/mpg',
      'video/webm',
      'video/wmv',
      'video/3gpp',
    ];

    for (const mediaType of supportedExternalUrlMediaTypes) {
      expect(
        isUrlSupported({
          url: 'https://example.com/file',
          mediaType,
          supportedUrls,
        }),
      ).toBe(true);
    }

    expect(
      isUrlSupported({
        url: 'http://example.com/file.txt',
        mediaType: 'text/plain',
        supportedUrls,
      }),
    ).toBe(false);

    expect(
      isUrlSupported({
        url: 'https://example.com/file.md',
        mediaType: 'text/markdown',
        supportedUrls,
      }),
    ).toBe(false);
  });

  it('should not support external HTTPS URLs for Gemini 2.0 models', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider('gemini-2.0-flash');

    const call = vi.mocked(GoogleLanguageModel).mock.calls[0];
    const supportedUrlsFunction = call[1].supportedUrls;

    expect(supportedUrlsFunction).toBeDefined();

    const supportedUrls = supportedUrlsFunction!() as Record<string, RegExp[]>;

    expect(
      isUrlSupported({
        url: 'https://example.com/file.txt',
        mediaType: 'text/plain',
        supportedUrls,
      }),
    ).toBe(false);
  });
});

describe('google provider - custom provider name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use custom provider name when specified', () => {
    const provider = createGoogle({
      name: 'my-gemini-proxy',
      apiKey: 'test-api-key',
    });

    provider('gemini-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'gemini-pro',
      expect.objectContaining({
        provider: 'my-gemini-proxy',
      }),
    );
  });

  it('should default to google.generative-ai when name not specified', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });

    provider('gemini-pro');

    expect(GoogleLanguageModel).toHaveBeenCalledWith(
      'gemini-pro',
      expect.objectContaining({
        provider: 'google.generative-ai',
      }),
    );
  });
});

describe('google provider - video', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a video model with default settings', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider.video('veo-3.1-generate-preview');

    expect(GoogleVideoModel).toHaveBeenCalledWith(
      'veo-3.1-generate-preview',
      expect.objectContaining({
        provider: 'google.generative-ai',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: expect.any(Function),
        generateId: expect.any(Function),
      }),
    );
  });

  it('should use custom baseURL for video model when provided', () => {
    const customBaseURL = 'https://custom-endpoint.example.com';
    const provider = createGoogle({
      apiKey: 'test-api-key',
      baseURL: customBaseURL,
    });
    provider.video('veo-3.1-generate');

    expect(GoogleVideoModel).toHaveBeenCalledWith(
      'veo-3.1-generate',
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });

  it('should pass custom generateId to video model', () => {
    const customGenerateId = () => 'custom-video-id';
    const provider = createGoogle({
      apiKey: 'test-api-key',
      generateId: customGenerateId,
    });
    provider.video('veo-3.1-generate-preview');

    expect(GoogleVideoModel).toHaveBeenCalledWith(
      'veo-3.1-generate-preview',
      expect.objectContaining({
        generateId: customGenerateId,
      }),
    );
  });
});

describe('google provider - speech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a speech model with default settings', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider.speech('gemini-2.5-flash-preview-tts');

    expect(GoogleSpeechModel).toHaveBeenCalledWith(
      'gemini-2.5-flash-preview-tts',
      expect.objectContaining({
        provider: 'google.generative-ai.speech',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: expect.any(Function),
      }),
    );
  });

  it('should create a speech model via speechModel()', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
    });
    provider.speechModel('gemini-2.5-pro-preview-tts');

    expect(GoogleSpeechModel).toHaveBeenCalledWith(
      'gemini-2.5-pro-preview-tts',
      expect.objectContaining({
        provider: 'google.generative-ai.speech',
      }),
    );
  });

  it('should use custom baseURL for speech model when provided', () => {
    const customBaseURL = 'https://custom-endpoint.example.com';
    const provider = createGoogle({
      apiKey: 'test-api-key',
      baseURL: customBaseURL,
    });
    provider.speech('gemini-2.5-flash-preview-tts');

    expect(GoogleSpeechModel).toHaveBeenCalledWith(
      'gemini-2.5-flash-preview-tts',
      expect.objectContaining({
        baseURL: customBaseURL,
      }),
    );
  });
});
