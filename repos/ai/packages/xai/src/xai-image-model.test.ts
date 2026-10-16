import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { XaiImageModel } from './xai-image-model';

const prompt = 'A cute baby sea otter';

const imageUrl = 'https://api.example.com/images/generated.png';

function createModel({
  headers,
  currentDate,
}: {
  headers?: () => Record<string, string>;
  currentDate?: () => Date;
} = {}) {
  return new XaiImageModel('grok-imagine-image', {
    provider: 'xai.image',
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ 'api-key': 'test-key' })),
    _internal: {
      currentDate,
    },
  });
}

describe('XaiImageModel', () => {
  const server = createTestServer({
    'https://api.example.com/images/generations': {
      response: {
        type: 'json-value',
        body: {
          data: [{ b64_json: 'dGVzdA==' }],
        },
      },
    },
    'https://api.example.com/images/edits': {
      response: {
        type: 'json-value',
        body: {
          data: [{ b64_json: 'dGVzdA==' }],
        },
      },
    },
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createModel();

      expect(model.provider).toBe('xai.image');
      expect(model.modelId).toBe('grok-imagine-image');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(3);
    });
  });

  describe('doGenerate', () => {
    it('should send correct parameters for generation', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/images/generations',
      );
      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt,
        n: 1,
        response_format: 'b64_json',
        aspect_ratio: '16:9',
      });
    });

    it('should send correct parameters for editing', async () => {
      const model = createModel();
      const imageData = new Uint8Array([137, 80, 78, 71]);

      await model.doGenerate({
        prompt: 'Turn the cat into a dog',
        files: [
          {
            type: 'file',
            data: imageData,
            mediaType: 'image/png',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/images/edits',
      );
      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt: 'Turn the cat into a dog',
        n: 1,
        response_format: 'b64_json',
        image: {
          url: 'data:image/png;base64,iVBORw==',
          type: 'image_url',
        },
      });
    });

    it('should send URL-based file as image_url', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt: 'Edit this image',
        files: [
          {
            type: 'url',
            url: 'https://example.com/input.png',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt: 'Edit this image',
        n: 1,
        response_format: 'b64_json',
        image: {
          url: 'https://example.com/input.png',
          type: 'image_url',
        },
      });
    });

    it('should send base64 file as data URI', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt: 'Edit this image',
        files: [
          {
            type: 'file',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAE=',
            mediaType: 'image/png',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt: 'Edit this image',
        n: 1,
        response_format: 'b64_json',
        image: {
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=',
          type: 'image_url',
        },
      });
    });

    it('should send multiple files as images array', async () => {
      const model = createModel();
      const imageData1 = new Uint8Array([137, 80, 78, 71]);
      const imageData2 = new Uint8Array([255, 216, 255, 224]);

      await model.doGenerate({
        prompt: 'Combine these images',
        files: [
          {
            type: 'file',
            data: imageData1,
            mediaType: 'image/png',
          },
          {
            type: 'file',
            data: imageData2,
            mediaType: 'image/jpeg',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/images/edits',
      );
      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt: 'Combine these images',
        n: 1,
        response_format: 'b64_json',
        images: [
          {
            url: 'data:image/png;base64,iVBORw==',
            type: 'image_url',
          },
          {
            url: 'data:image/jpeg;base64,/9j/4A==',
            type: 'image_url',
          },
        ],
      });
    });

    it('should send mixed file types as images array', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt: 'Combine these images',
        files: [
          {
            type: 'url',
            url: 'https://example.com/input.png',
          },
          {
            type: 'file',
            data: new Uint8Array([137, 80, 78, 71]),
            mediaType: 'image/png',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt: 'Combine these images',
        n: 1,
        response_format: 'b64_json',
        images: [
          {
            url: 'https://example.com/input.png',
            type: 'image_url',
          },
          {
            url: 'data:image/png;base64,iVBORw==',
            type: 'image_url',
          },
        ],
      });
    });

    it('should return base64 images from b64_json response', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('dGVzdA==');
    });

    it('should pass headers', async () => {
      const model = createModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-header-value',
        }),
      });

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      expect(server.calls[0].requestHeaders).toStrictEqual({
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
    });

    it('should pass provider options', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          xai: {
            output_format: 'jpeg',
            sync_mode: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt,
        n: 1,
        response_format: 'b64_json',
        output_format: 'jpeg',
        sync_mode: true,
      });
    });

    it('should pass resolution provider option', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          xai: {
            resolution: '2k',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt,
        n: 1,
        response_format: 'b64_json',
        resolution: '2k',
      });
    });

    it('should pass quality provider option', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          xai: {
            quality: 'high',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt,
        n: 1,
        response_format: 'b64_json',
        quality: 'high',
      });
    });

    it('should pass user provider option', async () => {
      const model = createModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          xai: {
            user: 'example-user-123',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-image',
        prompt,
        n: 1,
        response_format: 'b64_json',
        user: 'example-user-123',
      });
    });

    it('should include revised_prompt in providerMetadata', async () => {
      server.urls['https://api.example.com/images/generations'].response = {
        type: 'json-value',
        body: {
          data: [{ b64_json: 'dGVzdA==', revised_prompt: 'A revised prompt' }],
        },
      };

      const model = createModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toStrictEqual({
        xai: {
          images: [{ revisedPrompt: 'A revised prompt' }],
        },
      });
    });

    describe('response metadata', () => {
      it('should include timestamp, headers and modelId in response', async () => {
        const testDate = new Date('2024-01-01T00:00:00Z');
        const model = createModel({
          currentDate: () => testDate,
        });

        const result = await model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        expect(result.response).toStrictEqual({
          timestamp: testDate,
          modelId: 'grok-imagine-image',
          headers: expect.any(Object),
        });
      });
    });

    describe('warnings', () => {
      it('should warn when size is provided', async () => {
        const model = createModel();

        const result = await model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: '1024x1024',
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        expect(result.warnings).toContainEqual({
          type: 'unsupported',
          feature: 'size',
          details:
            'This model does not support the `size` option. Use `aspectRatio` instead.',
        });
      });

      it('should warn when seed is provided', async () => {
        const model = createModel();

        const result = await model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: 42,
          providerOptions: {},
        });

        expect(result.warnings).toContainEqual({
          type: 'unsupported',
          feature: 'seed',
        });
      });

      it('should warn when mask is provided', async () => {
        const model = createModel();

        const result = await model.doGenerate({
          prompt: 'Edit this',
          files: [
            {
              type: 'file',
              data: new Uint8Array([137, 80, 78, 71]),
              mediaType: 'image/png',
            },
          ],
          mask: {
            type: 'file',
            data: new Uint8Array([255, 255, 255, 0]),
            mediaType: 'image/png',
          },
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        expect(result.warnings).toContainEqual({
          type: 'unsupported',
          feature: 'mask',
        });
      });

      it('should not warn when multiple files are provided', async () => {
        const model = createModel();
        const imageData = new Uint8Array([137, 80, 78, 71]);

        const result = await model.doGenerate({
          prompt: 'Edit images',
          files: [
            {
              type: 'file',
              data: imageData,
              mediaType: 'image/png',
            },
            {
              type: 'file',
              data: imageData,
              mediaType: 'image/png',
            },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        });

        expect(result.warnings).not.toContainEqual(
          expect.objectContaining({ type: 'other' }),
        );
      });
    });

    it('should handle API errors', async () => {
      server.urls['https://api.example.com/images/generations'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid prompt',
            type: 'invalid_request_error',
          },
        }),
      };

      const model = createModel();
      await expect(
        model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toMatchObject({
        message: 'Invalid prompt',
        statusCode: 400,
      });
    });

    it('should respect the abort signal', async () => {
      const model = createModel();
      const controller = new AbortController();

      const generatePromise = model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
        abortSignal: controller.signal,
      });

      controller.abort();

      await expect(generatePromise).rejects.toThrow(
        'This operation was aborted',
      );
    });
  });
});
