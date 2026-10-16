import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { ProdiaImageModel } from './prodia-image-model';

const prompt = 'A cute baby sea otter';

function createBasicModel({
  headers,
  fetch,
  currentDate,
}: {
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
} = {}) {
  return new ProdiaImageModel('inference.flux-fast.schnell.txt2img.v2', {
    provider: 'prodia.image',
    baseURL: 'https://api.example.com/v2',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-key' })),
    fetch,
    _internal: {
      currentDate,
    },
  });
}

function createMultipartResponse(
  jobResult: Record<string, unknown>,
  imageContent: string = 'test-binary-content',
): { body: Buffer; contentType: string } {
  const boundary = 'test-boundary-12345';
  const jobJson = JSON.stringify(jobResult);
  const imageBuffer = Buffer.from(imageContent);

  const parts = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="job"; filename="job.json"\r\n',
    'Content-Type: application/json\r\n',
    '\r\n',
    jobJson,
    '\r\n',
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="output"; filename="output.png"\r\n',
    'Content-Type: image/png\r\n',
    '\r\n',
  ];

  const headerPart = Buffer.from(parts.join(''));
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat([headerPart, imageBuffer, endPart]);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const defaultJobResult = {
  id: 'job-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:05Z',
  state: { current: 'completed' },
  config: { prompt, seed: 42 },
  metrics: { elapsed: 2.5, ips: 10.5 },
  price: { product: 'flux-fast.schnell', dollars: 0.0025 },
};

describe('ProdiaImageModel', () => {
  const multipartResponse = createMultipartResponse(defaultJobResult);

  const server = createTestServer({
    'https://api.example.com/v2/job?price=true': {
      response: {
        type: 'binary',
        body: multipartResponse.body,
        headers: {
          'content-type': multipartResponse.contentType,
        },
      },
    },
  });

  describe('doGenerate', () => {
    it('passes the correct parameters including providerOptions', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: 12345,
        providerOptions: {
          prodia: {
            steps: 4,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.flux-fast.schnell.txt2img.v2',
        config: {
          prompt,
          seed: 12345,
          steps: 4,
        },
      });
    });

    it('includes width and height when size is provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x768',
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.flux-fast.schnell.txt2img.v2',
        config: {
          prompt,
          width: 1024,
          height: 768,
        },
      });
    });

    it('provider options width/height take precedence over size', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x768',
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          prodia: {
            width: 512,
            height: 512,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.flux-fast.schnell.txt2img.v2',
        config: {
          prompt,
          width: 512,
          height: 512,
        },
      });
    });

    it('includes style_preset when stylePreset is provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          prodia: {
            stylePreset: 'anime',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.flux-fast.schnell.txt2img.v2',
        config: {
          prompt,
          style_preset: 'anime',
        },
      });
    });

    it('includes loras when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          prodia: {
            loras: ['prodia/lora/flux/anime@v1', 'prodia/lora/flux/realism@v1'],
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.flux-fast.schnell.txt2img.v2',
        config: {
          prompt,
          loras: ['prodia/lora/flux/anime@v1', 'prodia/lora/flux/realism@v1'],
        },
      });
    });

    it('includes progressive when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {
          prodia: {
            progressive: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.flux-fast.schnell.txt2img.v2',
        config: {
          prompt,
          progressive: true,
        },
      });
    });

    it('calls the correct endpoint', async () => {
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

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/v2/job?price=true',
      );
    });

    it('sends Accept: multipart/form-data header', async () => {
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

      expect(server.calls[0].requestHeaders.accept).toBe(
        'multipart/form-data; image/png',
      );
    });

    it('merges provider and request headers', async () => {
      const modelWithHeaders = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-header-value',
          Authorization: 'Bearer test-key',
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

      expect(server.calls[0].requestHeaders).toMatchObject({
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
        authorization: 'Bearer test-key',
        accept: 'multipart/form-data; image/png',
      });
    });

    it('returns image bytes from multipart response', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
        providerOptions: {},
      });

      expect(result.images).toHaveLength(1);
      const image = result.images[0];
      expect(image).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(image as Uint8Array<ArrayBufferLike>).toString()).toBe(
        'test-binary-content',
      );
    });

    it('returns provider metadata from job result', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata?.prodia).toStrictEqual({
        images: [
          {
            jobId: 'job-123',
            seed: 42,
            elapsed: 2.5,
            iterationsPerSecond: 10.5,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:05Z',
            dollars: 0.0025,
          },
        ],
      });
    });

    it('omits optional metadata fields when not present in job result', async () => {
      const minimalJobResult = {
        id: 'job-456',
        state: { current: 'completed' },
        config: { prompt },
      };
      const response = createMultipartResponse(minimalJobResult);

      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'binary',
        body: response.body,
        headers: {
          'content-type': response.contentType,
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata?.prodia).toStrictEqual({
        images: [
          {
            jobId: 'job-456',
          },
        ],
      });
    });

    it('warns on invalid size format', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: 'invalid' as `${number}x${number}`,
        seed: undefined,
        aspectRatio: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Invalid size format: invalid. Expected format: WIDTHxHEIGHT (e.g., 1024x1024)",
            "feature": "size",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('handles API errors', async () => {
      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          message: 'Invalid prompt',
          detail: 'Prompt cannot be empty',
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
        message: 'Prompt cannot be empty',
        statusCode: 400,
        url: 'https://api.example.com/v2/job?price=true',
      });
    });

    it('includes dollars in metadata when price is present', async () => {
      const jobResultWithPrice = {
        id: 'job-789',
        state: { current: 'completed' },
        config: { prompt },
        price: { product: 'flux-fast.schnell', dollars: 0.005 },
      };
      const response = createMultipartResponse(jobResultWithPrice);

      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'binary',
        body: response.body,
        headers: {
          'content-type': response.contentType,
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata?.prodia).toStrictEqual({
        images: [
          {
            jobId: 'job-789',
            dollars: 0.005,
          },
        ],
      });
    });

    it('omits dollars from metadata when price is absent', async () => {
      const jobResultWithoutPrice = {
        id: 'job-790',
        state: { current: 'completed' },
        config: { prompt },
      };
      const response = createMultipartResponse(jobResultWithoutPrice);

      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'binary',
        body: response.body,
        headers: {
          'content-type': response.contentType,
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata?.prodia).toStrictEqual({
        images: [
          {
            jobId: 'job-790',
          },
        ],
      });
    });

    it('omits dollars from metadata when price is null', async () => {
      const jobResultWithNullPrice = {
        id: 'job-791',
        state: { current: 'completed' },
        config: { prompt },
        price: null,
      };
      const response = createMultipartResponse(jobResultWithNullPrice);

      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'binary',
        body: response.body,
        headers: {
          'content-type': response.contentType,
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata?.prodia).toStrictEqual({
        images: [
          {
            jobId: 'job-791',
          },
        ],
      });
    });

    it('includes timestamp, headers, and modelId in response metadata', async () => {
      const response = createMultipartResponse(defaultJobResult);
      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'binary',
        body: response.body,
        headers: {
          'content-type': response.contentType,
        },
      };

      const testDate = new Date('2025-01-01T00:00:00Z');
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
        modelId: 'inference.flux-fast.schnell.txt2img.v2',
        headers: expect.any(Object),
      });
    });
  });

  describe('constructor', () => {
    it('exposes correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('prodia.image');
      expect(model.modelId).toBe('inference.flux-fast.schnell.txt2img.v2');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });
});
