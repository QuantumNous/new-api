import { describe, expect, it, vi } from 'vitest';
import { GoogleVertexVideoModel } from './google-vertex-video-model';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const prompt = 'A futuristic city with flying cars';

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
    googleVertex: {
      pollIntervalMs: 10, // Use short polling interval for tests
    },
  },
} as const;

function createMockModel({
  modelId = 'veo-2.0-generate-001',
  currentDate,
  operationName = 'operations/test-operation-id',
  operationDone = true,
  operationError,
  videos = [
    {
      video: {
        bytesBase64Encoded: 'base64-video-data',
        mimeType: 'video/mp4',
      },
    },
  ],
  pollsUntilDone = 1,
  onRequest,
}: {
  modelId?: string;
  currentDate?: () => Date;
  operationName?: string;
  operationDone?: boolean;
  operationError?: { code: number; message: string; status?: string };
  videos?: Array<{
    video?: {
      bytesBase64Encoded?: string;
      gcsUri?: string;
      mimeType?: string;
    };
  }>;
  pollsUntilDone?: number;
  onRequest?: (
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ) => void;
} = {}) {
  let pollCount = 0;

  return new GoogleVertexVideoModel(modelId, {
    provider: 'google-vertex',
    baseURL: 'https://api.example.com',
    headers: () => ({ 'api-key': 'test-key' }),
    fetch: async (url, init) => {
      const urlString = url.toString();
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const headers = (init?.headers as Record<string, string>) ?? {};

      onRequest?.(urlString, body, headers);

      if (urlString.includes(':predictLongRunning')) {
        return new Response(
          JSON.stringify({
            name: operationName,
            done: false,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (urlString.includes(':fetchPredictOperation')) {
        pollCount++;

        if (pollCount < pollsUntilDone) {
          return new Response(
            JSON.stringify({
              name: operationName,
              done: false,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        return new Response(
          JSON.stringify({
            name: operationName,
            done: operationDone,
            error: operationError,
            response: operationError
              ? undefined
              : {
                  videos: videos.map(v => v.video),
                },
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

describe('GoogleVertexVideoModel', () => {
  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createMockModel();

      expect(model.provider).toBe('google-vertex');
      expect(model.modelId).toBe('veo-2.0-generate-001');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(4);
    });

    it('should support different model IDs', () => {
      const model = createMockModel({ modelId: 'veo-3.0-generate-001' });

      expect(model.modelId).toBe('veo-3.0-generate-001');
    });
  });

  describe('doGenerate', () => {
    it('should pass the correct parameters including prompt', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({ ...defaultOptions });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      });
    });

    it('should pass seed when provided', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        seed: 42,
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, seed: 42 },
      });
    });

    it('should pass aspect ratio when provided', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      });
    });

    it('should convert resolution to Vertex format', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        resolution: '1920x1080',
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, resolution: '1080p' },
      });
    });

    it('should pass duration as durationSeconds', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        duration: 5,
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, durationSeconds: 5 },
      });
    });

    it('should pass n as sampleCount', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        videos: [
          { video: { bytesBase64Encoded: 'video1', mimeType: 'video/mp4' } },
          { video: { bytesBase64Encoded: 'video2', mimeType: 'video/mp4' } },
        ],
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        n: 2,
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: { sampleCount: 2 },
      });
    });

    it('should return video with correct data (base64)', async () => {
      const model = createMockModel({
        videos: [
          {
            video: {
              bytesBase64Encoded: 'base64-video-data',
              mimeType: 'video/mp4',
            },
          },
        ],
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'base64',
        data: 'base64-video-data',
        mediaType: 'video/mp4',
      });
    });

    it('should return video with GCS URI', async () => {
      const model = createMockModel({
        videos: [
          {
            video: {
              gcsUri: 'gs://bucket/video.mp4',
              mimeType: 'video/mp4',
            },
          },
        ],
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'gs://bucket/video.mp4',
        mediaType: 'video/mp4',
      });
    });

    it('should return multiple videos', async () => {
      const model = createMockModel({
        videos: [
          {
            video: {
              bytesBase64Encoded: 'video1-data',
              mimeType: 'video/mp4',
            },
          },
          {
            video: {
              bytesBase64Encoded: 'video2-data',
              mimeType: 'video/mp4',
            },
          },
        ],
      });

      const result = await model.doGenerate({
        ...defaultOptions,
        n: 2,
      });

      expect(result.videos).toHaveLength(2);
      expect(result.videos[0]).toStrictEqual({
        type: 'base64',
        data: 'video1-data',
        mediaType: 'video/mp4',
      });
      expect(result.videos[1]).toStrictEqual({
        type: 'base64',
        data: 'video2-data',
        mediaType: 'video/mp4',
      });
    });

    it('should return warnings array', async () => {
      const model = createMockModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('response metadata', () => {
    it('should include timestamp and modelId in response', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createMockModel({
        currentDate: () => testDate,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.response.timestamp).toStrictEqual(testDate);
      expect(result.response.modelId).toBe('veo-2.0-generate-001');
      expect(result.response.headers).toBeDefined();
    });
  });

  describe('providerMetadata', () => {
    it('should include video metadata', async () => {
      const model = createMockModel({
        videos: [
          {
            video: {
              bytesBase64Encoded: 'video-data',
              mimeType: 'video/mp4',
            },
          },
        ],
      });

      const result = await model.doGenerate({ ...defaultOptions });

      const expectedPayload = {
        videos: [
          {
            mimeType: 'video/mp4',
          },
        ],
      };
      expect(result.providerMetadata).toStrictEqual({
        googleVertex: expectedPayload,
        'google-vertex': expectedPayload,
        vertex: expectedPayload,
      });
    });

    it('should include GCS URI in metadata', async () => {
      const model = createMockModel({
        videos: [
          {
            video: {
              gcsUri: 'gs://bucket/video.mp4',
              mimeType: 'video/mp4',
            },
          },
        ],
      });

      const result = await model.doGenerate({ ...defaultOptions });

      const expectedPayload = {
        videos: [
          {
            gcsUri: 'gs://bucket/video.mp4',
            mimeType: 'video/mp4',
          },
        ],
      };
      expect(result.providerMetadata).toStrictEqual({
        googleVertex: expectedPayload,
        'google-vertex': expectedPayload,
        vertex: expectedPayload,
      });
    });
  });

  describe('Image-to-Video', () => {
    it('should send image as bytesBase64Encoded', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
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

      expect(capturedBody).toMatchObject({
        instances: [
          {
            prompt,
            image: {
              bytesBase64Encoded: 'base64-image-data',
              mimeType: 'image/png',
            },
          },
        ],
        parameters: { sampleCount: 1 },
      });
    });

    it('should warn when URL-based image is provided', async () => {
      const model = createMockModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/image.png',
        },
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        type: 'unsupported',
        feature: 'URL-based image input',
      });
    });
  });

  describe('frameImages', () => {
    it('should use frameImages first_frame as image', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            frameType: 'first_frame',
            image: {
              type: 'file',
              data: 'first-frame-data',
              mediaType: 'image/png',
            },
          },
        ],
      });

      expect(capturedBody).toMatchObject({
        instances: [
          {
            image: {
              bytesBase64Encoded: 'first-frame-data',
              mimeType: 'image/png',
            },
          },
        ],
      });
    });

    it('should prefer frameImages first_frame over the legacy image option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'file',
          data: 'legacy-image-data',
          mediaType: 'image/png',
        },
        frameImages: [
          {
            frameType: 'first_frame',
            image: {
              type: 'file',
              data: 'first-frame-data',
              mediaType: 'image/png',
            },
          },
        ],
      });

      expect(capturedBody).toMatchObject({
        instances: [
          {
            image: {
              bytesBase64Encoded: 'first-frame-data',
              mimeType: 'image/png',
            },
          },
        ],
      });
    });

    it('should send lastFrame from frameImages last_frame', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            frameType: 'first_frame',
            image: {
              type: 'file',
              data: 'first-frame-data',
              mediaType: 'image/png',
            },
          },
          {
            frameType: 'last_frame',
            image: {
              type: 'file',
              data: 'last-frame-data',
              mediaType: 'image/jpeg',
            },
          },
        ],
      });

      expect(capturedBody).toMatchObject({
        instances: [
          {
            lastFrame: {
              bytesBase64Encoded: 'last-frame-data',
              mimeType: 'image/jpeg',
            },
          },
        ],
      });
    });

    it('should accept GCS URIs in frameImages', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            frameType: 'first_frame',
            image: {
              type: 'url',
              url: 'gs://bucket/first-frame.png',
            },
          },
        ],
      });

      expect(capturedBody).toMatchObject({
        instances: [
          {
            image: {
              gcsUri: 'gs://bucket/first-frame.png',
              mimeType: 'image/png',
            },
          },
        ],
      });
    });
  });

  describe('inputReferences', () => {
    it('should send referenceImages from inputReferences', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          {
            type: 'file',
            data: 'reference-1',
            mediaType: 'image/png',
          },
          {
            type: 'file',
            data: 'reference-2',
            mediaType: 'image/jpeg',
          },
        ],
      });

      const body = capturedBody as {
        instances: Array<{ referenceImages: unknown }>;
      };
      expect(body.instances[0].referenceImages).toStrictEqual([
        {
          image: {
            bytesBase64Encoded: 'reference-1',
            mimeType: 'image/png',
          },
          referenceType: 'asset',
        },
        {
          image: {
            bytesBase64Encoded: 'reference-2',
            mimeType: 'image/jpeg',
          },
          referenceType: 'asset',
        },
      ]);
    });

    it('should prefer inputReferences over providerOptions.googleVertex.referenceImages', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          {
            type: 'file',
            data: 'reference-from-input',
            mediaType: 'image/png',
          },
        ],
        providerOptions: {
          googleVertex: {
            pollIntervalMs: 10,
            referenceImages: [{ bytesBase64Encoded: 'provider-reference' }],
          },
        },
      });

      const body = capturedBody as {
        instances: Array<{ referenceImages: unknown }>;
      };
      expect(body.instances[0].referenceImages).toStrictEqual([
        {
          image: {
            bytesBase64Encoded: 'reference-from-input',
            mimeType: 'image/png',
          },
          referenceType: 'asset',
        },
      ]);
    });
  });

  describe('Provider Options', () => {
    it('should pass personGeneration option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          googleVertex: {
            pollIntervalMs: 10,
            personGeneration: 'allow_adult',
          },
        },
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          personGeneration: 'allow_adult',
        },
      });
    });

    it('should pass negativePrompt option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          googleVertex: {
            pollIntervalMs: 10,
            negativePrompt: 'blurry, low quality',
          },
        },
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          negativePrompt: 'blurry, low quality',
        },
      });
    });

    it('should pass generateAudio option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          googleVertex: {
            pollIntervalMs: 10,
            generateAudio: true,
          },
        },
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          generateAudio: true,
        },
      });
    });

    it('should map the top-level generateAudio option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        generateAudio: true,
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          generateAudio: true,
        },
      });
    });

    it('should let the top-level generateAudio override the legacy provider option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        generateAudio: false,
        providerOptions: {
          googleVertex: {
            pollIntervalMs: 10,
            generateAudio: true,
          },
        },
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          generateAudio: false,
        },
      });
    });

    it('should pass gcsOutputDirectory option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        videos: [
          {
            video: {
              gcsUri: 'gs://bucket/output/video.mp4',
              mimeType: 'video/mp4',
            },
          },
        ],
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          googleVertex: {
            pollIntervalMs: 10,
            gcsOutputDirectory: 'gs://bucket/output/',
          },
        },
      });

      expect(capturedBody).toStrictEqual({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          gcsOutputDirectory: 'gs://bucket/output/',
        },
      });
    });

    it('should pass referenceImages option', async () => {
      let capturedBody: unknown;
      const model = createMockModel({
        onRequest: (url, body) => {
          if (url.includes(':predictLongRunning')) {
            capturedBody = body;
          }
        },
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          googleVertex: {
            pollIntervalMs: 10,
            referenceImages: [
              { bytesBase64Encoded: 'reference-image-data' },
              { gcsUri: 'gs://bucket/reference.png' },
            ],
          },
        },
      });

      const body = capturedBody as {
        instances: Array<{ referenceImages: unknown }>;
      };
      expect(body.instances[0].referenceImages).toStrictEqual([
        { bytesBase64Encoded: 'reference-image-data' },
        { gcsUri: 'gs://bucket/reference.png' },
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no operation name is returned', async () => {
      const model = new GoogleVertexVideoModel('veo-2.0-generate-001', {
        provider: 'google-vertex',
        baseURL: 'https://api.example.com',
        headers: () => ({ 'api-key': 'test-key' }),
        fetch: async () => {
          return new Response(
            JSON.stringify({
              done: false,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        },
      });

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: 'No operation name returned from API',
      });
    });

    it('should throw error when operation fails', async () => {
      const model = createMockModel({
        operationError: {
          code: 400,
          message: 'Invalid request',
          status: 'INVALID_ARGUMENT',
        },
      });

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Invalid request'),
      });
    });

    it('should throw error when no videos in response', async () => {
      const model = createMockModel({
        videos: [],
      });

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('No videos in response'),
      });
    });
  });

  describe('Polling Behavior', () => {
    it('should poll until operation is done', async () => {
      let pollCount = 0;
      const model = new GoogleVertexVideoModel('veo-2.0-generate-001', {
        provider: 'google-vertex',
        baseURL: 'https://api.example.com',
        headers: () => ({ 'api-key': 'test-key' }),
        fetch: async url => {
          const urlString = url.toString();

          if (urlString.includes(':predictLongRunning')) {
            return new Response(
              JSON.stringify({
                name: 'operations/poll-test',
                done: false,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes(':fetchPredictOperation')) {
            pollCount++;

            if (pollCount < 3) {
              return new Response(
                JSON.stringify({
                  name: 'operations/poll-test',
                  done: false,
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              );
            }

            return new Response(
              JSON.stringify({
                name: 'operations/poll-test',
                done: true,
                response: {
                  videos: [
                    {
                      bytesBase64Encoded: 'final-video',
                      mimeType: 'video/mp4',
                    },
                  ],
                },
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

      const result = await model.doGenerate({ ...defaultOptions });

      expect(pollCount).toBe(3);
      expect(result.videos[0]).toMatchObject({
        type: 'base64',
        data: 'final-video',
      });
    });

    it('should timeout after pollTimeoutMs', async () => {
      const model = new GoogleVertexVideoModel('veo-2.0-generate-001', {
        provider: 'google-vertex',
        baseURL: 'https://api.example.com',
        headers: () => ({ 'api-key': 'test-key' }),
        fetch: async url => {
          const urlString = url.toString();

          if (urlString.includes(':predictLongRunning')) {
            return new Response(
              JSON.stringify({
                name: 'operations/timeout-test',
                done: false,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes(':fetchPredictOperation')) {
            return new Response(
              JSON.stringify({
                name: 'operations/timeout-test',
                done: false,
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
            googleVertex: {
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

      const model = new GoogleVertexVideoModel('veo-2.0-generate-001', {
        provider: 'google-vertex',
        baseURL: 'https://api.example.com',
        headers: () => ({ 'api-key': 'test-key' }),
        fetch: async url => {
          const urlString = url.toString();

          if (urlString.includes(':predictLongRunning')) {
            return new Response(
              JSON.stringify({
                name: 'operations/abort-test',
                done: false,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes(':fetchPredictOperation')) {
            abortController.abort();
            return new Response(
              JSON.stringify({
                name: 'operations/abort-test',
                done: false,
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
            googleVertex: {
              pollIntervalMs: 10,
            },
          },
          abortSignal: abortController.signal,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('aborted'),
      });
    });
  });

  describe('Default Media Type', () => {
    it('should default to video/mp4 when mimeType is not provided', async () => {
      const model = createMockModel({
        videos: [
          {
            video: {
              bytesBase64Encoded: 'video-data',
            },
          },
        ],
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos[0].mediaType).toBe('video/mp4');
    });
  });
});
