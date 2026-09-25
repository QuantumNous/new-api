import { describe, expect, it, vi } from 'vitest';
import { ReplicateVideoModel } from './replicate-video-model';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const prompt = 'A rocket launching into space';

const defaultOptions = {
  prompt,
  n: 1,
  image: undefined,
  frameImages: undefined,
  inputReferences: undefined,
  aspectRatio: undefined,
  resolution: undefined,
  duration: undefined,
  fps: undefined,
  seed: undefined,
  generateAudio: undefined,
  providerOptions: {
    replicate: {
      pollIntervalMs: 10, // Use short polling interval for tests
    },
  },
} as const;

function createMockModel({
  modelId = 'minimax/video-01',
  currentDate,
  predictionId = 'test-prediction-id',
  predictionStatus = 'succeeded',
  output = 'https://replicate.delivery/video.mp4',
  error,
  pollsUntilDone = 1,
  onRequest,
  apiToken = 'test-api-token',
  metrics = { predict_time: 25.5 },
}: {
  modelId?: string;
  currentDate?: () => Date;
  predictionId?: string;
  predictionStatus?: string;
  output?: string | null;
  error?: string;
  pollsUntilDone?: number;
  onRequest?: (
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ) => void;
  apiToken?: string;
  metrics?: { predict_time?: number | null } | null;
} = {}) {
  let pollCount = 0;

  return new ReplicateVideoModel(modelId, {
    provider: 'replicate.video',
    baseURL: 'https://api.replicate.com/v1',
    headers: () => ({
      Authorization: `Bearer ${apiToken}`,
    }),
    fetch: async (url, init) => {
      const urlString = url.toString();
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const headers = (init?.headers as Record<string, string>) ?? {};

      onRequest?.(urlString, body, headers);

      if (
        urlString.includes('/predictions') &&
        init?.method !== 'GET' &&
        !urlString.includes(predictionId)
      ) {
        return new Response(
          JSON.stringify({
            id: predictionId,
            status: pollsUntilDone === 0 ? predictionStatus : 'starting',
            output: pollsUntilDone === 0 ? output : null,
            error: pollsUntilDone === 0 ? error : null,
            urls: {
              get: `https://api.replicate.com/v1/predictions/${predictionId}`,
            },
            metrics: pollsUntilDone === 0 ? metrics : null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (urlString.includes(`/predictions/${predictionId}`)) {
        pollCount++;

        if (pollCount < pollsUntilDone) {
          return new Response(
            JSON.stringify({
              id: predictionId,
              status: 'processing',
              output: null,
              error: null,
              urls: {
                get: `https://api.replicate.com/v1/predictions/${predictionId}`,
              },
              metrics: null,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        return new Response(
          JSON.stringify({
            id: predictionId,
            status: predictionStatus,
            output,
            error,
            urls: {
              get: `https://api.replicate.com/v1/predictions/${predictionId}`,
            },
            metrics,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response('Not found', { status: 404 });
    },
    _internal: {
      currentDate,
    },
  });
}

describe('ReplicateVideoModel', () => {
  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createMockModel();

      expect(model.provider).toBe('replicate.video');
      expect(model.modelId).toBe('minimax/video-01');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(1);
    });

    it('should support model IDs with versions', () => {
      const model = createMockModel({
        modelId: 'stability-ai/stable-video-diffusion:abc123',
      });

      expect(model.modelId).toBe('stability-ai/stable-video-diffusion:abc123');
    });
  });

  describe('doGenerate', () => {
    it('does not send the API key when the poll URL is on a foreign origin', async () => {
      const foreignUrl = 'https://evil.replicate.example/v1/predictions/forged';
      const headersByUrl: Record<string, Record<string, string>> = {};

      const model = new ReplicateVideoModel('minimax/video-01', {
        provider: 'replicate.video',
        baseURL: 'https://api.replicate.com/v1',
        headers: () => ({ Authorization: 'Bearer test-api-token' }),
        fetch: async (url, init) => {
          const urlString = url.toString();
          headersByUrl[urlString] =
            (init?.headers as Record<string, string>) ?? {};

          // Initial create-prediction POST returns a forged, foreign poll URL.
          if (init?.method !== 'GET' && urlString !== foreignUrl) {
            return new Response(
              JSON.stringify({
                id: 'forged',
                status: 'starting',
                output: null,
                error: null,
                urls: { get: foreignUrl },
                metrics: null,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }

          // Poll on the foreign URL resolves immediately.
          return new Response(
            JSON.stringify({
              id: 'forged',
              status: 'succeeded',
              output: 'https://replicate.delivery/video.mp4',
              error: null,
              urls: { get: foreignUrl },
              metrics: { predict_time: 1 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        },
      });

      await model.doGenerate({ ...defaultOptions });

      expect(headersByUrl[foreignUrl]).toBeDefined();
      expect(headersByUrl[foreignUrl].Authorization).toBeUndefined();
    });

    it('should pass the correct parameters including prompt', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({ ...defaultOptions });

      expect(capturedBody).toMatchObject({
        input: { prompt },
      });
    });

    it('should use /models/{modelId}/predictions for models without version', async () => {
      let capturedUrl: string = '';
      const model = createMockModel({
        modelId: 'minimax/video-01',
        pollsUntilDone: 0,
        onRequest: url => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedUrl = url;
          }
        },
      });

      await model.doGenerate({ ...defaultOptions });

      expect(capturedUrl).toBe(
        'https://api.replicate.com/v1/models/minimax/video-01/predictions',
      );
    });

    it('should use /predictions with version for models with version', async () => {
      let capturedUrl: string = '';
      let capturedBody: unknown;
      const model = createMockModel({
        modelId: 'stability-ai/stable-video-diffusion:abc123',
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedUrl = url;
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({ ...defaultOptions });

      expect(capturedUrl).toBe('https://api.replicate.com/v1/predictions');
      expect(capturedBody).toMatchObject({
        version: 'abc123',
      });
    });

    it('should pass seed when provided', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        seed: 42,
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          seed: 42,
        },
      });
    });

    it('should pass aspect ratio when provided', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          aspect_ratio: '16:9',
        },
      });
    });

    it('should pass through 9:16 aspect ratio', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '9:16',
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          aspect_ratio: '9:16',
        },
      });
    });

    it('should pass through 1:1 aspect ratio', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '1:1',
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          aspect_ratio: '1:1',
        },
      });
    });

    it('should pass through other aspect ratios', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '4:3',
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          aspect_ratio: '4:3', // Unmapped ratios pass through
        },
      });
    });

    it('should pass resolution as size when provided', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        resolution: '1920x1080',
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          size: '1920x1080',
        },
      });
    });

    it('should pass duration when provided', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        duration: 5,
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          duration: 5,
        },
      });
    });

    it('should pass fps when provided', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        fps: 30,
      });

      expect(capturedBody).toMatchObject({
        input: {
          prompt,
          fps: 30,
        },
      });
    });

    it('should return video with correct data', async () => {
      const model = createMockModel({
        output: 'https://replicate.delivery/video-output.mp4',
        pollsUntilDone: 0,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://replicate.delivery/video-output.mp4',
        mediaType: 'video/mp4',
      });
    });

    it('should return warnings array', async () => {
      const model = createMockModel({ pollsUntilDone: 0 });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('response metadata', () => {
    it('should include timestamp and modelId in response', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createMockModel({
        currentDate: () => testDate,
        pollsUntilDone: 0,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.response.timestamp).toStrictEqual(testDate);
      expect(result.response.modelId).toBe('minimax/video-01');
    });
  });

  describe('providerMetadata', () => {
    it('should include prediction metadata', async () => {
      const model = createMockModel({
        predictionId: 'test-pred-123',
        metrics: { predict_time: 25.5 },
        pollsUntilDone: 0,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata).toMatchObject({
        replicate: {
          predictionId: 'test-pred-123',
          metrics: { predict_time: 25.5 },
        },
      });
    });
  });

  describe('Image-to-Video', () => {
    it('should send URL-based image directly', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/image.png',
        },
      });

      const body = capturedBody as { input: { image: string } };
      expect(body.input.image).toBe('https://example.com/image.png');
    });

    it('should convert base64 image to data URI', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'file',
          data: 'base64-image-data',
          mediaType: 'image/png',
        },
      });

      const body = capturedBody as { input: { image: string } };
      expect(body.input.image).toBe('data:image/png;base64,base64-image-data');
    });
  });

  describe('Provider Options', () => {
    it('should pass guidance_scale option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          replicate: {
            pollIntervalMs: 10,
            guidance_scale: 7.5,
          },
        },
      });

      const body = capturedBody as { input: Record<string, unknown> };
      expect(body.input.guidance_scale).toBe(7.5);
    });

    it('should pass num_inference_steps option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          replicate: {
            pollIntervalMs: 10,
            num_inference_steps: 50,
          },
        },
      });

      const body = capturedBody as { input: Record<string, unknown> };
      expect(body.input.num_inference_steps).toBe(50);
    });

    it('should pass motion_bucket_id for Stable Video Diffusion', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          replicate: {
            pollIntervalMs: 10,
            motion_bucket_id: 127,
          },
        },
      });

      const body = capturedBody as { input: Record<string, unknown> };
      expect(body.input.motion_bucket_id).toBe(127);
    });

    it('should pass prompt_optimizer for MiniMax', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          replicate: {
            pollIntervalMs: 10,
            prompt_optimizer: true,
          },
        },
      });

      const body = capturedBody as { input: Record<string, unknown> };
      expect(body.input.prompt_optimizer).toBe(true);
    });

    it('should pass through custom options', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          replicate: {
            pollIntervalMs: 10,
            custom_param: 'custom_value',
          },
        },
      });

      const body = capturedBody as { input: Record<string, unknown> };
      expect(body.input.custom_param).toBe('custom_value');
    });

    it('should use maxWaitTimeInSeconds in prefer header', async () => {
      let capturedHeaders: Record<string, string> = {};
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body, headers) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedHeaders = headers;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          replicate: {
            pollIntervalMs: 10,
            maxWaitTimeInSeconds: 30,
          },
        },
      });

      expect(capturedHeaders.prefer).toBe('wait=30');
    });

    it('should use prefer: wait when maxWaitTimeInSeconds not provided', async () => {
      let capturedHeaders: Record<string, string> = {};
      const model = createMockModel({
        pollsUntilDone: 0,
        onRequest: (url, body, headers) => {
          if (
            url.includes('/predictions') &&
            !url.includes('test-prediction')
          ) {
            capturedHeaders = headers;
          }
        },
      });

      await model.doGenerate({ ...defaultOptions });

      expect(capturedHeaders.prefer).toBe('wait');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when prediction fails', async () => {
      const model = createMockModel({
        predictionStatus: 'failed',
        error: 'Video generation failed: insufficient credits',
        pollsUntilDone: 0,
      });

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('insufficient credits'),
      });
    });

    it('should throw error when prediction is canceled', async () => {
      const model = createMockModel({
        predictionStatus: 'canceled',
        pollsUntilDone: 0,
      });

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('canceled'),
      });
    });

    it('should throw error when no video URL in response', async () => {
      const model = createMockModel({
        output: null,
        pollsUntilDone: 0,
      });

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: 'No video URL in response',
      });
    });
  });

  describe('Polling Behavior', () => {
    it('should poll until prediction is done', async () => {
      let pollCount = 0;
      const model = createMockModel({
        pollsUntilDone: 3,
        onRequest: url => {
          if (url.includes('/predictions/test-prediction-id')) {
            pollCount++;
          }
        },
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(pollCount).toBe(3);
      expect(result.videos).toHaveLength(1);
    });

    it('should timeout after pollTimeoutMs', async () => {
      const model = new ReplicateVideoModel('minimax/video-01', {
        provider: 'replicate.video',
        baseURL: 'https://api.replicate.com/v1',
        headers: () => ({
          Authorization: 'Bearer test-token',
        }),
        fetch: async url => {
          const urlString = url.toString();

          if (urlString.includes('/predictions')) {
            return new Response(
              JSON.stringify({
                id: 'timeout-test',
                status: 'processing',
                output: null,
                error: null,
                urls: {
                  get: 'https://api.replicate.com/v1/predictions/timeout-test',
                },
                metrics: null,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          return new Response('Not found', { status: 404 });
        },
      });

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {
            replicate: {
              pollIntervalMs: 10,
              pollTimeoutMs: 50,
            },
          },
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('timed out'),
      });
    });

    it('should respect abort signal', async () => {
      const abortController = new AbortController();

      const model = new ReplicateVideoModel('minimax/video-01', {
        provider: 'replicate.video',
        baseURL: 'https://api.replicate.com/v1',
        headers: () => ({
          Authorization: 'Bearer test-token',
        }),
        fetch: async url => {
          const urlString = url.toString();

          if (urlString.includes('/predictions')) {
            if (urlString.includes('abort-test')) {
              abortController.abort();
            }

            return new Response(
              JSON.stringify({
                id: 'abort-test',
                status: 'processing',
                output: null,
                error: null,
                urls: {
                  get: 'https://api.replicate.com/v1/predictions/abort-test',
                },
                metrics: null,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          return new Response('Not found', { status: 404 });
        },
      });

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {
            replicate: {
              pollIntervalMs: 10,
            },
          },
          abortSignal: abortController.signal,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('aborted'),
      });
    });

    it('should handle immediate success (pollsUntilDone=0)', async () => {
      const model = createMockModel({
        pollsUntilDone: 0,
        output: 'https://replicate.delivery/immediate-video.mp4',
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos[0]).toMatchObject({
        type: 'url',
        url: 'https://replicate.delivery/immediate-video.mp4',
      });
    });
  });

  describe('Media Type', () => {
    it('should always return video/mp4 as media type', async () => {
      const model = createMockModel({
        output: 'https://replicate.delivery/video.mp4',
        pollsUntilDone: 0,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos[0].mediaType).toBe('video/mp4');
    });
  });
});
