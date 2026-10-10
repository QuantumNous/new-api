import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import * as fs from 'node:fs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GoogleVertexImageModel } from './google-vertex-image-model';
import type { GoogleVertexImageModelOptions } from './google-vertex-image-model-options';
import { createGoogleVertex } from './google-vertex-provider-base';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const prompt = 'A cute baby sea otter';

const GENERATE_URL =
  'https://api.example.com/models/imagen-3.0-generate-002:predict';
const IMAGEN4_URL =
  'https://api.example.com/models/imagen-4.0-generate-preview-06-06:predict';
const IMAGEN4_FAST_URL =
  'https://api.example.com/models/imagen-4.0-fast-generate-preview-06-06:predict';
const IMAGEN4_ULTRA_URL =
  'https://api.example.com/models/imagen-4.0-ultra-generate-preview-06-06:predict';
const GEMINI_IMAGE_URL =
  'https://api.example.com/models/gemini-2.5-flash-image:generateContent';

const model = new GoogleVertexImageModel('imagen-3.0-generate-002', {
  provider: 'google-vertex',
  baseURL: 'https://api.example.com',
  headers: { 'api-key': 'test-key' },
});

const server = createTestServer({
  [GENERATE_URL]: {},
  [IMAGEN4_URL]: {},
  [IMAGEN4_FAST_URL]: {},
  [IMAGEN4_ULTRA_URL]: {},
  [GEMINI_IMAGE_URL]: {},
});

