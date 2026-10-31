import type { ImageModelV4CallOptions } from '@ai-sdk/provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { ByteDanceImageModel } from './bytedance-image-model';

const prompt = 'A salamander in a forest pond at dusk surrounded by fireflies';

function createBasicModel({
  headers,
  fetch,
  currentDate,
}: {
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
} = {}) {
  return new ByteDanceImageModel('seedream-5-0-260128', {
    provider: 'bytedance.image',
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-key' })),
    fetch,
    _internal: {
      currentDate,
    },
  });
}

function createDefaultGenerateParams(overrides = {}): ImageModelV4CallOptions {
  return {
    prompt,
    files: undefined,
    mask: undefined,
    n: 1,
    size: undefined,
    aspectRatio: undefined,
    seed: undefined,
    providerOptions: {},
    headers: {},
    abortSignal: undefined,
    ...overrides,
  };
}

describe('ByteDanceImageModel', () => {
  const server = createTestServer({
    'https://api.example.com/images/generations': {
      response: {
        type: 'json-value',
        body: {
          data: [{ b64_json: 'test1234' }, { b64_json: 'test5678' }],
        },
      },
    },
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('bytedance.image');
      expect(model.modelId).toBe('seedream-5-0-260128');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });

  describe('doGenerate', () => {
    it('should send a JSON text-to-image request to /images/generations', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          size: '2048x2048',
          providerOptions: { bytedance: { watermark: false } },
        }),
      );

      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/images/generations',
      );
      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedream-5-0-260128',
        prompt,
        size: '2048x2048',
        watermark: false,
        response_format: 'b64_json',
      });
    });

    it('should map typed provider options to ByteDance request fields', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          providerOptions: {
            bytedance: {
              sequentialImageGeneration: 'auto',
              maxImages: 4,
              outputFormat: 'png',
              optimizePromptMode: 'fast',
            },
          },
        }),
      );

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedream-5-0-260128',
        prompt,
        sequential_image_generation: 'auto',
        sequential_image_generation_options: { max_images: 4 },
        output_format: 'png',
        optimize_prompt_options: { mode: 'fast' },
        response_format: 'b64_json',
      });
    });

    it('should let a resolution-level size override the top-level pixel size', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          size: '2048x2048',
          providerOptions: { bytedance: { size: '2K' } },
        }),
      );

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        size: '2K',
      });
    });

    it('should pass through unknown provider options unchanged', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          providerOptions: { bytedance: { seed: 42 } },
        }),
      );

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        seed: 42,
      });
    });

    it('should warn for unsupported settings (aspectRatio, seed, mask)', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          aspectRatio: '16:9',
          seed: 123,
          mask: {
            type: 'file',
            data: new Uint8Array([1]),
            mediaType: 'image/png',
          },
        }),
      );

      expect(
        result.warnings.map(w => ('feature' in w ? w.feature : w.type)),
      ).toStrictEqual(['aspectRatio', 'seed', 'mask']);
    });

    it('should pass headers', async () => {
      const model = createBasicModel({
        headers: () => ({ 'Custom-Provider-Header': 'provider-header-value' }),
      });

      await model.doGenerate(
        createDefaultGenerateParams({
          headers: { 'Custom-Request-Header': 'request-header-value' },
        }),
      );

      expect(server.calls[0].requestHeaders).toStrictEqual({
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
    });

    it('should handle API errors', async () => {
      server.urls['https://api.example.com/images/generations'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid prompt content',
            code: 'InvalidParameter',
          },
        }),
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate(createDefaultGenerateParams()),
      ).rejects.toMatchObject({
        message: 'Invalid prompt content',
        statusCode: 400,
        url: 'https://api.example.com/images/generations',
      });
    });

    it('should return the raw b64_json content', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate(createDefaultGenerateParams());

      expect(result.images).toStrictEqual(['test1234', 'test5678']);
    });

    it('should include timestamp, headers and modelId in response', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createBasicModel({ currentDate: () => testDate });

      const result = await model.doGenerate(createDefaultGenerateParams());

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'seedream-5-0-260128',
        headers: expect.any(Object),
      });
    });
  });

  describe('image editing', () => {
    it('should send a single input image as the `image` field on /images/generations', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          prompt: 'Change the salamander to a snow weasel',
          files: [
            {
              type: 'file',
              data: new Uint8Array([137, 80, 78, 71]),
              mediaType: 'image/png',
            },
          ],
        }),
      );

      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/images/generations',
      );
      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedream-5-0-260128',
        prompt: 'Change the salamander to a snow weasel',
        image: 'data:image/png;base64,iVBORw==',
        response_format: 'b64_json',
      });
      expect(result.images).toStrictEqual(['test1234', 'test5678']);
    });

    it('should send multiple input images as an array in the `image` field', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          prompt: 'Combine these images',
          files: [
            {
              type: 'file',
              data: new Uint8Array([137, 80, 78, 71]),
              mediaType: 'image/png',
            },
            {
              type: 'file',
              data: new Uint8Array([137, 80, 78, 71]),
              mediaType: 'image/png',
            },
          ],
        }),
      );

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedream-5-0-260128',
        prompt: 'Combine these images',
        image: [
          'data:image/png;base64,iVBORw==',
          'data:image/png;base64,iVBORw==',
        ],
        response_format: 'b64_json',
      });
    });

    it('should pass a URL input image through unchanged', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          prompt: 'Edit this',
          files: [{ type: 'url', url: 'https://example.com/input.png' }],
        }),
      );

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        image: 'https://example.com/input.png',
      });
    });
  });
});
