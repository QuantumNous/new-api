import { describe, it, expect } from 'vitest';
import { GatewayImageModel } from './gateway-image-model';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import type { GatewayConfig } from './gateway-config';

const TEST_MODEL_ID = 'google/imagen-4.0-generate';

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) => {
  return new GatewayImageModel(TEST_MODEL_ID, {
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

describe('GatewayImageModel', () => {
  const server = createTestServer({
    'https://api.test.com/image-model': {},
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      const model = createTestModel();

      expect(model.modelId).toBe(TEST_MODEL_ID);
      expect(model.provider).toBe('gateway');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should avoid client-side splitting even for BFL models', () => {
      const model = new GatewayImageModel('bfl/flux-pro-1.1', {
        provider: 'gateway',
        baseURL: 'https://api.test.com',
        headers: async () => ({}),
        fetch: globalThis.fetch,
        o11yHeaders: {},
      });

      expect(model.maxImagesPerCall).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should accept custom provider name', () => {
      const model = new GatewayImageModel(TEST_MODEL_ID, {
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
    function prepareJsonResponse({
      images = ['base64-image-1'],
      warnings,
      providerMetadata,
    }: {
      images?: string[];
      warnings?: Array<
        | { type: 'unsupported'; feature: string; details?: string }
        | { type: 'compatibility'; feature: string; details?: string }
        | { type: 'deprecated'; setting: string; message: string }
        | { type: 'other'; message: string }
      >;
      providerMetadata?: Record<string, unknown>;
    } = {}) {
      server.urls['https://api.test.com/image-model'].response = {
        type: 'json-value',
        body: {
          images,
          ...(warnings && { warnings }),
          ...(providerMetadata && { providerMetadata }),
        },
      };
    }

    it('should send correct request headers', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'A beautiful sunset over mountains',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        authorization: 'Bearer test-token',
        'ai-image-model-specification-version': '4',
        'ai-model-id': TEST_MODEL_ID,
      });
    });

    it('should send correct request body with all parameters', async () => {
      prepareJsonResponse({ images: ['base64-1', 'base64-2'] });

      const prompt = 'A cat playing piano';
      await createTestModel().doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        size: '1024x1024',
        aspectRatio: '16:9',
        seed: 42,
        providerOptions: {
          vertex: { safetySettings: 'block_none' },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toEqual({
        prompt,
        n: 2,
        size: '1024x1024',
        aspectRatio: '16:9',
        seed: 42,
        providerOptions: { vertex: { safetySettings: 'block_none' } },
      });
    });

    it('should omit optional parameters when not provided', async () => {
      prepareJsonResponse();

      const prompt = 'A simple prompt';
      await createTestModel().doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toEqual({
        prompt,
        n: 1,
        providerOptions: {},
      });
      expect(requestBody).not.toHaveProperty('size');
      expect(requestBody).not.toHaveProperty('aspectRatio');
      expect(requestBody).not.toHaveProperty('seed');
    });

    it('should return images array correctly', async () => {
      const mockImages = ['base64-image-1', 'base64-image-2'];
      prepareJsonResponse({ images: mockImages });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.images).toEqual(mockImages);
    });

    it('should return provider metadata correctly', async () => {
      const mockProviderMetadata = {
        vertex: {
          images: [
            { revisedPrompt: 'Revised prompt 1' },
            { revisedPrompt: 'Revised prompt 2' },
          ],
        },
        gateway: {
          routing: { provider: 'vertex' },
          cost: '0.08',
        },
      };

      prepareJsonResponse({
        images: ['base64-1', 'base64-2'],
        providerMetadata: mockProviderMetadata,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual(mockProviderMetadata);
    });

    it('should handle provider metadata without images field', async () => {
      prepareJsonResponse({
        images: ['base64-1'],
        providerMetadata: {
          gateway: {
            routing: { provider: 'vertex' },
            cost: '0.04',
          },
        },
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({
        gateway: {
          routing: { provider: 'vertex' },
          cost: '0.04',
        },
      });
    });

    it('should handle empty provider metadata', async () => {
      prepareJsonResponse({
        images: ['base64-1'],
        providerMetadata: {},
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({});
    });

    it('should handle undefined provider metadata', async () => {
      prepareJsonResponse({
        images: ['base64-1'],
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toBeUndefined();
    });

    it('should return warnings when provided', async () => {
      const mockWarnings = [
        { type: 'other' as const, message: 'Setting not supported' },
      ];

      prepareJsonResponse({
        images: ['base64-1'],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should return deprecated warnings correctly', async () => {
      const mockWarnings = [
        {
          type: 'deprecated' as const,
          setting: 'size',
          message: 'Use `aspectRatio` instead.',
        },
      ];

      prepareJsonResponse({
        images: ['base64-1'],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should return unsupported warnings correctly', async () => {
      const mockWarnings = [
        {
          type: 'unsupported' as const,
          feature: 'size',
          details:
            'This model does not support the `size` option. Use `aspectRatio` instead.',
        },
      ];

      prepareJsonResponse({
        images: ['base64-1'],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x1024',
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should return compatibility warnings correctly', async () => {
      const mockWarnings = [
        {
          type: 'compatibility' as const,
          feature: 'seed',
          details: 'Seed support is approximate for this model.',
        },
      ];

      prepareJsonResponse({
        images: ['base64-1'],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: 42,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should handle mixed warning types', async () => {
      const mockWarnings = [
        {
          type: 'unsupported' as const,
          feature: 'size',
        },
        {
          type: 'compatibility' as const,
          feature: 'seed',
          details: 'Approximate seed support.',
        },
        {
          type: 'other' as const,
          message: 'Rate limit approaching.',
        },
      ];

      prepareJsonResponse({
        images: ['base64-1'],
        warnings: mockWarnings,
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x1024',
        aspectRatio: undefined,
        seed: 42,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(mockWarnings);
    });

    it('should return empty warnings array when not provided', async () => {
      prepareJsonResponse({
        images: ['base64-1'],
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual([]);
    });

    it('should include response metadata', async () => {
      prepareJsonResponse({
        images: ['base64-1'],
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.response.modelId).toBe(TEST_MODEL_ID);
      expect(result.response.timestamp).toBeInstanceOf(Date);
      expect(result.response.headers).toBeDefined();
    });

    it('should return usage when provided', async () => {
      server.urls['https://api.test.com/image-model'].response = {
        type: 'json-value',
        body: {
          images: ['base64-1'],
          usage: {
            inputTokens: 27,
            outputTokens: 6240,
            totalTokens: 6267,
          },
        },
      };

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.usage).toEqual({
        inputTokens: 27,
        outputTokens: 6240,
        totalTokens: 6267,
      });
    });

    it('should return usage with partial token counts', async () => {
      server.urls['https://api.test.com/image-model'].response = {
        type: 'json-value',
        body: {
          images: ['base64-1'],
          usage: {
            inputTokens: 10,
          },
        },
      };

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: undefined,
        totalTokens: undefined,
      });
    });

    it('should not include usage when not provided', async () => {
      prepareJsonResponse({
        images: ['base64-1'],
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.usage).toBeUndefined();
    });

    it('should merge custom headers with config headers', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        headers: {
          'X-Custom-Header': 'custom-value',
        },
        providerOptions: {},
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        authorization: 'Bearer test-token',
        'x-custom-header': 'custom-value',
        'ai-image-model-specification-version': '4',
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
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
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
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        abortSignal: abortController.signal,
        providerOptions: {},
      });

      expect(server.calls.length).toBe(1);
    });

    it('should handle API errors correctly', async () => {
      server.urls['https://api.test.com/image-model'].response = {
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
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      server.urls['https://api.test.com/image-model'].response = {
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
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow();
    });

    it('should include providerOptions object in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          vertex: {
            safetySettings: 'block_none',
          },
          openai: {
            style: 'vivid',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toEqual({
        prompt: 'Test prompt',
        n: 1,
        providerOptions: {
          vertex: {
            safetySettings: 'block_none',
          },
          openai: {
            style: 'vivid',
          },
        },
      });
    });

    it('should handle empty provider options', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
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

      const customModelId = 'openai/dall-e-3';
      const model = new GatewayImageModel(customModelId, {
        provider: 'gateway',
        baseURL: 'https://api.test.com',
        headers: async () => ({}),
        fetch: globalThis.fetch,
        o11yHeaders: {},
      });

      await model.doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        'ai-model-id': customModelId,
      });
    });

    it('should handle complex provider metadata with multiple providers', async () => {
      prepareJsonResponse({
        images: ['base64-1', 'base64-2'],
        providerMetadata: {
          vertex: {
            images: [
              { revisedPrompt: 'Revised 1' },
              { revisedPrompt: 'Revised 2' },
            ],
            usage: { tokens: 150 },
          },
          gateway: {
            routing: {
              provider: 'vertex',
              attempts: [
                { provider: 'openai', success: false },
                { provider: 'vertex', success: true },
              ],
            },
            cost: '0.08',
            marketCost: '0.12',
            generationId: 'gen-xyz-789',
          },
        },
      });

      const result = await createTestModel().doGenerate({
        prompt: 'Test prompt',
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({
        vertex: {
          images: [
            { revisedPrompt: 'Revised 1' },
            { revisedPrompt: 'Revised 2' },
          ],
          usage: { tokens: 150 },
        },
        gateway: {
          routing: {
            provider: 'vertex',
            attempts: [
              { provider: 'openai', success: false },
              { provider: 'vertex', success: true },
            ],
          },
          cost: '0.08',
          marketCost: '0.12',
          generationId: 'gen-xyz-789',
        },
      });
    });

    describe('file encoding', () => {
      it('should encode Uint8Array files to base64 strings', async () => {
        prepareJsonResponse();

        const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

        await createTestModel().doGenerate({
          prompt: 'Edit this image',
          files: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: binaryData,
            },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.files).toHaveLength(1);
        expect(requestBody.files[0]).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'SGVsbG8=', // "Hello" in base64
        });
      });

      it('should pass through files with string data unchanged', async () => {
        prepareJsonResponse();

        await createTestModel().doGenerate({
          prompt: 'Edit this image',
          files: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: 'already-base64-encoded',
            },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.files).toHaveLength(1);
        expect(requestBody.files[0]).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'already-base64-encoded',
        });
      });

      it('should pass through URL-type files unchanged', async () => {
        prepareJsonResponse();

        await createTestModel().doGenerate({
          prompt: 'Edit this image',
          files: [
            {
              type: 'url',
              url: 'https://example.com/image.png',
            },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.files).toHaveLength(1);
        expect(requestBody.files[0]).toEqual({
          type: 'url',
          url: 'https://example.com/image.png',
        });
      });

      it('should encode Uint8Array mask to base64 string', async () => {
        prepareJsonResponse();

        const maskData = new Uint8Array([255, 0, 255, 0]); // Simple mask

        await createTestModel().doGenerate({
          prompt: 'Inpaint this area',
          files: undefined,
          mask: {
            type: 'file',
            mediaType: 'image/png',
            data: maskData,
          },
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.mask).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: '/wD/AA==', // [255, 0, 255, 0] in base64
        });
      });

      it('should handle mixed file types with encoding', async () => {
        prepareJsonResponse();

        const binaryData = new Uint8Array([1, 2, 3]);

        await createTestModel().doGenerate({
          prompt: 'Edit these images',
          files: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: binaryData,
            },
            {
              type: 'file',
              mediaType: 'image/jpeg',
              data: 'already-encoded',
            },
            {
              type: 'url',
              url: 'https://example.com/image.png',
            },
          ],
          mask: {
            type: 'file',
            mediaType: 'image/png',
            data: new Uint8Array([4, 5, 6]),
          },
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.files).toHaveLength(3);
        expect(requestBody.files[0]).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'AQID', // [1, 2, 3] in base64
        });
        expect(requestBody.files[1]).toEqual({
          type: 'file',
          mediaType: 'image/jpeg',
          data: 'already-encoded',
        });
        expect(requestBody.files[2]).toEqual({
          type: 'url',
          url: 'https://example.com/image.png',
        });
        expect(requestBody.mask).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'BAUG', // [4, 5, 6] in base64
        });
      });

      it('should preserve providerOptions on files during encoding', async () => {
        prepareJsonResponse();

        const binaryData = new Uint8Array([72, 101, 108, 108, 111]);

        await createTestModel().doGenerate({
          prompt: 'Edit this image',
          files: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: binaryData,
              providerOptions: { openai: { quality: 'hd' } },
            },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.files[0]).toEqual({
          type: 'file',
          mediaType: 'image/png',
          data: 'SGVsbG8=',
          providerOptions: { openai: { quality: 'hd' } },
        });
      });
    });
  });
});
