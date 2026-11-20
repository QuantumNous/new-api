import { describe, it, expect } from 'vitest';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { OpenAICompatibleImageModel } from './openai-compatible-image-model';
import { z } from 'zod/v4';
import type { ProviderErrorStructure } from '../openai-compatible-error';
import type { ImageModelV4CallOptions } from '@ai-sdk/provider';

const prompt = 'A photorealistic astronaut riding a horse';

function createBasicModel({
  headers,
  fetch,
  currentDate,
  errorStructure,
}: {
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
  errorStructure?: ProviderErrorStructure<any>;
} = {}) {
  return new OpenAICompatibleImageModel('dall-e-3', {
    provider: 'openai-compatible',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-key' })),
    url: ({ modelId, path }) => `https://api.example.com/${modelId}${path}`,
    fetch,
    errorStructure,
    _internal: {
      currentDate,
    },
  });
}

function createDefaultGenerateParams(overrides = {}): ImageModelV4CallOptions {
  return {
    prompt: 'A photorealistic astronaut riding a horse',
    files: undefined,
    mask: undefined,
    n: 1,
    size: '1024x1024',
    aspectRatio: undefined,
    seed: undefined,
    providerOptions: {},
    headers: {},
    abortSignal: undefined,
    ...overrides,
  };
}

