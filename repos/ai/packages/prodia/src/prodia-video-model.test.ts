import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { ProdiaVideoModel } from './prodia-video-model';

const prompt = 'A cat walking on a beach';

function createBasicModel({
  headers,
  fetch,
  currentDate,
  modelId = 'inference.wan2-2.lightning.txt2vid.v0',
}: {
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
  modelId?: string;
} = {}) {
  return new ProdiaVideoModel(modelId, {
    provider: 'prodia.video',
    baseURL: 'https://api.example.com/v2',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-key' })),
    fetch,
    _internal: {
      currentDate,
    },
  });
}

function createVideoMultipartResponse(
  jobResult: Record<string, unknown>,
  videoContent: string = 'test-video-content',
  videoContentType: string = 'video/mp4',
  videoFilename: string = 'output.mp4',
): { body: Buffer; contentType: string } {
  const boundary = 'test-boundary-12345';
  const jobJson = JSON.stringify(jobResult);
  const videoBuffer = Buffer.from(videoContent);

  const parts = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="job"; filename="job.json"\r\n',
    'Content-Type: application/json\r\n',
    '\r\n',
    jobJson,
    '\r\n',
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="output"; filename="${videoFilename}"\r\n`,
    `Content-Type: ${videoContentType}\r\n`,
    '\r\n',
  ];

  const headerPart = Buffer.from(parts.join(''));
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat([headerPart, videoBuffer, endPart]);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const defaultJobResult = {
  id: 'job-vid-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:10Z',
  state: { current: 'completed' },
  config: { prompt, seed: 99 },
  metrics: { elapsed: 5.0, ips: 3.2 },
  price: { product: 'wan2-2.lightning', dollars: 0.05 },
};

describe('ProdiaVideoModel', () => {
  const multipartResponse = createVideoMultipartResponse(defaultJobResult);

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
    'https://cdn.example.com/input.png': {
      response: {
        type: 'binary',
        body: Buffer.from('input-image-bytes'),
        headers: { 'content-type': 'image/png' },
      },
    },
  });

  describe('constructor', () => {
    it('exposes correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('prodia.video');
      expect(model.modelId).toBe('inference.wan2-2.lightning.txt2vid.v0');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(1);
    });
  });

  describe('doGenerate - txt2vid', () => {
    it('sends correct JSON request body with prompt', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.wan2-2.lightning.txt2vid.v0',
        config: {
          prompt,
        },
      });
    });

    it('includes seed when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: 42,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.wan2-2.lightning.txt2vid.v0',
        config: {
          prompt,
          seed: 42,
        },
      });
    });

    it('includes resolution from provider options', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {
          prodia: {
            resolution: '720p',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        type: 'inference.wan2-2.lightning.txt2vid.v0',
        config: {
          prompt,
          resolution: '720p',
        },
      });
    });

    it('calls the correct endpoint', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/v2/job?price=true',
      );
    });

    it('sends correct Accept header', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestHeaders.accept).toBe(
        'multipart/form-data; video/mp4',
      );
    });

    it('sends Content-Type: application/json for txt2vid', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestHeaders['content-type']).toBe(
        'application/json',
      );
    });

    it('merges provider and request headers', async () => {
      const model = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-value',
          Authorization: 'Bearer test-key',
        }),
      });

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
        headers: {
          'Custom-Request-Header': 'request-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        'custom-provider-header': 'provider-value',
        'custom-request-header': 'request-value',
        authorization: 'Bearer test-key',
      });
    });

    it('returns video data from multipart response', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(result.videos).toHaveLength(1);
      const video = result.videos[0];
      expect(video.type).toBe('binary');
      expect(video.mediaType).toBe('video/mp4');
      expect(
        video.type === 'binary' && Buffer.from(video.data).toString(),
      ).toBe('test-video-content');
    });

    it('returns provider metadata', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata?.prodia).toStrictEqual({
        videos: [
          {
            jobId: 'job-vid-123',
            seed: 99,
            elapsed: 5.0,
            iterationsPerSecond: 3.2,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:10Z',
            dollars: 0.05,
          },
        ],
      });
    });

    it('includes timestamp and modelId in response', async () => {
      const testDate = new Date('2025-06-01T00:00:00Z');
      const model = createBasicModel({ currentDate: () => testDate });

      const result = await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'inference.wan2-2.lightning.txt2vid.v0',
        headers: expect.any(Object),
      });
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
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          providerOptions: {},
        }),
      ).rejects.toMatchObject({
        message: 'Prompt cannot be empty',
        statusCode: 400,
        url: 'https://api.example.com/v2/job?price=true',
      });
    });
  });

  describe('doGenerate - img2vid', () => {
    it('sends multipart form-data when image is provided', async () => {
      const model = createBasicModel({
        modelId: 'inference.wan2-2.lightning.img2vid.v0',
      });

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([1, 2, 3, 4]),
        },
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestHeaders['content-type']).toContain(
        'multipart/form-data',
      );
    });

    it('downloads a public image URL and sends it as multipart form-data', async () => {
      const model = createBasicModel({
        modelId: 'inference.wan2-2.lightning.img2vid.v0',
      });

      await model.doGenerate({
        prompt,
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: {
          type: 'url',
          url: 'https://cdn.example.com/input.png',
        },
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      // The image is downloaded, then the job is POSTed as multipart form-data.
      expect(
        server.calls.some(
          call => call.requestUrl === 'https://cdn.example.com/input.png',
        ),
      ).toBe(true);
      const jobCall = server.calls.find(
        call => call.requestUrl === 'https://api.example.com/v2/job?price=true',
      );
      expect(jobCall?.requestMethod).toBe('POST');
      expect(jobCall?.requestHeaders['content-type']).toContain(
        'multipart/form-data',
      );
    });

    it('blocks an image URL pointing at a private address (SSRF guard)', async () => {
      const model = createBasicModel({
        modelId: 'inference.wan2-2.lightning.img2vid.v0',
      });

      await expect(
        model.doGenerate({
          prompt,
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          generateAudio: undefined,
          image: {
            type: 'url',
            url: 'http://169.254.169.254/latest/meta-data/',
          },
          frameImages: undefined,
          inputReferences: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow();

      // The internal URL must never be requested, and no job is submitted.
      expect(
        server.calls.some(call => call.requestUrl.includes('169.254.169.254')),
      ).toBe(false);
      expect(
        server.calls.some(call => call.requestUrl.includes('/v2/job')),
      ).toBe(false);
    });
  });
});
