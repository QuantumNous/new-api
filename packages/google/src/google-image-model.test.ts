import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { GoogleImageModel } from './google-image-model';
import { describe, it, expect } from 'vitest';

const prompt = 'A cute baby sea otter';

const model = new GoogleImageModel(
  'imagen-3.0-generate-002',
  {},
  {
    provider: 'google.generative-ai',
    baseURL: 'https://api.example.com/v1beta',
    headers: () => ({ 'api-key': 'test-api-key' }),
  },
);

const server = createTestServer({
  'https://api.example.com/v1beta/models/imagen-3.0-generate-002:predict': {
    response: {
      type: 'json-value',
      body: {
        predictions: [
          { bytesBase64Encoded: 'base64-image-1' },
          { bytesBase64Encoded: 'base64-image-2' },
        ],
      },
    },
  },
});
describe('GoogleImageModel', () => {
  describe('doGenerate', () => {
    function prepareJsonResponse({
      headers,
    }: {
      headers?: Record<string, string>;
    } = {}) {
      const url =
        'https://api.example.com/v1beta/models/imagen-3.0-generate-002:predict';
      server.urls[url].response = {
        type: 'json-value',
        headers,
        body: {
          predictions: [
            { bytesBase64Encoded: 'base64-image-1' },
            { bytesBase64Encoded: 'base64-image-2' },
          ],
        },
      };
    }

    it('should pass headers', async () => {
      prepareJsonResponse();

      const modelWithHeaders = new GoogleImageModel(
        'imagen-3.0-generate-002',
        {},
        {
          provider: 'google.generative-ai',
          baseURL: 'https://api.example.com/v1beta',
          headers: () => ({
            'Custom-Provider-Header': 'provider-header-value',
          }),
        },
      );

      await modelWithHeaders.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
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

    it('should respect maxImagesPerCall setting', () => {
      const customModel = new GoogleImageModel(
        'imagen-3.0-generate-002',
        { maxImagesPerCall: 2 },
        {
          provider: 'google.generative-ai',
          baseURL: 'https://api.example.com/v1beta',
          headers: () => ({ 'api-key': 'test-api-key' }),
        },
      );

      expect(customModel.maxImagesPerCall).toBe(2);
    });

    it('should use default maxImagesPerCall when not specified', () => {
      const defaultModel = new GoogleImageModel(
        'imagen-3.0-generate-002',
        {},
        {
          provider: 'google.generative-ai',
          baseURL: 'https://api.example.com/v1beta',
          headers: () => ({ 'api-key': 'test-api-key' }),
        },
      );

      expect(defaultModel.maxImagesPerCall).toBe(4);
    });

    it('should extract the generated images', async () => {
      prepareJsonResponse();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.images).toStrictEqual(['base64-image-1', 'base64-image-2']);
    });

    it('sends aspect ratio in the request', async () => {
      prepareJsonResponse();

      await model.doGenerate({
        prompt: 'test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "prompt": "test prompt",
            },
          ],
          "parameters": {
            "aspectRatio": "16:9",
            "sampleCount": 1,
          },
        }
      `);
    });

    it('should pass aspect ratio directly when specified', async () => {
      prepareJsonResponse();

      await model.doGenerate({
        prompt: 'test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "prompt": "test prompt",
            },
          ],
          "parameters": {
            "aspectRatio": "16:9",
            "sampleCount": 1,
          },
        }
      `);
    });

    it('should combine aspectRatio and provider options', async () => {
      prepareJsonResponse();

      await model.doGenerate({
        prompt: 'test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '1:1',
        seed: undefined,
        providerOptions: {
          google: {
            personGeneration: 'dont_allow',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "prompt": "test prompt",
            },
          ],
          "parameters": {
            "aspectRatio": "1:1",
            "personGeneration": "dont_allow",
            "sampleCount": 1,
          },
        }
      `);
    });

    it('should return warnings for unsupported settings', async () => {
      prepareJsonResponse();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x1024',
        aspectRatio: '1:1',
        seed: 123,
        providerOptions: {},
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "This model does not support the \`size\` option. Use \`aspectRatio\` instead.",
            "feature": "size",
            "type": "unsupported",
          },
          {
            "details": "This model does not support the \`seed\` option through this provider.",
            "feature": "seed",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should include response data with timestamp, modelId and headers', async () => {
      prepareJsonResponse({
        headers: {
          'request-id': 'test-request-id',
          'x-goog-quota-remaining': '123',
        },
      });

      const testDate = new Date('2024-03-15T12:00:00Z');

      const customModel = new GoogleImageModel(
        'imagen-3.0-generate-002',
        {},
        {
          provider: 'google.generative-ai',
          baseURL: 'https://api.example.com/v1beta',
          headers: () => ({ 'api-key': 'test-api-key' }),
          _internal: {
            currentDate: () => testDate,
          },
        },
      );

      const result = await customModel.doGenerate({
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
        modelId: 'imagen-3.0-generate-002',
        headers: {
          'content-length': '97',
          'content-type': 'application/json',
          'request-id': 'test-request-id',
          'x-goog-quota-remaining': '123',
        },
      });
    });

    it('should use real date when no custom date provider is specified', async () => {
      prepareJsonResponse();
      const beforeDate = new Date();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const afterDate = new Date();

      expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeDate.getTime(),
      );
      expect(result.response.timestamp.getTime()).toBeLessThanOrEqual(
        afterDate.getTime(),
      );
      expect(result.response.modelId).toBe('imagen-3.0-generate-002');
    });

    it('should only pass valid provider options', async () => {
      prepareJsonResponse();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {
          google: {
            addWatermark: false,
            personGeneration: 'allow_all',
            foo: 'bar',
            negativePrompt: 'negative prompt',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "prompt": "A cute baby sea otter",
            },
          ],
          "parameters": {
            "aspectRatio": "16:9",
            "personGeneration": "allow_all",
            "sampleCount": 2,
          },
        }
      `);
    });
  });

  describe('googleSearch on Imagen', () => {
    it('should emit an unsupported warning and not leak into parameters', async () => {
      const result = await model.doGenerate({
        prompt: 'A cute baby sea otter',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          google: { googleSearch: {} },
        },
      });

      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'googleSearch',
        details:
          'Google Search grounding is only supported on Gemini image models.',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.parameters.googleSearch).toBeUndefined();
    });
  });

  describe('Image Editing (Not Supported)', () => {
    it('should throw error when files are provided', async () => {
      await expect(
        model.doGenerate({
          prompt: 'Edit this image',
          files: [
            {
              type: 'file',
              data: 'base64-source-image',
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
      ).rejects.toThrow(
        'Google Gemini API does not support image editing with Imagen models. ' +
          'Use Google Vertex AI (@ai-sdk/google-vertex) for image editing capabilities.',
      );
    });

    it('should throw error when mask is provided', async () => {
      await expect(
        model.doGenerate({
          prompt: 'Edit this image',
          files: undefined,
          mask: {
            type: 'file',
            data: 'base64-mask-image',
            mediaType: 'image/png',
          },
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow(
        'Google Gemini API does not support image editing with masks. ' +
          'Use Google Vertex AI (@ai-sdk/google-vertex) for image editing capabilities.',
      );
    });
  });
});

describe('GoogleImageModel (Gemini)', () => {
  const geminiModel = new GoogleImageModel(
    'gemini-2.5-flash-image',
    {},
    {
      provider: 'google.generative-ai',
      baseURL: 'https://api.example.com/v1beta',
      headers: () => ({ 'api-key': 'test-api-key' }),
    },
  );

  const TEST_URL_GEMINI_IMAGE =
    'https://api.example.com/v1beta/models/gemini-2.5-flash-image:generateContent';

  const geminiServer = createTestServer({
    [TEST_URL_GEMINI_IMAGE]: {
      response: {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: 'base64-generated-image',
                    },
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 100,
            totalTokenCount: 110,
          },
        },
      },
    },
  });

  function prepareGeminiJsonResponse({
    images = [{ mimeType: 'image/png', data: 'base64-generated-image' }],
    usage = {
      promptTokenCount: 10,
      candidatesTokenCount: 100,
      totalTokenCount: 110,
    },
    headers,
  }: {
    images?: Array<{ mimeType: string; data: string }>;
    usage?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
    headers?: Record<string, string>;
  } = {}) {
    geminiServer.urls[TEST_URL_GEMINI_IMAGE].response = {
      type: 'json-value',
      headers,
      body: {
        candidates: [
          {
            content: {
              parts: images.map(img => ({
                inlineData: {
                  mimeType: img.mimeType,
                  data: img.data,
                },
              })),
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: usage,
      },
    };
  }

  describe('maxImagesPerCall', () => {
    it('should return 10 for Gemini image models by default', () => {
      expect(geminiModel.maxImagesPerCall).toBe(10);
    });

    it('should respect custom maxImagesPerCall setting', () => {
      const customModel = new GoogleImageModel(
        'gemini-2.5-flash-image',
        { maxImagesPerCall: 5 },
        {
          provider: 'google.generative-ai',
          baseURL: 'https://api.example.com/v1beta',
          headers: () => ({ 'api-key': 'test-api-key' }),
        },
      );
      expect(customModel.maxImagesPerCall).toBe(5);
    });
  });

  describe('doGenerate', () => {
    it('should extract the generated image', async () => {
      prepareGeminiJsonResponse();

      const result = await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.images).toStrictEqual(['base64-generated-image']);
    });

    it('should send correct request body with responseModalities', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.generationConfig.responseModalities).toStrictEqual([
        'IMAGE',
      ]);
      expect(requestBody.contents).toStrictEqual([
        {
          role: 'user',
          parts: [{ text: 'A beautiful sunset' }],
        },
      ]);
    });

    it('should pass aspectRatio via imageConfig', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {},
      });

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.generationConfig.imageConfig).toStrictEqual({
        aspectRatio: '16:9',
      });
    });

    it('should support Gemini-only aspect ratios like 21:9', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'A cinematic landscape',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '21:9',
        seed: undefined,
        providerOptions: {},
      });

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.generationConfig.imageConfig).toStrictEqual({
        aspectRatio: '21:9',
      });
    });

    it('should pass seed in generationConfig', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: 12345,
        providerOptions: {},
      });

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.generationConfig.seed).toBe(12345);
    });

    it('should include usage in response', async () => {
      prepareGeminiJsonResponse({
        usage: {
          promptTokenCount: 20,
          candidatesTokenCount: 200,
          totalTokenCount: 220,
        },
      });

      const result = await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result.usage).toStrictEqual({
        inputTokens: 20,
        outputTokens: 200,
        totalTokens: 220,
      });
    });

    it('should return warning for unsupported size option', async () => {
      prepareGeminiJsonResponse();

      const result = await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
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

    it('should not send a tools field when googleSearch is not set', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.tools).toBeUndefined();
    });

    it('should forward providerOptions.google.googleSearch as the google_search tool', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          google: {
            googleSearch: { searchTypes: { imageSearch: {} } },
          },
        },
      });

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.tools).toStrictEqual([
        { googleSearch: { searchTypes: { imageSearch: {} } } },
      ]);
    });

    it('should not leak googleSearch into providerOptions passthrough', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          google: {
            googleSearch: {},
          },
        },
      });

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.generationConfig.googleSearch).toBeUndefined();
    });

    it('should forward groundingMetadata from the language-model response into providerMetadata.google', async () => {
      const groundingMetadata = {
        webSearchQueries: ['who performs at the 2026 super bowl halftime show'],
        groundingChunks: [
          { web: { uri: 'https://example.com/source', title: 'Example' } },
        ],
      };
      geminiServer.urls[TEST_URL_GEMINI_IMAGE].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: 'base64-generated-image',
                    },
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              groundingMetadata,
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 100,
            totalTokenCount: 110,
          },
        },
      };

      const result = await geminiModel.doGenerate({
        prompt: 'A beautiful sunset',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          google: { googleSearch: {} },
        },
      });

      const googleMetadata = result.providerMetadata?.google as
        | Record<string, unknown>
        | undefined;
      expect(googleMetadata?.groundingMetadata).toStrictEqual(
        groundingMetadata,
      );
      // existing image metadata should be preserved alongside the LM metadata
      expect(googleMetadata?.images).toStrictEqual([{}]);
    });
  });

  describe('image editing', () => {
    it('should include input images in request for editing', async () => {
      prepareGeminiJsonResponse();

      await geminiModel.doGenerate({
        prompt: 'Add a hat to this cat',
        files: [
          {
            type: 'file',
            data: 'base64-source-image',
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

      const requestBody = await geminiServer.calls[0].requestBodyJson;
      expect(requestBody.contents[0].parts).toHaveLength(2);
      expect(requestBody.contents[0].parts[0]).toStrictEqual({
        text: 'Add a hat to this cat',
      });
      expect(requestBody.contents[0].parts[1]).toStrictEqual({
        inlineData: {
          mimeType: 'image/png',
          data: 'base64-source-image',
        },
      });
    });

    it('should throw for URL-based input images without resolvable media type', async () => {
      prepareGeminiJsonResponse();

      await expect(
        geminiModel.doGenerate({
          prompt: 'Add a hat to this cat',
          files: [
            {
              type: 'url',
              url: 'https://example.com/cat.png',
            },
          ],
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow(/media type "image\/\*".*not passed as inline bytes/);
    });
  });

  describe('unsupported options', () => {
    it('should throw error when n > 1', async () => {
      await expect(
        geminiModel.doGenerate({
          prompt: 'A beautiful sunset',
          files: undefined,
          mask: undefined,
          n: 2,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow(
        'Gemini image models do not support generating a set number of images per call.',
      );
    });

    it('should throw error when mask is provided', async () => {
      await expect(
        geminiModel.doGenerate({
          prompt: 'Edit this image',
          files: undefined,
          mask: {
            type: 'file',
            data: 'base64-mask-image',
            mediaType: 'image/png',
          },
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow(
        'Gemini image models do not support mask-based image editing.',
      );
    });
  });
});