describe('OpenAICompatibleImageModel', () => {
  const server = createTestServer({
    'https://api.example.com/dall-e-3/images/generations': {
      response: {
        type: 'json-value',
        body: {
          data: [
            {
              b64_json: 'test1234',
            },
            {
              b64_json: 'test5678',
            },
          ],
        },
      },
    },
    'https://external.api.recraft.ai/v1/images/generations': {
      response: {
        type: 'json-value',
        body: {
          data: [
            {
              b64_json: 'recraft-test-image',
            },
          ],
        },
      },
    },
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('openai-compatible');
      expect(model.modelId).toBe('dall-e-3');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(10);
    });
  });

  describe('doGenerate', () => {
    it('should pass the correct parameters', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          n: 2,
          providerOptions: { openaiCompatible: { quality: 'hd' } },
        }),
      );

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'dall-e-3',
        prompt,
        n: 2,
        size: '1024x1024',
        quality: 'hd',
        response_format: 'b64_json',
      });
    });

    it('should use provider name from config for providerOptions key', async () => {
      const recraftModel = new OpenAICompatibleImageModel('recraft-v3', {
        provider: 'recraft.image',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        url: ({ modelId, path }) => `https://external.api.recraft.ai/v1${path}`,
      });

      await recraftModel.doGenerate(
        createDefaultGenerateParams({
          prompt: 'A beautiful sunset',
          providerOptions: { recraft: { style: 'vector_illustration' } },
        }),
      );

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'recraft-v3',
        prompt: 'A beautiful sunset',
        n: 1,
        size: '1024x1024',
        style: 'vector_illustration',
        response_format: 'b64_json',
      });
    });

    it('should emit deprecated warning when raw provider options key is used for hyphenated provider', async () => {
      const model = new OpenAICompatibleImageModel('dall-e-3', {
        provider: 'black-forest-labs.image',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        url: ({ modelId, path }) => `https://api.example.com/${modelId}${path}`,
      });

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          providerOptions: {
            'black-forest-labs': { quality: 'hd' },
          },
        }),
      );

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "message": "Use 'blackForestLabs' instead.",
            "setting": "providerOptions key 'black-forest-labs'",
            "type": "deprecated",
          },
        ]
      `);
    });

    it('should not emit deprecated warning when camelCase provider options key is used', async () => {
      const model = new OpenAICompatibleImageModel('dall-e-3', {
        provider: 'black-forest-labs.image',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        url: ({ modelId, path }) => `https://api.example.com/${modelId}${path}`,
      });

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          providerOptions: {
            blackForestLabs: { quality: 'hd' },
          },
        }),
      );

      expect(result.warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should add warnings for unsupported settings', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          aspectRatio: '16:9',
          seed: 123,
        }),
      );

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "This model does not support aspect ratio. Use \`size\` instead.",
            "feature": "aspectRatio",
            "type": "unsupported",
          },
          {
            "feature": "seed",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should pass headers', async () => {
      const modelWithHeaders = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-header-value',
        }),
      });

      await modelWithHeaders.doGenerate(
        createDefaultGenerateParams({
          headers: {
            'Custom-Request-Header': 'request-header-value',
          },
        }),
      );

      expect(server.calls[0].requestHeaders).toStrictEqual({
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
    });

    it('should handle API errors with custom error structure', async () => {
      // Define a custom error schema different from OpenAI's format
      const customErrorSchema = z.object({
        status: z.string(),
        details: z.object({
          errorMessage: z.string(),
          errorCode: z.number(),
        }),
      });

      server.urls[
        'https://api.example.com/dall-e-3/images/generations'
      ].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          status: 'error',
          details: {
            errorMessage: 'Custom provider error format',
            errorCode: 1234,
          },
        }),
      };

      const model = createBasicModel({
        errorStructure: {
          errorSchema: customErrorSchema,
          errorToMessage: data =>
            `Error ${data.details.errorCode}: ${data.details.errorMessage}`,
        },
      });

      await expect(
        model.doGenerate(createDefaultGenerateParams()),
      ).rejects.toMatchObject({
        message: 'Error 1234: Custom provider error format',
        statusCode: 400,
        url: 'https://api.example.com/dall-e-3/images/generations',
      });
    });

    it('should handle API errors with default error structure', async () => {
      server.urls[
        'https://api.example.com/dall-e-3/images/generations'
      ].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid prompt content',
            type: 'invalid_request_error',
            param: null,
            code: null,
          },
        }),
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate(createDefaultGenerateParams()),
      ).rejects.toMatchObject({
        message: 'Invalid prompt content',
        statusCode: 400,
        url: 'https://api.example.com/dall-e-3/images/generations',
      });
    });

    it('should return the raw b64_json content', async () => {
      const model = createBasicModel();
      const result = await model.doGenerate(
        createDefaultGenerateParams({
          n: 2,
        }),
      );

      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toBe('test1234');
      expect(result.images[1]).toBe('test5678');
    });

    describe('response metadata', () => {
      it('should include timestamp, headers and modelId in response', async () => {
        const testDate = new Date('2024-01-01T00:00:00Z');
        const model = createBasicModel({
          currentDate: () => testDate,
        });

        const result = await model.doGenerate(createDefaultGenerateParams());

        expect(result.response).toStrictEqual({
          timestamp: testDate,
          modelId: 'dall-e-3',
          headers: expect.any(Object),
        });
      });
    });

    it('should use real date when no custom date provider is specified', async () => {
      const beforeDate = new Date();

      const model = new OpenAICompatibleImageModel('dall-e-3', {
        provider: 'openai-compatible',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        url: ({ modelId, path }) => `https://api.example.com/${modelId}${path}`,
      });

      const result = await model.doGenerate(createDefaultGenerateParams());

      const afterDate = new Date();

      expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeDate.getTime(),
      );
      expect(result.response.timestamp.getTime()).toBeLessThanOrEqual(
        afterDate.getTime(),
      );
      expect(result.response.modelId).toBe('dall-e-3');
    });

    it('should pass the user setting in the request', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          providerOptions: {
            openaiCompatible: {
              user: 'test-user-id',
            },
          },
        }),
      );

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        user: 'test-user-id',
        response_format: 'b64_json',
      });
    });

    it('should not include user field in request when not set via provider options', async () => {
      const model = createBasicModel();

      await model.doGenerate(
        createDefaultGenerateParams({
          providerOptions: {
            openaiCompatible: {},
          },
        }),
      );

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toStrictEqual({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      });
      expect(requestBody).not.toHaveProperty('user');
    });
  });

  describe('Image Editing', () => {
    const editServer = createTestServer({
      'https://api.example.com/dall-e-3/images/edits': {
        response: {
          type: 'json-value',
          body: {
            data: [{ b64_json: 'edited-image-base64' }],
          },
        },
      },
    });

    it('should send edit request with files', async () => {
      const model = createBasicModel();

      // Use Uint8Array for test data to avoid base64 decoding issues
      const imageData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          prompt: 'Turn the cat into a dog',
          files: [
            {
              type: 'file',
              data: imageData,
              mediaType: 'image/png',
            },
          ],
        }),
      );

      expect(result.images).toStrictEqual(['edited-image-base64']);
      expect(editServer.calls[0].requestUrl).toBe(
        'https://api.example.com/dall-e-3/images/edits',
      );
    });

    it('should send edit request with files and mask', async () => {
      const model = createBasicModel();

      // Use Uint8Array for test data
      const imageData = new Uint8Array([137, 80, 78, 71]);
      const maskData = new Uint8Array([137, 80, 78, 71]);

      const result = await model.doGenerate(
        createDefaultGenerateParams({
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
        }),
      );

      expect(result.images).toStrictEqual(['edited-image-base64']);
      expect(editServer.calls[0].requestUrl).toBe(
        'https://api.example.com/dall-e-3/images/edits',
      );
    });

    it('should send edit request with Uint8Array data', async () => {
      const model = createBasicModel();

      const imageUint8Array = new Uint8Array([104, 101, 108, 108, 111]);

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          prompt: 'Edit this image',
          files: [
            {
              type: 'file',
              data: imageUint8Array,
              mediaType: 'image/png',
            },
          ],
        }),
      );

      expect(result.images).toStrictEqual(['edited-image-base64']);
    });

    it('should send edit request with multiple images', async () => {
      const model = createBasicModel();

      const image1 = new Uint8Array([137, 80, 78, 71]);
      const image2 = new Uint8Array([137, 80, 78, 71]);

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          prompt: 'Combine these images',
          files: [
            {
              type: 'file',
              data: image1,
              mediaType: 'image/png',
            },
            {
              type: 'file',
              data: image2,
              mediaType: 'image/png',
            },
          ],
        }),
      );

      expect(result.images).toStrictEqual(['edited-image-base64']);
    });

    it('should include response metadata for edit requests', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createBasicModel({
        currentDate: () => testDate,
      });

      const imageData = new Uint8Array([137, 80, 78, 71]);

      const result = await model.doGenerate(
        createDefaultGenerateParams({
          prompt: 'Edit this image',
          files: [
            {
              type: 'file',
              data: imageData,
              mediaType: 'image/png',
            },
          ],
        }),
      );

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'dall-e-3',
        headers: expect.any(Object),
      });
    });
  });
});