function prepareJsonFixtureResponse(
  url:
    | typeof GENERATE_URL
    | typeof IMAGEN4_URL
    | typeof IMAGEN4_FAST_URL
    | typeof IMAGEN4_ULTRA_URL,
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls[url].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('GoogleVertexImageModel', () => {
  describe('doGenerate', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse(GENERATE_URL, 'google-vertex-image');
    });

    it('should pass headers', async () => {
      const provider = createGoogleVertex({
        project: 'test-project',
        location: 'us-central1',
        baseURL: 'https://api.example.com',
        headers: { 'Custom-Provider-Header': 'provider-header-value' },
      });

      await provider.imageModel('imagen-3.0-generate-002').doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
        headers: { 'Custom-Request-Header': 'request-header-value' },
      });

      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "content-type": "application/json",
          "custom-provider-header": "provider-header-value",
          "custom-request-header": "request-header-value",
        }
      `);
      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/google-vertex/0.0.0-test`,
      );
    });

    it('should use default maxImagesPerCall when not specified', () => {
      const defaultModel = new GoogleVertexImageModel(
        'imagen-3.0-generate-002',
        {
          provider: 'google-vertex',
          baseURL: 'https://api.example.com',
          headers: { 'api-key': 'test-key' },
        },
      );

      expect(defaultModel.maxImagesPerCall).toBe(4);
    });

    it('should extract the generated images', async () => {
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

      expect(result.images).toMatchInlineSnapshot(`
        [
          "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
          "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
        ]
      `);
    });

    it('should return full result snapshot', async () => {
      const testDate = new Date('2024-03-15T12:00:00Z');
      const customModel = new GoogleVertexImageModel(
        'imagen-3.0-generate-002',
        {
          provider: 'google-vertex',
          baseURL: 'https://api.example.com',
          headers: { 'api-key': 'test-key' },
          _internal: { currentDate: () => testDate },
        },
      );

      const result = await customModel.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(result).toMatchSnapshot();
    });

    it('sends aspect ratio in the request', async () => {
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

    it('should pass seed directly when specified', async () => {
      await model.doGenerate({
        prompt: 'test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: 42,
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
            "sampleCount": 1,
            "seed": 42,
          },
        }
      `);
    });

    it('should combine aspectRatio, seed and provider options', async () => {
      await model.doGenerate({
        prompt: 'test prompt',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '1:1',
        seed: 42,
        providerOptions: {
          googleVertex: {
            addWatermark: false,
          } satisfies GoogleVertexImageModelOptions,
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
            "addWatermark": false,
            "aspectRatio": "1:1",
            "sampleCount": 1,
            "seed": 42,
          },
        }
      `);
    });

    it('should accept the legacy `vertex` providerOptions key', async () => {
      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '1:1',
        seed: 42,
        providerOptions: {
          vertex: {
            addWatermark: false,
          } satisfies GoogleVertexImageModelOptions,
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        parameters: {
          addWatermark: false,
        },
      });
    });

    it('should prefer `googleVertex` providerOptions over the legacy `vertex` key', async () => {
      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '1:1',
        seed: 42,
        providerOptions: {
          vertex: {
            addWatermark: true,
          } satisfies GoogleVertexImageModelOptions,
          googleVertex: {
            addWatermark: false,
          } satisfies GoogleVertexImageModelOptions,
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        parameters: {
          addWatermark: false,
        },
      });
    });

    it('should return warnings for unsupported settings', async () => {
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
        ]
      `);
    });

    it('should only pass valid provider options', async () => {
      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 2,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {
          googleVertex: {
            addWatermark: false,
            negativePrompt: 'negative prompt',
            personGeneration: 'allow_all',
            sampleImageSize: '2K',
            // @ts-expect-error Testing invalid option
            foo: 'bar',
          } satisfies GoogleVertexImageModelOptions,
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
            "addWatermark": false,
            "aspectRatio": "16:9",
            "negativePrompt": "negative prompt",
            "personGeneration": "allow_all",
            "sampleCount": 2,
            "sampleImageSize": "2K",
          },
        }
      `);
    });

    it('should return image meta data', async () => {
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

      expect(result.providerMetadata?.vertex).toMatchInlineSnapshot(`
        {
          "images": [
            {
              "revisedPrompt": "A minimalist image featuring a perfectly circular, solid red disk centrally positioned on a clean, bright white background. The red is a vibrant, primary hue. The edges of the circle are sharp and well-defined. The lighting is even and soft, with no harsh shadows or reflections, creating a flat, graphic quality.",
            },
            {
              "revisedPrompt": "A minimalist, bold image featuring a perfect red circle centrally positioned on a pristine white background. The circle has sharp, clean edges and a uniform, vibrant red color, providing a strong contrast against the pure white. The lighting is even and soft, with no harsh shadows or reflections, allowing the circle's shape and color to be the sole focus. The image has a clean, modern aesthetic.",
            },
          ],
        }
      `);
    });
  });

  describe('response headers', () => {
    it('should include response headers', async () => {
      prepareJsonFixtureResponse(GENERATE_URL, 'google-vertex-image', {
        'request-id': 'test-request-id',
        'x-goog-quota-remaining': '123',
      });

      const testDate = new Date('2024-03-15T12:00:00Z');
      const customModel = new GoogleVertexImageModel(
        'imagen-3.0-generate-002',
        {
          provider: 'google-vertex',
          baseURL: 'https://api.example.com',
          headers: { 'api-key': 'test-key' },
          _internal: { currentDate: () => testDate },
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

      expect(result.response).toMatchInlineSnapshot(`
        {
          "headers": {
            "content-length": "1050",
            "content-type": "application/json",
            "request-id": "test-request-id",
            "x-goog-quota-remaining": "123",
          },
          "modelId": "imagen-3.0-generate-002",
          "timestamp": 2024-03-15T12:00:00.000Z,
        }
      `);
    });
  });

  describe('response metadata', () => {
    it('should use real date when no custom date provider is specified', async () => {
      prepareJsonFixtureResponse(GENERATE_URL, 'google-vertex-image');
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
  });

  describe('Image Editing', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse(GENERATE_URL, 'google-vertex-image-edit');
    });

    it('should send edit request with files and mask', async () => {
      const imageData = 'base64-source-image';
      const maskData = 'base64-mask-image';

      await model.doGenerate({
        prompt: 'A sunlit indoor lounge with a flamingo',
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

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "prompt": "A sunlit indoor lounge with a flamingo",
              "referenceImages": [
                {
                  "referenceId": 1,
                  "referenceImage": {
                    "bytesBase64Encoded": "base64-source-image",
                  },
                  "referenceType": "REFERENCE_TYPE_RAW",
                },
                {
                  "maskImageConfig": {
                    "maskMode": "MASK_MODE_USER_PROVIDED",
                  },
                  "referenceId": 2,
                  "referenceImage": {
                    "bytesBase64Encoded": "base64-mask-image",
                  },
                  "referenceType": "REFERENCE_TYPE_MASK",
                },
              ],
            },
          ],
          "parameters": {
            "editMode": "EDIT_MODE_INPAINT_INSERTION",
            "sampleCount": 1,
          },
        }
      `);
    });

    it('should send edit request with Uint8Array data', async () => {
      const imageUint8Array = new Uint8Array([104, 101, 108, 108, 111]);
      const maskUint8Array = new Uint8Array([119, 111, 114, 108, 100]);

      await model.doGenerate({
        prompt: 'Edit this image',
        files: [
          {
            type: 'file',
            data: imageUint8Array,
            mediaType: 'image/png',
          },
        ],
        mask: {
          type: 'file',
          data: maskUint8Array,
          mediaType: 'image/png',
        },
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.instances[0].referenceImages[0].referenceImage
          .bytesBase64Encoded,
      ).toMatchInlineSnapshot(`"aGVsbG8="`);
      expect(
        requestBody.instances[0].referenceImages[1].referenceImage
          .bytesBase64Encoded,
      ).toMatchInlineSnapshot(`"d29ybGQ="`);
    });

    it('should send edit request with custom edit options', async () => {
      await model.doGenerate({
        prompt: 'Remove the object',
        files: [
          {
            type: 'file',
            data: 'base64-source-image',
            mediaType: 'image/png',
          },
        ],
        mask: {
          type: 'file',
          data: 'base64-mask-image',
          mediaType: 'image/png',
        },
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          googleVertex: {
            edit: {
              mode: 'EDIT_MODE_INPAINT_REMOVAL',
              baseSteps: 50,
              maskMode: 'MASK_MODE_USER_PROVIDED',
              maskDilation: 0.01,
            },
          } satisfies GoogleVertexImageModelOptions,
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "prompt": "Remove the object",
              "referenceImages": [
                {
                  "referenceId": 1,
                  "referenceImage": {
                    "bytesBase64Encoded": "base64-source-image",
                  },
                  "referenceType": "REFERENCE_TYPE_RAW",
                },
                {
                  "maskImageConfig": {
                    "dilation": 0.01,
                    "maskMode": "MASK_MODE_USER_PROVIDED",
                  },
                  "referenceId": 2,
                  "referenceImage": {
                    "bytesBase64Encoded": "base64-mask-image",
                  },
                  "referenceType": "REFERENCE_TYPE_MASK",
                },
              ],
            },
          ],
          "parameters": {
            "editConfig": {
              "baseSteps": 50,
            },
            "editMode": "EDIT_MODE_INPAINT_REMOVAL",
            "sampleCount": 1,
          },
        }
      `);
    });

    it('should extract the edited images', async () => {
      const result = await model.doGenerate({
        prompt: 'Edit this image',
        files: [
          {
            type: 'file',
            data: 'base64-source-image',
            mediaType: 'image/png',
          },
        ],
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
      });

      expect(result.images).toMatchInlineSnapshot(`
        [
          "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
        ]
      `);
    });

    it('should send edit request without mask (for operations that do not require mask)', async () => {
      await model.doGenerate({
        prompt: 'Upscale this image',
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
        providerOptions: {
          googleVertex: {
            edit: { mode: 'EDIT_MODE_CONTROLLED_EDITING' },
          } satisfies GoogleVertexImageModelOptions,
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "prompt": "Upscale this image",
              "referenceImages": [
                {
                  "referenceId": 1,
                  "referenceImage": {
                    "bytesBase64Encoded": "base64-source-image",
                  },
                  "referenceType": "REFERENCE_TYPE_RAW",
                },
              ],
            },
          ],
          "parameters": {
            "editMode": "EDIT_MODE_CONTROLLED_EDITING",
            "sampleCount": 1,
          },
        }
      `);
    });
  });

  describe('Imagen 4 Models', () => {
    describe('imagen-4.0-generate-preview-06-06', () => {
      const imagen4Model = new GoogleVertexImageModel(
        'imagen-4.0-generate-preview-06-06',
        {
          provider: 'google-vertex',
          baseURL: 'https://api.example.com',
          headers: { 'api-key': 'test-key' },
        },
      );

      beforeEach(() => {
        prepareJsonFixtureResponse(IMAGEN4_URL, 'google-vertex-image');
      });

      it('should generate images with Imagen 4', async () => {
        const result = await imagen4Model.doGenerate({
          prompt: 'A beautiful sunset over mountains',
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: '16:9',
          seed: 42,
          providerOptions: {
            googleVertex: {
              addWatermark: false,
            } satisfies GoogleVertexImageModelOptions,
          },
        });

        expect(result.images).toMatchInlineSnapshot(`
          [
            "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
            "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
          ]
        `);
        expect(result.providerMetadata?.vertex).toMatchInlineSnapshot(`
          {
            "images": [
              {
                "revisedPrompt": "A minimalist image featuring a perfectly circular, solid red disk centrally positioned on a clean, bright white background. The red is a vibrant, primary hue. The edges of the circle are sharp and well-defined. The lighting is even and soft, with no harsh shadows or reflections, creating a flat, graphic quality.",
              },
              {
                "revisedPrompt": "A minimalist, bold image featuring a perfect red circle centrally positioned on a pristine white background. The circle has sharp, clean edges and a uniform, vibrant red color, providing a strong contrast against the pure white. The lighting is even and soft, with no harsh shadows or reflections, allowing the circle's shape and color to be the sole focus. The image has a clean, modern aesthetic.",
              },
            ],
          }
        `);
      });

      it('should send correct request parameters for Imagen 4', async () => {
        await imagen4Model.doGenerate({
          prompt: 'test imagen 4 prompt',
          files: undefined,
          mask: undefined,
          n: 2,
          size: undefined,
          aspectRatio: '1:1',
          seed: 123,
          providerOptions: {
            googleVertex: {
              personGeneration: 'allow_adult',
              safetySetting: 'block_medium_and_above',
            } satisfies GoogleVertexImageModelOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "instances": [
              {
                "prompt": "test imagen 4 prompt",
              },
            ],
            "parameters": {
              "aspectRatio": "1:1",
              "personGeneration": "allow_adult",
              "safetySetting": "block_medium_and_above",
              "sampleCount": 2,
              "seed": 123,
            },
          }
        `);
      });
    });

    describe('imagen-4.0-fast-generate-preview-06-06', () => {
      const imagen4FastModel = new GoogleVertexImageModel(
        'imagen-4.0-fast-generate-preview-06-06',
        {
          provider: 'google-vertex',
          baseURL: 'https://api.example.com',
          headers: { 'api-key': 'test-key' },
        },
      );

      beforeEach(() => {
        prepareJsonFixtureResponse(IMAGEN4_FAST_URL, 'google-vertex-image');
      });

      it('should generate images with Imagen 4 Fast', async () => {
        const result = await imagen4FastModel.doGenerate({
          prompt: 'A quick sketch of a cat',
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: '3:4',
          seed: undefined,
          providerOptions: {},
        });

        expect(result.images).toMatchInlineSnapshot(`
          [
            "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
            "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
          ]
        `);
        expect(result.providerMetadata?.vertex).toMatchInlineSnapshot(`
          {
            "images": [
              {
                "revisedPrompt": "A minimalist image featuring a perfectly circular, solid red disk centrally positioned on a clean, bright white background. The red is a vibrant, primary hue. The edges of the circle are sharp and well-defined. The lighting is even and soft, with no harsh shadows or reflections, creating a flat, graphic quality.",
              },
              {
                "revisedPrompt": "A minimalist, bold image featuring a perfect red circle centrally positioned on a pristine white background. The circle has sharp, clean edges and a uniform, vibrant red color, providing a strong contrast against the pure white. The lighting is even and soft, with no harsh shadows or reflections, allowing the circle's shape and color to be the sole focus. The image has a clean, modern aesthetic.",
              },
            ],
          }
        `);
      });
    });

    describe('imagen-4.0-ultra-generate-preview-06-06', () => {
      const imagen4UltraModel = new GoogleVertexImageModel(
        'imagen-4.0-ultra-generate-preview-06-06',
        {
          provider: 'google-vertex',
          baseURL: 'https://api.example.com',
          headers: { 'api-key': 'test-key' },
        },
      );

      beforeEach(() => {
        prepareJsonFixtureResponse(IMAGEN4_ULTRA_URL, 'google-vertex-image');
      });

      it('should generate images with Imagen 4 Ultra', async () => {
        const result = await imagen4UltraModel.doGenerate({
          prompt: 'A highly detailed photorealistic portrait',
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: '4:3',
          seed: 999,
          providerOptions: {
            googleVertex: {
              negativePrompt: 'blurry, low quality',
              addWatermark: true,
            } satisfies GoogleVertexImageModelOptions,
          },
        });

        expect(result.images).toMatchInlineSnapshot(`
          [
            "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
            "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAg3pUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYs7DsIwEAV7",
          ]
        `);
        expect(result.providerMetadata?.vertex).toMatchInlineSnapshot(`
          {
            "images": [
              {
                "revisedPrompt": "A minimalist image featuring a perfectly circular, solid red disk centrally positioned on a clean, bright white background. The red is a vibrant, primary hue. The edges of the circle are sharp and well-defined. The lighting is even and soft, with no harsh shadows or reflections, creating a flat, graphic quality.",
              },
              {
                "revisedPrompt": "A minimalist, bold image featuring a perfect red circle centrally positioned on a pristine white background. The circle has sharp, clean edges and a uniform, vibrant red color, providing a strong contrast against the pure white. The lighting is even and soft, with no harsh shadows or reflections, allowing the circle's shape and color to be the sole focus. The image has a clean, modern aesthetic.",
              },
            ],
          }
        `);
      });

      it('should handle all provider options with Imagen 4 Ultra', async () => {
        await imagen4UltraModel.doGenerate({
          prompt: 'comprehensive test prompt',
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {
            googleVertex: {
              negativePrompt: 'avoid this content',
              personGeneration: 'dont_allow',
              safetySetting: 'block_only_high',
              addWatermark: true,
              storageUri: 'gs://my-bucket/images/',
            } satisfies GoogleVertexImageModelOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "instances": [
              {
                "prompt": "comprehensive test prompt",
              },
            ],
            "parameters": {
              "addWatermark": true,
              "negativePrompt": "avoid this content",
              "personGeneration": "dont_allow",
              "safetySetting": "block_only_high",
              "sampleCount": 1,
              "storageUri": "gs://my-bucket/images/",
            },
          }
        `);
      });
    });
  });
});

describe('GoogleVertexImageModel (Gemini)', () => {
  const geminiModel = new GoogleVertexImageModel('gemini-2.5-flash-image', {
    provider: 'google.vertex.image',
    baseURL: 'https://api.example.com',
    headers: { 'api-key': 'test-key' },
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
    server.urls[GEMINI_IMAGE_URL].response = {
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
    it('should return 10 for Gemini image models', () => {
      expect(geminiModel.maxImagesPerCall).toBe(10);
    });

    it('should return 4 for Imagen models', () => {
      const imagenModel = new GoogleVertexImageModel(
        'imagen-3.0-generate-002',
        {
          provider: 'google.vertex.image',
          baseURL: 'https://api.example.com',
          headers: { 'api-key': 'test-key' },
        },
      );
      expect(imagenModel.maxImagesPerCall).toBe(4);
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

      const requestBody = await server.calls[0].requestBodyJson;
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

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.generationConfig.imageConfig).toStrictEqual({
        aspectRatio: '16:9',
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

      const requestBody = await server.calls[0].requestBodyJson;
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

      const requestBody = await server.calls[0].requestBodyJson;
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
