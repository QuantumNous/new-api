import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { DeepInfraImageModel } from './deepinfra-image-model';
import type { FetchFunction } from '@ai-sdk/provider-utils';

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
  return new DeepInfraImageModel('stability-ai/sdxl', {
    provider: 'deepinfra',
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ 'api-key': 'test-key' })),
    fetch,
    _internal: {
      currentDate,
    },
  });
}

describe('DeepInfraImageModel', () => {
  const testDate = new Date('2024-01-01T00:00:00Z');
  const server = createTestServer({
    'https://api.example.com/*': {
      response: {
        type: 'json-value',
        body: {
          images: ['data:image/png;base64,test-image-data'],
        },
      },
    },
  });

  describe('doGenerate', () => {
    it('should pass the correct parameters including aspect ratio and seed', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: 42,
        providerOptions: { deepinfra: { additional_param: 'value' } },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        aspect_ratio: '16:9',
        seed: 42,
        num_images: 1,
        additional_param: 'value',
      });
    });

    it('should call the correct url', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestMethod).toStrictEqual('POST');
      expect(server.calls[0].requestUrl).toStrictEqual(
        'https://api.example.com/stability-ai/sdxl',
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

    it('should handle API errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Bad Request',
          },
        }),
      };

      const model = createBasicModel();
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
      ).rejects.toThrow('Bad Request');
    });

    it('should handle size parameter', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x768',
        aspectRatio: undefined,
        seed: 42,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        width: '1024',
        height: '768',
        seed: 42,
        num_images: 1,
      });
    });

    it('should respect the abort signal', async () => {
      const model = createBasicModel();
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

    describe('response metadata', () => {
      it('should include timestamp, headers and modelId in response', async () => {
        const model = createBasicModel({
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
          modelId: 'stability-ai/sdxl',
          headers: expect.any(Object),
        });
      });

      it('should include response headers from API call', async () => {
        server.urls['https://api.example.com/*'].response = {
          type: 'json-value',
          headers: {
            'x-request-id': 'test-request-id',
          },
          body: {
            images: ['data:image/png;base64,test-image-data'],
          },
        };

        const model = createBasicModel();
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

        expect(result.response.headers).toStrictEqual({
          'content-length': '52',
          'x-request-id': 'test-request-id',
          'content-type': 'application/json',
        });
      });
    });
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('deepinfra');
      expect(model.modelId).toBe('stability-ai/sdxl');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });

  describe('Image Editing', () => {
    const editServer = createTestServer({
      'https://edit.example.com/openai/images/edits': {
        response: {
          type: 'json-value',
          body: {
            created: 1234567890,
            data: [{ b64_json: 'edited-image-base64' }],
          },
        },
      },
    });

    // Model with baseURL that will resolve to edit endpoint
    const editModel = new DeepInfraImageModel(
      'black-forest-labs/FLUX.1-Kontext-dev',
      {
        provider: 'deepinfra',
        baseURL: 'https://edit.example.com/inference',
        headers: () => ({ 'api-key': 'test-key' }),
      },
    );

    it('should send edit request with files', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

      const result = await editModel.doGenerate({
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
        size: '1024x1024',
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.images).toStrictEqual(['edited-image-base64']);
      expect(editServer.calls[0].requestUrl).toBe(
        'https://edit.example.com/openai/images/edits',
      );
    });

    it('should send edit request with files and mask', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]);
      const maskData = new Uint8Array([255, 255, 255, 0]);

      const result = await editModel.doGenerate({
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

      expect(result.images).toStrictEqual(['edited-image-base64']);
      expect(editServer.calls[0].requestUrl).toBe(
        'https://edit.example.com/openai/images/edits',
      );
    });

    it('should send edit request with multiple images', async () => {
      const image1 = new Uint8Array([137, 80, 78, 71]);
      const image2 = new Uint8Array([137, 80, 78, 71]);

      const result = await editModel.doGenerate({
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
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.images).toStrictEqual(['edited-image-base64']);
    });

    it('should include response metadata for edit requests', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const modelWithDate = new DeepInfraImageModel(
        'black-forest-labs/FLUX.1-Kontext-dev',
        {
          provider: 'deepinfra',
          baseURL: 'https://edit.example.com/inference',
          headers: () => ({ 'api-key': 'test-key' }),
          _internal: {
            currentDate: () => testDate,
          },
        },
      );

      const imageData = new Uint8Array([137, 80, 78, 71]);

      const result = await modelWithDate.doGenerate({
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
        providerOptions: {},
      });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'black-forest-labs/FLUX.1-Kontext-dev',
        headers: expect.any(Object),
      });
    });

    it('should pass provider options in edit request', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71]);

      await editModel.doGenerate({
        prompt: 'Edit with custom options',
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
          deepinfra: {
            guidance: 7.5,
          },
        },
      });

      // The request should have been made to the edit endpoint
      expect(editServer.calls[0].requestUrl).toBe(
        'https://edit.example.com/openai/images/edits',
      );
    });
  });
});
