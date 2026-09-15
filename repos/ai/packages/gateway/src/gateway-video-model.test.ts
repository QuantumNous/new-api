import { describe, it, expect } from 'vitest';
import { GatewayVideoModel } from './gateway-video-model';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import type { GatewayConfig } from './gateway-config';

const TEST_MODEL_ID = 'google/veo-2.0-generate-001';

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) => {
  return new GatewayVideoModel(TEST_MODEL_ID, {
    provider: 'gateway',
    baseURL: 'https://api.test.com',
    headers: () => ({
      Authorization: 'Bearer test-token',
      'ai-gateway-auth-method': 'api-key',
    }),
    fetch: globalThis.fetch,
    o11yHeaders: config.o11yHeaders || {},
    ...config,
  });
};

describe('GatewayVideoModel', () => {
  const server = createTestServer({
    'https://api.test.com/video-model': {},
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      const model = createTestModel();

      expect(model.modelId).toBe(TEST_MODEL_ID);
      expect(model.provider).toBe('gateway');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should avoid client-side splitting for video models', () => {
      const model = new GatewayVideoModel('fal/luma-ray-2', {
        provider: 'gateway',
        baseURL: 'https://api.test.com',
        headers: async () => ({}),
        fetch: globalThis.fetch,
        o11yHeaders: {},
      });

      expect(model.maxVideosPerCall).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should accept custom provider name', () => {
      const model = new GatewayVideoModel(TEST_MODEL_ID, {
        provider: 'custom-gateway',
        baseURL: 'https://api.test.com',
        headers: async () => ({}),
        fetch: globalThis.fetch,
        o11yHeaders: {},
      });

      expect(model.provider).toBe('custom-gateway');
    });
  });

  describe('doGenerate', () => {
    type VideoData =
      | { type: 'url'; url: string; mediaType: string }
      | { type: 'base64'; data: string; mediaType: string };

    function prepareJsonResponse({
      videos = [
        {
          type: 'base64' as const,
          data: 'base64-video-1',
          mediaType: 'video/mp4',
        },
      ],
      warnings,
      providerMetadata,
    }: {
      videos?: VideoData[];
      warnings?: Array<
        | { type: 'unsupported'; feature: string; details?: string }
        | { type: 'compatibility'; feature: string; details?: string }
        | { type: 'other'; message: string }
      >;
      providerMetadata?: Record<string, unknown>;
    } = {}) {
      const ssePayload = {
        type: 'result',
        videos,
        ...(warnings && { warnings }),
        ...(providerMetadata && { providerMetadata }),
      };
      server.urls['https://api.test.com/video-model'].response = {
        type: 'stream-chunks',
        chunks: [`data: ${JSON.stringify(ssePayload)}\n\n`],
      };
    }

    it('should send correct request headers', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'A beautiful sunset over mountains',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        authorization: 'Bearer test-token',
        'ai-video-model-specification-version': '4',
        'ai-model-id': TEST_MODEL_ID,
      });
    });

    it('should send correct request body with all parameters', async () => {
      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
      });

      const prompt = 'A cat playing piano';
      await createTestModel().doGenerate({
        prompt,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: '16:9',
        resolution: '1920x1080',
        duration: 5,
        fps: 24,
        seed: 42,
        generateAudio: true,
        providerOptions: {
          fal: { motionStrength: 0.8 },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toEqual({
        prompt,
        n: 1,
        aspectRatio: '16:9',
        resolution: '1920x1080',
        duration: 5,
        fps: 24,
        seed: 42,
        generateAudio: true,
        providerOptions: { fal: { motionStrength: 0.8 } },
      });
    });

    it('should omit optional parameters when not provided', async () => {
      prepareJsonResponse();

      const prompt = 'A simple prompt';
      await createTestModel().doGenerate({
        prompt,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toEqual({
        prompt,
        n: 1,
        providerOptions: {},
      });
      expect(requestBody).not.toHaveProperty('aspectRatio');
      expect(requestBody).not.toHaveProperty('resolution');
      expect(requestBody).not.toHaveProperty('duration');
      expect(requestBody).not.toHaveProperty('fps');
      expect(requestBody).not.toHaveProperty('seed');
      expect(requestBody).not.toHaveProperty('generateAudio');
    });

    it('should return videos array correctly', async () => {
      const mockVideos: VideoData[] = [
        { type: 'base64', data: 'base64-video-1', mediaType: 'video/mp4' },
        { type: 'base64', data: 'base64-video-2', mediaType: 'video/webm' },
      ];
      prepareJsonResponse({ videos: mockVideos });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 2,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.videos).toEqual(mockVideos);
    });

    it('should return URL-type videos correctly', async () => {
      const mockVideos: VideoData[] = [
        {
          type: 'url',
          url: 'https://example.com/video.mp4',
          mediaType: 'video/mp4',
        },
      ];
      prepareJsonResponse({ videos: mockVideos });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.videos).toEqual(mockVideos);
    });

    it('should return provider metadata correctly', async () => {
      const mockProviderMetadata = {
        fal: {
          videos: [{ duration: 5.0, fps: 24, width: 1280, height: 720 }],
        },
        gateway: {
          routing: { provider: 'fal' },
          cost: '0.15',
        },
      };

      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
        providerMetadata: mockProviderMetadata,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual(mockProviderMetadata);
    });

    it('should handle provider metadata without videos field', async () => {
      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
        providerMetadata: {
          gateway: {
            routing: { provider: 'google' },
            cost: '0.10',
          },
        },
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({
        gateway: {
          routing: { provider: 'google' },
          cost: '0.10',
        },
      });
    });

    it('should handle empty provider metadata', async () => {
      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
        providerMetadata: {},
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({});
    });

    it('should handle undefined provider metadata', async () => {
      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toBeUndefined();
    });

    it('should return warnings when provided', async () => {
      const mockWarnings = [
        { type: 'other' as const, message: 'Duration exceeds maximum' },
      ];

      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should return unsupported warnings correctly', async () => {
      const mockWarnings = [
        {
          type: 'unsupported' as const,
          feature: 'aspectRatio',
          details:
            'KlingAI image-to-video does not support aspectRatio. The output dimensions are determined by the input image.',
        },
      ];

      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should return compatibility warnings correctly', async () => {
      const mockWarnings = [
        {
          type: 'compatibility' as const,
          feature: 'resolution',
          details: 'Resolution was adjusted to nearest supported value.',
        },
      ];

      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should return empty warnings array when not provided', async () => {
      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual([]);
    });

    it('should include response metadata', async () => {
      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.response.modelId).toBe(TEST_MODEL_ID);
      expect(result.response.timestamp).toBeInstanceOf(Date);
      expect(result.response.headers).toBeDefined();
    });

    it('should merge custom headers with config headers', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        headers: {
          'X-Custom-Header': 'custom-value',
        },
        providerOptions: {},
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        authorization: 'Bearer test-token',
        'x-custom-header': 'custom-value',
        'ai-video-model-specification-version': '4',
        'ai-model-id': TEST_MODEL_ID,
      });
    });

    it('should include o11y headers', async () => {
      prepareJsonResponse();

      await createTestModel({
        o11yHeaders: {
          'ai-o11y-deployment-id': 'dpl_123',
          'ai-o11y-environment': 'production',
        },
      }).doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        'ai-o11y-deployment-id': 'dpl_123',
        'ai-o11y-environment': 'production',
      });
    });

    it('should pass abort signal to fetch', async () => {
      prepareJsonResponse();

      const abortController = new AbortController();
      await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        abortSignal: abortController.signal,
        providerOptions: {},
      });

      expect(server.calls.length).toBe(1);
    });

    it('should handle API errors correctly', async () => {
      server.urls['https://api.test.com/video-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid request',
            code: 'invalid_request',
          },
        }),
      };

      await expect(
        createTestModel().doGenerate({
          prompt: 'Test prompt',
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      server.urls['https://api.test.com/video-model'].response = {
        type: 'error',
        status: 401,
        body: JSON.stringify({
          error: {
            message: 'Unauthorized',
            code: 'unauthorized',
          },
        }),
      };

      await expect(
        createTestModel().doGenerate({
          prompt: 'Test prompt',
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow();
    });

    it('should throw on SSE error event with correct message and status', async () => {
      server.urls['https://api.test.com/video-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: ${JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded',
            errorType: 'rate_limit_exceeded',
            statusCode: 429,
            param: null,
          })}\n\n`,
        ],
      };

      await expect(
        createTestModel().doGenerate({
          prompt: 'Test prompt',
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should throw on SSE error event with provider routing failure', async () => {
      server.urls['https://api.test.com/video-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: ${JSON.stringify({
            type: 'error',
            message: 'All providers failed',
            errorType: 'internal_server_error',
            statusCode: 500,
            param: null,
          })}\n\n`,
        ],
      };

      await expect(
        createTestModel().doGenerate({
          prompt: 'Test prompt',
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow('All providers failed');
    });

    it('should throw on empty SSE stream', async () => {
      server.urls['https://api.test.com/video-model'].response = {
        type: 'stream-chunks',
        chunks: [],
      };

      await expect(
        createTestModel().doGenerate({
          prompt: 'Test prompt',
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow();
    });

    it('should ignore SSE heartbeat comments and parse data event', async () => {
      const videos = [
        { type: 'base64' as const, data: 'base64-1', mediaType: 'video/mp4' },
      ];
      server.urls['https://api.test.com/video-model'].response = {
        type: 'stream-chunks',
        chunks: [
          ':\n\n',
          ':\n\n',
          `data: ${JSON.stringify({ type: 'result', videos })}\n\n`,
        ],
      };

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.videos).toEqual(videos);
    });

    it('should include providerOptions object in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {
          fal: {
            motionStrength: 0.8,
            loop: true,
          },
          google: {
            enhancePrompt: true,
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toEqual({
        prompt: 'Test prompt',
        n: 1,
        providerOptions: {
          fal: {
            motionStrength: 0.8,
            loop: true,
          },
          google: {
            enhancePrompt: true,
          },
        },
      });
    });

    it('should handle empty provider options', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toEqual({
        prompt: 'Test prompt',
        n: 1,
        providerOptions: {},
      });
    });

    it('should handle different model IDs', async () => {
      prepareJsonResponse();

      const customModelId = 'fal/luma-ray-2';
      const model = new GatewayVideoModel(customModelId, {
        provider: 'gateway',
        baseURL: 'https://api.test.com',
        headers: async () => ({}),
        fetch: globalThis.fetch,
        o11yHeaders: {},
      });

      await model.doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        'ai-model-id': customModelId,
      });
    });

    it('should handle complex provider metadata with multiple providers', async () => {
      prepareJsonResponse({
        videos: [{ type: 'base64', data: 'base64-1', mediaType: 'video/mp4' }],
        providerMetadata: {
          fal: {
            videos: [{ duration: 5.0, fps: 24, width: 1920, height: 1080 }],
            usage: { computeUnits: 10 },
          },
          gateway: {
            routing: {
              provider: 'fal',
              attempts: [
                { provider: 'google', success: false },
                { provider: 'fal', success: true },
              ],
            },
            cost: '0.20',
            marketCost: '0.30',
            generationId: 'gen-xyz-789',
          },
        },
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({
        fal: {
          videos: [{ duration: 5.0, fps: 24, width: 1920, height: 1080 }],
          usage: { computeUnits: 10 },
        },
        gateway: {
          routing: {
            provider: 'fal',
            attempts: [
              { provider: 'google', success: false },
              { provider: 'fal', success: true },
            ],
          },
          cost: '0.20',
          marketCost: '0.30',
          generationId: 'gen-xyz-789',
        },
      });
    });

    describe('image file encoding for image-to-video', () => {
      it('should encode Uint8Array image to base64 string', async () => {
        prepareJsonResponse();

        const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

        await createTestModel().doGenerate({
          prompt: 'Animate this image',
          image: {
            type: 'file',
            mediaType: 'image/png',
            data: binaryData,
          },
          n: 1,
          frameImages: undefined,
          inputReferences: undefined,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.image).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'SGVsbG8=', // "Hello" in base64
        });
      });

      it('should pass through image with string data unchanged', async () => {
        prepareJsonResponse();

        await createTestModel().doGenerate({
          prompt: 'Animate this image',
          image: {
            type: 'file',
            mediaType: 'image/png',
            data: 'already-base64-encoded',
          },
          n: 1,
          frameImages: undefined,
          inputReferences: undefined,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.image).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'already-base64-encoded',
        });
      });

      it('should pass through URL-type image unchanged', async () => {
        prepareJsonResponse();

        await createTestModel().doGenerate({
          prompt: 'Animate this image',
          image: {
            type: 'url',
            url: 'https://example.com/image.png',
          },
          n: 1,
          frameImages: undefined,
          inputReferences: undefined,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.image).toEqual({
          type: 'url',
          url: 'https://example.com/image.png',
        });
      });

      it('should preserve providerOptions on image during encoding', async () => {
        prepareJsonResponse();

        const binaryData = new Uint8Array([72, 101, 108, 108, 111]);

        await createTestModel().doGenerate({
          prompt: 'Animate this image',
          image: {
            type: 'file',
            mediaType: 'image/png',
            data: binaryData,
            providerOptions: { fal: { enhanceImage: true } },
          },
          n: 1,
          frameImages: undefined,
          inputReferences: undefined,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.image).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'SGVsbG8=',
          providerOptions: { fal: { enhanceImage: true } },
        });
      });
    });

    describe('frameImages and inputReferences encoding', () => {
      it('should encode frameImages with Uint8Array data to base64', async () => {
        prepareJsonResponse();

        const binaryData = new Uint8Array([72, 101, 108, 108, 111]);

        await createTestModel().doGenerate({
          prompt: 'Animate between frames',
          image: undefined,
          frameImages: [
            {
              frameType: 'first_frame',
              image: {
                type: 'file',
                mediaType: 'image/png',
                data: binaryData,
              },
            },
            {
              frameType: 'last_frame',
              image: {
                type: 'url',
                url: 'https://example.com/last-frame.png',
              },
            },
          ],
          inputReferences: undefined,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.frameImages).toEqual([
          {
            frameType: 'first_frame',
            image: {
              type: 'file',
              mediaType: 'image/png',
              data: 'SGVsbG8=',
            },
          },
          {
            frameType: 'last_frame',
            image: {
              type: 'url',
              url: 'https://example.com/last-frame.png',
            },
          },
        ]);
      });

      it('should encode inputReferences with Uint8Array data to base64', async () => {
        prepareJsonResponse();

        const binaryData = new Uint8Array([72, 101, 108, 108, 111]);

        await createTestModel().doGenerate({
          prompt: 'Generate from references',
          image: undefined,
          frameImages: undefined,
          inputReferences: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: binaryData,
            },
            {
              type: 'url',
              url: 'https://example.com/reference.png',
            },
          ],
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.inputReferences).toEqual([
          {
            type: 'file',
            mediaType: 'image/png',
            data: 'SGVsbG8=',
          },
          {
            type: 'url',
            url: 'https://example.com/reference.png',
          },
        ]);
      });

      it('should omit frameImages and inputReferences when not provided', async () => {
        prepareJsonResponse();

        await createTestModel().doGenerate({
          prompt: 'Text to video',
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody).not.toHaveProperty('frameImages');
        expect(requestBody).not.toHaveProperty('inputReferences');
      });
    });
  });
});
