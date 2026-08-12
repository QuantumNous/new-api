import { InvalidArgumentError } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { XaiVideoModel } from './xai-video-model';

const prompt = 'A chicken flying into the sunset';

const TEST_BASE_URL = 'https://api.example.com';

const createVideoResponse = {
  request_id: 'req-123',
};

const doneStatusResponse = {
  status: 'done',
  video: {
    url: 'https://vidgen.x.ai/output/video-001.mp4',
    duration: 5,
    respect_moderation: true,
  },
  model: 'grok-imagine-video',
  progress: 100,
};

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
    xai: {
      pollIntervalMs: 10,
      pollTimeoutMs: 5000,
    },
  },
} as const;

function createModel({
  headers,
  currentDate,
}: {
  headers?: () => Record<string, string>;
  currentDate?: () => Date;
} = {}) {
  return new XaiVideoModel('grok-imagine-video', {
    provider: 'xai.video',
    baseURL: TEST_BASE_URL,
    headers: headers ?? (() => ({ 'api-key': 'test-key' })),
    _internal: {
      currentDate,
    },
  });
}

describe('XaiVideoModel', () => {
  const server = createTestServer({
    [`${TEST_BASE_URL}/videos/generations`]: {
      response: {
        type: 'json-value',
        body: createVideoResponse,
      },
    },
    [`${TEST_BASE_URL}/videos/edits`]: {
      response: {
        type: 'json-value',
        body: createVideoResponse,
      },
    },
    [`${TEST_BASE_URL}/videos/extensions`]: {
      response: {
        type: 'json-value',
        body: createVideoResponse,
      },
    },
    [`${TEST_BASE_URL}/videos/req-123`]: {
      response: {
        type: 'json-value',
        body: doneStatusResponse,
      },
    },
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createModel();

      expect(model.provider).toBe('xai.video');
      expect(model.modelId).toBe('grok-imagine-video');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(1);
    });
  });

  describe('doGenerate', () => {
    it('should send correct request body with model and prompt', async () => {
      const model = createModel();

      await model.doGenerate({ ...defaultOptions });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/videos/generations`,
      );
      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'grok-imagine-video',
        prompt,
      });
    });

    it('should poll the correct status URL', async () => {
      const model = createModel();

      await model.doGenerate({ ...defaultOptions });

      expect(server.calls[1].requestMethod).toBe('GET');
      expect(server.calls[1].requestUrl).toBe(
        `${TEST_BASE_URL}/videos/req-123`,
      );
    });

    it('should send duration in request body', async () => {
      const model = createModel();

      await model.doGenerate({ ...defaultOptions, duration: 10 });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ duration: 10 });
    });

    it('should send aspect_ratio in request body', async () => {
      const model = createModel();

      await model.doGenerate({ ...defaultOptions, aspectRatio: '9:16' });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ aspect_ratio: '9:16' });
    });

    it('should map SDK resolution 1280x720 to 720p', async () => {
      const model = createModel();

      await model.doGenerate({ ...defaultOptions, resolution: '1280x720' });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ resolution: '720p' });
    });

    it('should map SDK resolution 854x480 to 480p', async () => {
      const model = createModel();

      await model.doGenerate({ ...defaultOptions, resolution: '854x480' });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ resolution: '480p' });
    });

    it('should prefer provider option resolution over SDK resolution', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        resolution: '1280x720',
        providerOptions: {
          xai: {
            resolution: '480p',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ resolution: '480p' });
    });

    it('should warn for unrecognized resolution format', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        resolution: '1920x1080',
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'resolution',
        }),
      );
    });

    it('should send image object from URL-based image input', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/image.png',
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'https://example.com/image.png' },
      });
    });

    it('should send image object with data URI from file data', async () => {
      const model = createModel();
      const imageData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'data:image/png;base64,iVBORw==' },
      });
    });

    it('should send image object with data URI from base64 string', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'file',
          data: 'aGVsbG8=',
          mediaType: 'image/jpeg',
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'data:image/jpeg;base64,aGVsbG8=' },
      });
    });

    it('should send video object to /videos/edits for video editing with explicit mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            mode: 'edit-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(`${TEST_BASE_URL}/videos/edits`);
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        video: { url: 'https://example.com/source-video.mp4' },
      });
    });

    it('should fallback to edit mode when videoUrl is set without mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(`${TEST_BASE_URL}/videos/edits`);
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        video: { url: 'https://example.com/source-video.mp4' },
      });
    });

    it('should warn about duration in edit mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        duration: 10,
        providerOptions: {
          xai: {
            mode: 'edit-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'duration',
        }),
      );
    });

    it('should warn about aspectRatio in edit mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
        providerOptions: {
          xai: {
            mode: 'edit-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'aspectRatio',
        }),
      );
    });

    it('should warn about resolution in edit mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        resolution: '1280x720',
        providerOptions: {
          xai: {
            mode: 'edit-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'resolution',
        }),
      );
    });

    it('should not warn about duration outside edit mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        duration: 10,
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          feature: 'duration',
        }),
      );
    });

    it('should not warn about aspectRatio outside edit mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          feature: 'aspectRatio',
        }),
      );
    });

    it('should not warn about resolution outside edit mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        resolution: '1280x720',
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          feature: 'resolution',
        }),
      );
    });

    it('should omit duration, aspect_ratio, and resolution from body in edit mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        duration: 10,
        aspectRatio: '16:9',
        resolution: '1280x720',
        providerOptions: {
          xai: {
            mode: 'edit-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).not.toHaveProperty('duration');
      expect(body).not.toHaveProperty('aspect_ratio');
      expect(body).not.toHaveProperty('resolution');
    });

    it('should pass headers to requests', async () => {
      const model = createModel({
        headers: () => ({
          Authorization: 'Bearer custom-token',
          'X-Custom': 'value',
        }),
      });

      await model.doGenerate({
        ...defaultOptions,
        headers: {
          'X-Request-Header': 'request-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        authorization: 'Bearer custom-token',
        'x-custom': 'value',
        'x-request-header': 'request-value',
      });

      // Poll request should also have headers
      expect(server.calls[1].requestHeaders).toMatchObject({
        authorization: 'Bearer custom-token',
        'x-custom': 'value',
        'x-request-header': 'request-value',
      });
    });

    it('should return video with correct URL and media type', async () => {
      const model = createModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://vidgen.x.ai/output/video-001.mp4',
        mediaType: 'video/mp4',
      });
    });

    it('should handle done response without status field', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://vidgen.x.ai/output/video-001.mp4',
            duration: 5,
            respect_moderation: true,
          },
          model: 'grok-imagine-video',
        },
      };

      const model = createModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://vidgen.x.ai/output/video-001.mp4',
        mediaType: 'video/mp4',
      });

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });

    it('should return empty warnings for supported features', async () => {
      const model = createModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.warnings).toStrictEqual([]);
    });

    it('should warn about unsupported fps', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        fps: 30,
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'fps',
        }),
      );
    });

    it('should warn about unsupported seed', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        seed: 42,
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'seed',
        }),
      );
    });

    it('should warn when n > 1', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        n: 3,
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'n',
        }),
      );
    });

    it('should not warn when n is 1', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        n: 1,
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          feature: 'n',
        }),
      );
    });
  });

  describe('response metadata', () => {
    it('should include timestamp, headers, and modelId in response', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createModel({
        currentDate: () => testDate,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'grok-imagine-video',
        headers: expect.any(Object),
      });
    });
  });

  describe('providerMetadata', () => {
    it('should include requestId, videoUrl, duration, and progress', async () => {
      const model = createModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata).toStrictEqual({
        xai: {
          requestId: 'req-123',
          videoUrl: 'https://vidgen.x.ai/output/video-001.mp4',
          duration: 5,
          progress: 100,
        },
      });
    });

    it('should include costInUsdTicks when returned in usage', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          ...doneStatusResponse,
          usage: { cost_in_usd_ticks: 4000000000 },
        },
      };

      const model = createModel();
      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata).toStrictEqual({
        xai: {
          requestId: 'req-123',
          videoUrl: 'https://vidgen.x.ai/output/video-001.mp4',
          duration: 5,
          progress: 100,
          costInUsdTicks: 4000000000,
        },
      });

      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });
  });

  describe('error handling', () => {
    it('should throw when status is expired', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          status: 'expired',
          model: 'grok-imagine-video',
        },
      };

      const model = createModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'expired',
      );

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });

    it('should throw when no request_id is returned', async () => {
      server.urls[`${TEST_BASE_URL}/videos/generations`].response = {
        type: 'json-value',
        body: {},
      };

      const model = createModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'No request_id',
      );

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/generations`].response = {
        type: 'json-value',
        body: createVideoResponse,
      };
    });

    it('should throw when video URL is missing on done status', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          status: 'done',
          video: null,
          model: 'grok-imagine-video',
        },
      };

      const model = createModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'no video URL',
      );

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });

    it('should throw when respect_moderation is false', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          status: 'done',
          video: {
            url: '',
            respect_moderation: false,
          },
          model: 'grok-imagine-video',
        },
      };

      const model = createModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'content policy violation',
      );

      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });

    it('should throw on timeout', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          status: 'pending',
          model: 'grok-imagine-video',
        },
      };

      const model = createModel();

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {
            xai: {
              pollIntervalMs: 10,
              pollTimeoutMs: 50,
            },
          },
        }),
      ).rejects.toThrow('timed out');

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });

    it('should throw when status is failed', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          status: 'failed',
          model: 'grok-imagine-video',
          progress: 0,
        },
      };

      const model = createModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'failed',
      );

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });
  });

  describe('reference images (R2V)', () => {
    it('should send reference_images array to /videos/generations with explicit mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            mode: 'reference-to-video',
            referenceImageUrls: [
              'https://example.com/ref1.jpg',
              'https://example.com/ref2.jpg',
            ],
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/videos/generations`,
      );
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        reference_images: [
          { url: 'https://example.com/ref1.jpg' },
          { url: 'https://example.com/ref2.jpg' },
        ],
      });
    });

    it('should fallback to reference-to-video mode when referenceImageUrls is set without mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            referenceImageUrls: ['https://example.com/ref1.jpg'],
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/videos/generations`,
      );
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        reference_images: [{ url: 'https://example.com/ref1.jpg' }],
      });
    });

    it('should reject empty referenceImageUrls arrays', async () => {
      const model = createModel();

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {
            xai: {
              referenceImageUrls: [],
              pollIntervalMs: 10,
              pollTimeoutMs: 5000,
            },
          },
        }),
      ).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('frameImages', () => {
    it('should map a first_frame URL image to the image field', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/first.png' },
            frameType: 'first_frame',
          },
        ],
      });

      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/videos/generations`,
      );
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'https://example.com/first.png' },
      });
    });

    it('should map a first_frame file image to a data URI image field', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            image: {
              type: 'file',
              data: new Uint8Array([137, 80, 78, 71]),
              mediaType: 'image/png',
            },
            frameType: 'first_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'data:image/png;base64,iVBORw==' },
      });
    });

    it('should prefer the first_frame image over the image-to-video image input', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        image: { type: 'url', url: 'https://example.com/image-input.png' },
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/first.png' },
            frameType: 'first_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'https://example.com/first.png' },
      });
      expect(result.warnings).toEqual([]);
    });

    it('should warn and ignore a last_frame image', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/first.png' },
            frameType: 'first_frame',
          },
          {
            image: { type: 'url', url: 'https://example.com/last.png' },
            frameType: 'last_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'https://example.com/first.png' },
      });
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'frameImages',
        }),
      );
    });
  });

  describe('inputReferences', () => {
    it('should map URL inputReferences to reference_images and select R2V', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          { type: 'url', url: 'https://example.com/ref1.jpg' },
          { type: 'url', url: 'https://example.com/ref2.jpg' },
        ],
      });

      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/videos/generations`,
      );
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        reference_images: [
          { url: 'https://example.com/ref1.jpg' },
          { url: 'https://example.com/ref2.jpg' },
        ],
      });
    });

    it('should map file inputReferences to data URI reference_images', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          {
            type: 'file',
            data: new Uint8Array([137, 80, 78, 71]),
            mediaType: 'image/png',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        reference_images: [{ url: 'data:image/png;base64,iVBORw==' }],
      });
    });

    it('should prefer inputReferences over the legacy referenceImageUrls option', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          { type: 'url', url: 'https://example.com/first-class.jpg' },
        ],
        providerOptions: {
          xai: {
            referenceImageUrls: ['https://example.com/legacy.jpg'],
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        reference_images: [{ url: 'https://example.com/first-class.jpg' }],
      });
    });

    it('should ignore and warn about inputReferences when frameImages are present', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/first.png' },
            frameType: 'first_frame',
          },
        ],
        inputReferences: [{ type: 'url', url: 'https://example.com/ref1.jpg' }],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: { url: 'https://example.com/first.png' },
      });
      expect(body).not.toHaveProperty('reference_images');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'inputReferences',
        }),
      );
    });

    it('should ignore and warn about inputReferences in edit-video mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        inputReferences: [{ type: 'url', url: 'https://example.com/ref1.jpg' }],
        providerOptions: {
          xai: {
            mode: 'edit-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(server.calls[0].requestUrl).toBe(`${TEST_BASE_URL}/videos/edits`);
      const body = await server.calls[0].requestBodyJson;
      expect(body).not.toHaveProperty('reference_images');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'inputReferences',
        }),
      );
    });
  });

  describe('video extension', () => {
    it('should send video object to /videos/extensions for extend-video mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/videos/extensions`,
      );
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        video: { url: 'https://example.com/source-video.mp4' },
      });
    });

    it('should allow duration in extension mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        duration: 6,
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ duration: 6 });
    });

    it('should warn about aspectRatio in extension mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'aspectRatio',
        }),
      );
    });

    it('should warn about resolution in extension mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        resolution: '1280x720',
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'resolution',
        }),
      );
    });

    it('should omit aspect_ratio and resolution from body in extension mode', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
        resolution: '1280x720',
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).not.toHaveProperty('aspect_ratio');
      expect(body).not.toHaveProperty('resolution');
    });

    it('should not warn about duration in extension mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        duration: 6,
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: 'https://example.com/source-video.mp4',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'duration' }),
      );
    });

    it('should warn about provider-level resolution in extension mode', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: 'https://example.com/source-video.mp4',
            resolution: '720p',
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).not.toHaveProperty('resolution');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'resolution',
        }),
      );
    });
  });

  describe('resolution mapping', () => {
    it('should map SDK resolution 640x480 to 480p', async () => {
      const model = createModel();

      await model.doGenerate({ ...defaultOptions, resolution: '640x480' });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ resolution: '480p' });
    });

    it('should warn and omit body resolution for completely unknown format', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        resolution: '3840x2160',
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).not.toHaveProperty('resolution');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ type: 'unsupported', feature: 'resolution' }),
      );
    });
  });

  describe('polling behaviour', () => {
    it('should retry polling on pending before resolving done', async () => {
      // callNumber is global across all URLs in the test.
      // Call 0 = POST /generations. Polls start at callNumber 1.
      // Return pending for polls 1 and 2, done for poll 3.
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = ({
        callNumber,
      }) => {
        if (callNumber < 3) {
          return {
            type: 'json-value',
            body: { status: 'pending', model: 'grok-imagine-video' },
          };
        }
        return { type: 'json-value', body: doneStatusResponse };
      };

      const model = createModel();
      const result = await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: { pollIntervalMs: 10, pollTimeoutMs: 5000 },
        },
      });

      // 1 POST + 3 GETs = 4 total calls; video resolves on 3rd poll
      expect(server.calls.length).toBe(4);
      const video = result.videos[0];
      expect(video.type).toBe('url');
      if (video.type === 'url') {
        expect(video.url).toBe('https://vidgen.x.ai/output/video-001.mp4');
      }

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });
  });

  describe('providerMetadata edge cases', () => {
    it('should omit duration from metadata when absent in response', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          status: 'done',
          video: {
            url: 'https://vidgen.x.ai/output/video-001.mp4',
            respect_moderation: true,
            // duration intentionally absent
          },
          model: 'grok-imagine-video',
        },
      };

      const model = createModel();
      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata?.xai).not.toHaveProperty('duration');

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });

    it('should omit progress from metadata when absent in response', async () => {
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: {
          status: 'done',
          video: {
            url: 'https://vidgen.x.ai/output/video-001.mp4',
            duration: 5,
            respect_moderation: true,
          },
          model: 'grok-imagine-video',
          // progress intentionally absent
        },
      };

      const model = createModel();
      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata?.xai).not.toHaveProperty('progress');

      // Reset
      server.urls[`${TEST_BASE_URL}/videos/req-123`].response = {
        type: 'json-value',
        body: doneStatusResponse,
      };
    });
  });

  describe('reference images (R2V) edge cases', () => {
    it('should reject more than 7 reference images', async () => {
      const model = createModel();

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {
            xai: {
              referenceImageUrls: Array.from(
                { length: 8 },
                (_, index) => `https://example.com/ref-${index + 1}.jpg`,
              ),
              pollIntervalMs: 10,
              pollTimeoutMs: 5000,
            },
          },
        }),
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should reject empty-string reference image URLs', async () => {
      const model = createModel();

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {
            xai: {
              referenceImageUrls: ['https://example.com/ref-1.jpg', ''],
              pollIntervalMs: 10,
              pollTimeoutMs: 5000,
            },
          },
        }),
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should handle a single reference image', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            referenceImageUrls: ['https://example.com/only-one.jpg'],
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        reference_images: [{ url: 'https://example.com/only-one.jpg' }],
      });
    });

    it('should forward reference image data URIs unchanged', async () => {
      const model = createModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          xai: {
            referenceImageUrls: ['data:image/png;base64,iVBORw=='],
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        reference_images: [{ url: 'data:image/png;base64,iVBORw==' }],
      });
    });

    it('should allow duration and aspectRatio with reference images', async () => {
      const model = createModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        duration: 8,
        aspectRatio: '16:9',
        providerOptions: {
          xai: {
            referenceImageUrls: ['https://example.com/ref.jpg'],
            pollIntervalMs: 10,
            pollTimeoutMs: 5000,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ duration: 8, aspect_ratio: '16:9' });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'duration' }),
      );
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'aspectRatio' }),
      );
    });
  });
});
