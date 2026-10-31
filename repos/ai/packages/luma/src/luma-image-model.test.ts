import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { LumaImageModel } from './luma-image-model';
import { InvalidResponseDataError } from '@ai-sdk/provider';

const prompt = 'A cute baby sea otter';

function createBasicModel({
  headers,
  fetch,
  currentDate,
}: {
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
} = {}) {
  return new LumaImageModel('test-model', {
    provider: 'luma',
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ 'api-key': 'test-key' })),
    fetch,
    _internal: {
      currentDate,
    },
  });
}

describe('LumaImageModel', () => {
  const server = createTestServer({
    'https://api.example.com/dream-machine/v1/generations/image': {
      response: {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'queued',
          created_at: '2024-01-01T00:00:00Z',
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
          },
        },
      },
    },
    'https://api.example.com/dream-machine/v1/generations/test-generation-id': {
      response: {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          assets: {
            image: 'https://api.example.com/image.png',
          },
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
          },
        },
      },
    },
    'https://api.example.com/image.png': {
      response: {
        type: 'binary',
        body: Buffer.from('test-binary-content'),
      },
    },
  });

  describe('doGenerate', () => {
    it('should pass the correct parameters including aspect ratio', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: { luma: { additional_param: 'value' } },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        aspect_ratio: '16:9',
        model: 'test-model',
        additional_param: 'value',
      });
    });

    it('should call the correct urls in sequence', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        aspectRatio: '16:9',
        providerOptions: {},
        size: undefined,
        seed: undefined,
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/dream-machine/v1/generations/image',
      );
      expect(server.calls[1].requestMethod).toBe('GET');
      expect(server.calls[1].requestUrl).toBe(
        'https://api.example.com/dream-machine/v1/generations/test-generation-id',
      );
      expect(server.calls[2].requestMethod).toBe('GET');
      expect(server.calls[2].requestUrl).toBe(
        'https://api.example.com/image.png',
      );
    });

    it('should pass headers', async () => {
      const modelWithHeaders = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-header-value',
        }),
      });

      await modelWithHeaders.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(server.calls[0].requestHeaders).toStrictEqual({
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
    });

    it('should not pass providerOptions.{pollIntervalMillis,maxPollAttempts}', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {
          luma: {
            pollIntervalMillis: 1000,
            maxPollAttempts: 5,
            additional_param: 'value',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        aspect_ratio: '16:9',
        model: 'test-model',
        additional_param: 'value',
      });
    });

    it('should handle API errors', async () => {
      server.urls[
        'https://api.example.com/dream-machine/v1/generations/image'
      ].response = {
        type: 'error',
        status: 400,
        body: 'Bad Request',
      };

      const model = createBasicModel();
      await expect(
        model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          providerOptions: {},
          size: undefined,
          seed: undefined,
          aspectRatio: undefined,
        }),
      ).rejects.toMatchObject({
        message: 'Bad Request',
        statusCode: 400,
        url: 'https://api.example.com/dream-machine/v1/generations/image',
        requestBodyValues: {
          prompt: 'A cute baby sea otter',
        },
        responseBody: 'Bad Request',
      });
    });

    it('should handle failed generation state', async () => {
      server.urls[
        'https://api.example.com/dream-machine/v1/generations/test-generation-id'
      ].response = {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'failed',
          failure_reason: 'Generation failed',
          created_at: '2024-01-01T00:00:00Z',
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
          },
        },
      };

      const model = createBasicModel();
      await expect(
        model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          providerOptions: {},
          size: undefined,
          seed: undefined,
          aspectRatio: undefined,
        }),
      ).rejects.toThrow(InvalidResponseDataError);
    });

    describe('warnings', () => {
      it('should return warnings for unsupported parameters', async () => {
        const model = createBasicModel();

        const result = await model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: '1024x1024',
          seed: 123,
          providerOptions: {},
          aspectRatio: undefined,
        });

        expect(result.warnings).toMatchInlineSnapshot(`
          [
            {
              "details": "This model does not support the \`seed\` option.",
              "feature": "seed",
              "type": "unsupported",
            },
            {
              "details": "This model does not support the \`size\` option. Use \`aspectRatio\` instead.",
              "feature": "size",
              "type": "unsupported",
            },
          ]
        `);
      });
    });

    describe('response metadata', () => {
      it('should include timestamp, headers and modelId in response', async () => {
        const testDate = new Date('2024-01-01T00:00:00Z');
        const model = createBasicModel({
          currentDate: () => testDate,
        });

        const result = await model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          providerOptions: {},
          size: undefined,
          seed: undefined,
          aspectRatio: undefined,
        });

        expect(result.response).toStrictEqual({
          timestamp: testDate,
          modelId: 'test-model',
          headers: expect.any(Object),
        });
      });
    });
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('luma');
      expect(model.modelId).toBe('test-model');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });

  describe('Image Editing', () => {
    it('should send image by default when URL file is provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'A warrior with sunglasses',
        files: [
          {
            type: 'url',
            url: 'https://example.com/input.jpg',
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
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image": [
            {
              "url": "https://example.com/input.jpg",
              "weight": 0.85,
            },
          ],
          "model": "test-model",
          "prompt": "A warrior with sunglasses",
        }
      `);
    });

    it('should send modify_image when referenceType is set', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'Transform flowers to sunflowers',
        files: [
          {
            type: 'url',
            url: 'https://example.com/input.jpg',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          luma: {
            referenceType: 'modify_image',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "model": "test-model",
          "modify_image": {
            "url": "https://example.com/input.jpg",
            "weight": 1,
          },
          "prompt": "Transform flowers to sunflowers",
        }
      `);
    });

    it('should send style when referenceType is style', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'A dog in this style',
        files: [
          {
            type: 'url',
            url: 'https://example.com/style.jpg',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          luma: {
            referenceType: 'style',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "model": "test-model",
          "prompt": "A dog in this style",
          "style": [
            {
              "url": "https://example.com/style.jpg",
              "weight": 0.8,
            },
          ],
        }
      `);
    });

    it('should send character when referenceType is character', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'A warrior',
        files: [
          {
            type: 'url',
            url: 'https://example.com/person1.jpg',
          },
          {
            type: 'url',
            url: 'https://example.com/person2.jpg',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          luma: {
            referenceType: 'character',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "character": {
            "identity0": {
              "images": [
                "https://example.com/person1.jpg",
                "https://example.com/person2.jpg",
              ],
            },
          },
          "model": "test-model",
          "prompt": "A warrior",
        }
      `);
    });

    it('should send character with custom identity id from images config', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'A woman with a cat',
        files: [
          {
            type: 'url',
            url: 'https://example.com/person.jpg',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          luma: {
            referenceType: 'character',
            images: [{ id: 'identity0' }],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "character": {
            "identity0": {
              "images": [
                "https://example.com/person.jpg",
              ],
            },
          },
          "model": "test-model",
          "prompt": "A woman with a cat",
        }
      `);
    });

    it('should send character with multiple identities from images config', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'Two people talking',
        files: [
          {
            type: 'url',
            url: 'https://example.com/person1.jpg',
          },
          {
            type: 'url',
            url: 'https://example.com/person2.jpg',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          luma: {
            referenceType: 'character',
            images: [{ id: 'identity0' }, { id: 'identity1' }],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "character": {
            "identity0": {
              "images": [
                "https://example.com/person1.jpg",
              ],
            },
            "identity1": {
              "images": [
                "https://example.com/person2.jpg",
              ],
            },
          },
          "model": "test-model",
          "prompt": "Two people talking",
        }
      `);
    });

    it('should support multiple images for image', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'Combine these concepts',
        files: [
          {
            type: 'url',
            url: 'https://example.com/input1.jpg',
          },
          {
            type: 'url',
            url: 'https://example.com/input2.jpg',
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
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image": [
            {
              "url": "https://example.com/input1.jpg",
              "weight": 0.85,
            },
            {
              "url": "https://example.com/input2.jpg",
              "weight": 0.85,
            },
          ],
          "model": "test-model",
          "prompt": "Combine these concepts",
        }
      `);
    });

    it('should use custom weights from images config', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: 'Styled image',
        files: [
          {
            type: 'url',
            url: 'https://example.com/input.jpg',
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          luma: {
            images: [{ weight: 0.5 }],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image": [
            {
              "url": "https://example.com/input.jpg",
              "weight": 0.5,
            },
          ],
          "model": "test-model",
          "prompt": "Styled image",
        }
      `);
    });

    it('should throw error when mask is provided', async () => {
      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt: 'Replace sky with sunset',
          files: [
            {
              type: 'url',
              url: 'https://example.com/input.jpg',
            },
          ],
          mask: {
            type: 'url',
            url: 'https://example.com/mask.png',
          },
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow('Luma AI does not support mask-based image editing');
    });

    it('should throw error when base64 file data is provided', async () => {
      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt: 'Edit this image',
          files: [
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
        }),
      ).rejects.toThrow('Luma AI only supports URL-based images');
    });

    it('should throw error when base64 mask data is provided', async () => {
      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt: 'Edit with mask',
          files: [
            {
              type: 'url',
              url: 'https://example.com/input.jpg',
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
        }),
      ).rejects.toThrow('Luma AI does not support mask-based image editing');
    });

    it('should throw error when more than 4 images for image', async () => {
      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt: 'Too many images',
          files: [
            { type: 'url', url: 'https://example.com/1.jpg' },
            { type: 'url', url: 'https://example.com/2.jpg' },
            { type: 'url', url: 'https://example.com/3.jpg' },
            { type: 'url', url: 'https://example.com/4.jpg' },
            { type: 'url', url: 'https://example.com/5.jpg' },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow('Luma AI image supports up to 4 reference images');
    });

    it('should throw error when multiple files for modify_image', async () => {
      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt: 'Edit multiple images',
          files: [
            {
              type: 'url',
              url: 'https://example.com/input1.jpg',
            },
            {
              type: 'url',
              url: 'https://example.com/input2.jpg',
            },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {
            luma: {
              referenceType: 'modify_image',
            },
          },
        }),
      ).rejects.toThrow(
        'Luma AI modify_image only supports a single input image',
      );
    });
  });

  describe('response schema validation', () => {
    it('should parse response with image references', async () => {
      server.urls[
        'https://api.example.com/dream-machine/v1/generations/test-generation-id'
      ].response = {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          assets: {
            image: 'https://api.example.com/image.png',
          },
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
            image_ref: [
              {
                url: 'https://example.com/ref1.jpg',
                weight: 0.85,
              },
            ],
          },
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      // If schema validation fails, this won't get reached
      expect(result.images).toBeDefined();
    });

    it('should parse response with style references', async () => {
      server.urls[
        'https://api.example.com/dream-machine/v1/generations/test-generation-id'
      ].response = {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          assets: {
            image: 'https://api.example.com/image.png',
          },
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
            style_ref: [
              {
                url: 'https://example.com/style1.jpg',
                weight: 0.8,
              },
            ],
          },
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(result.images).toBeDefined();
    });

    it('should parse response with character references', async () => {
      server.urls[
        'https://api.example.com/dream-machine/v1/generations/test-generation-id'
      ].response = {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          assets: {
            image: 'https://api.example.com/image.png',
          },
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
            character_ref: {
              identity0: {
                images: ['https://example.com/character1.jpg'],
              },
            },
          },
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(result.images).toBeDefined();
    });

    it('should parse response with modify image reference', async () => {
      server.urls[
        'https://api.example.com/dream-machine/v1/generations/test-generation-id'
      ].response = {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          assets: {
            image: 'https://api.example.com/image.png',
          },
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
            modify_image_ref: {
              url: 'https://example.com/modify.jpg',
              weight: 1.0,
            },
          },
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(result.images).toBeDefined();
    });

    it('should parse response with multiple reference types', async () => {
      server.urls[
        'https://api.example.com/dream-machine/v1/generations/test-generation-id'
      ].response = {
        type: 'json-value',
        body: {
          id: 'test-generation-id',
          generation_type: 'image',
          state: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          assets: {
            image: 'https://api.example.com/image.png',
          },
          model: 'test-model',
          request: {
            generation_type: 'image',
            model: 'test-model',
            prompt: 'A cute baby sea otter',
            image_ref: [
              {
                url: 'https://example.com/ref1.jpg',
                weight: 0.85,
              },
            ],
            style_ref: [
              {
                url: 'https://example.com/style1.jpg',
                weight: 0.8,
              },
            ],
            character_ref: {
              identity0: {
                images: ['https://example.com/character1.jpg'],
              },
            },
            modify_image_ref: {
              url: 'https://example.com/modify.jpg',
              weight: 1.0,
            },
          },
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(result.images).toBeDefined();
    });
  });
});
