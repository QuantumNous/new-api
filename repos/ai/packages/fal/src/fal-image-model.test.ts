import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { FalImageModel } from './fal-image-model';

const prompt = 'A cute baby sea otter';

function createBasicModel({
  headers,
  fetch,
  currentDate,
}: {
  headers?: Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
  settings?: any;
} = {}) {
  return new FalImageModel('fal-ai/qwen-image', {
    provider: 'fal.image',
    baseURL: 'https://api.example.com',
    headers: headers ?? { 'api-key': 'test-key' },
    fetch,
    _internal: {
      currentDate,
    },
  });
}

describe('FalImageModel', () => {
  const server = createTestServer({
    'https://api.example.com/fal-ai/qwen-image': {
      response: {
        type: 'json-value',
        body: {
          images: [
            {
              url: 'https://api.example.com/image.png',
              width: 1024,
              height: 1024,
              content_type: 'image/png',
            },
          ],
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
    it('should pass the correct parameters including size', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x1024',
        aspectRatio: undefined,
        seed: 123,
        providerOptions: { fal: { additional_param: 'value' } },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        seed: 123,
        image_size: { width: 1024, height: 1024 },
        num_images: 1,
        additional_param: 'value',
      });
    });

    it('should convert camelCase provider options to snake_case for API', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          fal: {
            imageUrl: 'https://example.com/image.png',
            guidanceScale: 7.5,
            numInferenceSteps: 50,
            enableSafetyChecker: false,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        num_images: 1,
        image_url: 'https://example.com/image.png',
        guidance_scale: 7.5,
        num_inference_steps: 50,
        enable_safety_checker: false,
      });

      expect(result.warnings).toHaveLength(0);
    });

    it('should accept deprecated snake_case provider options with warning', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          fal: {
            image_url: 'https://example.com/image.png',
            guidance_scale: 7.5,
            num_inference_steps: 50,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        num_images: 1,
        image_url: 'https://example.com/image.png',
        guidance_scale: 7.5,
        num_inference_steps: 50,
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        type: 'other',
        message: expect.stringContaining('deprecated snake_case'),
      });

      const warning = result.warnings[0];
      if (warning.type === 'other') {
        expect(warning.message).toContain("'image_url' (use 'imageUrl')");
        expect(warning.message).toContain(
          "'guidance_scale' (use 'guidanceScale')",
        );
        expect(warning.message).toContain(
          "'num_inference_steps' (use 'numInferenceSteps')",
        );
      }
    });

    it('should convert aspect ratio to size', async () => {
      const model = createBasicModel();

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

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        image_size: 'landscape_16_9',
        num_images: 1,
      });
    });

    it('should pass headers', async () => {
      const modelWithHeaders = createBasicModel({
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
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

    it('should handle API errors', async () => {
      server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          detail: [
            {
              loc: ['prompt'],
              msg: 'Invalid prompt',
              type: 'value_error',
            },
          ],
        }),
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
        message: 'prompt: Invalid prompt',
        statusCode: 400,
        url: 'https://api.example.com/fal-ai/qwen-image',
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
          modelId: 'fal-ai/qwen-image',
          headers: expect.any(Object),
        });
      });
    });

    describe('providerMetaData', () => {
      // https://fal.ai/models/fal-ai/lora/api#schema-output
      it('for lora', async () => {
        const responseMetaData = {
          prompt: '<prompt>',
          seed: 123,
          has_nsfw_concepts: [true],
          debug_latents: {
            url: '<debug_latents url>',
            content_type: '<debug_latents content_type>',
            file_name: '<debug_latents file_name>',
            file_data: '<debug_latents file_data>',
            file_size: 123,
          },
          debug_per_pass_latents: {
            url: '<debug_per_pass_latents url>',
            content_type: '<debug_per_pass_latents content_type>',
            file_name: '<debug_per_pass_latents file_name>',
            file_data: '<debug_per_pass_latents file_data>',
            file_size: 456,
          },
        };
        server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
          type: 'json-value',
          body: {
            images: [
              {
                url: 'https://api.example.com/image.png',
                width: 1024,
                height: 1024,
                content_type: 'image/png',
                file_data: '<image file_data>',
                file_size: 123,
                file_name: '<image file_name>',
              },
            ],
            ...responseMetaData,
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
        expect(result.providerMetadata).toStrictEqual({
          fal: {
            images: [
              {
                width: 1024,
                height: 1024,
                contentType: 'image/png',
                fileName: '<image file_name>',
                fileData: '<image file_data>',
                fileSize: 123,
                nsfw: true,
              },
            ],
            seed: 123,
            debug_latents: {
              url: '<debug_latents url>',
              content_type: '<debug_latents content_type>',
              file_name: '<debug_latents file_name>',
              file_data: '<debug_latents file_data>',
              file_size: 123,
            },
            debug_per_pass_latents: {
              url: '<debug_per_pass_latents url>',
              content_type: '<debug_per_pass_latents content_type>',
              file_name: '<debug_per_pass_latents file_name>',
              file_data: '<debug_per_pass_latents file_data>',
              file_size: 456,
            },
          },
        });
      });

      it('for lcm', async () => {
        const responseMetaData = {
          seed: 123,
          num_inference_steps: 456,
          nsfw_content_detected: [false],
        };
        server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
          type: 'json-value',
          body: {
            images: [
              {
                url: 'https://api.example.com/image.png',
                width: 1024,
                height: 1024,
              },
            ],
            ...responseMetaData,
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
        expect(result.providerMetadata).toStrictEqual({
          fal: {
            images: [
              {
                width: 1024,
                height: 1024,
                nsfw: false,
              },
            ],
            seed: 123,
            num_inference_steps: 456,
          },
        });
      });
    });
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('fal.image');
      expect(model.modelId).toBe('fal-ai/qwen-image');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });

  describe('Image Editing', () => {
    it('should send edit request with files as data URI', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

      await createBasicModel().doGenerate({
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

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image_url": "data:image/png;base64,iVBORw==",
          "num_images": 1,
          "prompt": "Turn the cat into a dog",
        }
      `);
    });

    it('should send edit request with files and mask', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]);
      const maskData = new Uint8Array([255, 255, 255, 0]);

      await createBasicModel().doGenerate({
        prompt: 'Add a flamingo to the pool',
        files: [
          {
            type: 'file',
            data: imageData,
            mediaType: 'image/png',
          },
        ],
        mask: {
          type: 'file',
          data: maskData,
          mediaType: 'image/png',
        },
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image_url": "data:image/png;base64,iVBORw==",
          "mask_url": "data:image/png;base64,////AA==",
          "num_images": 1,
          "prompt": "Add a flamingo to the pool",
        }
      `);
    });

    it('should send edit request with URL-based file', async () => {
      await createBasicModel().doGenerate({
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

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image_url": "https://example.com/input.png",
          "num_images": 1,
          "prompt": "Edit this image",
        }
      `);
    });

    it('should send edit request with base64 string data', async () => {
      await createBasicModel().doGenerate({
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

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=",
          "num_images": 1,
          "prompt": "Edit this image",
        }
      `);
    });

    it('should warn when multiple files are provided', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]);

      const result = await createBasicModel().doGenerate({
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

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        type: 'other',
        message: expect.stringContaining('useMultipleImages is not enabled'),
      });
    });

    it('should send image_urls when useMultipleImages is true', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]);

      await createBasicModel().doGenerate({
        prompt: 'Edit these images',
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
        providerOptions: {
          fal: {
            useMultipleImages: true,
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchObject({
        image_urls: [
          'data:image/png;base64,iVBORw==',
          'data:image/png;base64,iVBORw==',
        ],
        num_images: 1,
        prompt: 'Edit these images',
      });
      expect(requestBody.image_url).toBeUndefined();
    });

    it('should not warn when multiple files provided with useMultipleImages', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]);

      const result = await createBasicModel().doGenerate({
        prompt: 'Edit images',
        files: [
          { type: 'file', data: imageData, mediaType: 'image/png' },
          { type: 'file', data: imageData, mediaType: 'image/png' },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          fal: {
            useMultipleImages: true,
          },
        },
      });

      expect(result.warnings).toHaveLength(0);
    });

    it('should send single image as image_urls array when useMultipleImages is true', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]);

      await createBasicModel().doGenerate({
        prompt: 'Edit this image',
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
        providerOptions: {
          fal: {
            useMultipleImages: true,
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchObject({
        image_urls: ['data:image/png;base64,iVBORw=='],
        num_images: 1,
        prompt: 'Edit this image',
      });
      expect(requestBody.image_url).toBeUndefined();
    });

    it('should allow imageUrl via provider options', async () => {
      await createBasicModel().doGenerate({
        prompt: 'Edit via provider options',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          fal: {
            imageUrl: 'https://example.com/provider-image.png',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image_url": "https://example.com/provider-image.png",
          "num_images": 1,
          "prompt": "Edit via provider options",
        }
      `);
    });

    it('should allow maskUrl via provider options', async () => {
      await createBasicModel().doGenerate({
        prompt: 'Inpaint this',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          fal: {
            imageUrl: 'https://example.com/image.png',
            maskUrl: 'https://example.com/mask.png',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchInlineSnapshot(`
        {
          "image_url": "https://example.com/image.png",
          "mask_url": "https://example.com/mask.png",
          "num_images": 1,
          "prompt": "Inpaint this",
        }
      `);
    });
  });

  describe('response schema validation', () => {
    it('should parse single image response', async () => {
      server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
        type: 'json-value',
        body: {
          image: {
            url: 'https://api.example.com/image.png',
            width: 1024,
            height: 1024,
            content_type: 'image/png',
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

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
    });

    it('should parse multiple images response', async () => {
      server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
        type: 'json-value',
        body: {
          images: [
            {
              url: 'https://api.example.com/image.png',
              width: 1024,
              height: 1024,
              content_type: 'image/png',
            },
            {
              url: 'https://api.example.com/image.png',
              width: 1024,
              height: 1024,
              content_type: 'image/png',
            },
          ],
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        providerOptions: {},
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
      expect(result.images[1]).toBeInstanceOf(Uint8Array);
    });

    it('should handle null file_name and file_size values', async () => {
      server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
        type: 'json-value',
        body: {
          images: [
            {
              url: 'https://api.example.com/image.png',
              content_type: 'image/png',
              file_name: null,
              file_size: null,
              width: 944,
              height: 1104,
            },
          ],
          timings: { inference: 5.875932216644287 },
          seed: 328395684,
          has_nsfw_concepts: [false],
          prompt:
            'A female model holding this book, keeping the book unchanged.',
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

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
      expect(result.providerMetadata?.fal).toMatchObject({
        images: [
          {
            width: 944,
            height: 1104,
            contentType: 'image/png',
            fileName: null,
            fileSize: null,
            nsfw: false,
          },
        ],
        timings: { inference: 5.875932216644287 },
        seed: 328395684,
      });
    });

    it('should handle empty timings object', async () => {
      server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
        type: 'json-value',
        body: {
          images: [
            {
              url: 'https://api.example.com/image.png',
              content_type: 'image/png',
              file_name: null,
              file_size: null,
              width: 880,
              height: 1184,
            },
          ],
          timings: {},
          seed: 235205040,
          has_nsfw_concepts: [false],
          prompt: 'Change the plates to colorful ones',
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

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
      expect(result.providerMetadata?.fal).toMatchObject({
        images: [
          {
            width: 880,
            height: 1184,
            contentType: 'image/png',
            fileName: null,
            fileSize: null,
            nsfw: false,
          },
        ],
        timings: {},
        seed: 235205040,
      });
    });

    it('should handle null width and height values with images array only', async () => {
      server.urls['https://api.example.com/fal-ai/qwen-image'].response = {
        type: 'json-value',
        body: {
          images: [
            {
              url: 'https://api.example.com/image.png',
              content_type: 'image/png',
              file_name: 'output.png',
              file_size: 663399,
              width: null,
              height: null,
            },
          ],
          description: 'here is an image with null width and height',
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

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
      expect(result.providerMetadata?.fal).toMatchObject({
        images: [
          {
            width: null,
            height: null,
            contentType: 'image/png',
            fileName: 'output.png',
            fileSize: 663399,
          },
        ],
        description: 'here is an image with null width and height',
      });
    });
  });
});
