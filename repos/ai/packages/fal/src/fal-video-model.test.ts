import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { FalVideoModel } from './fal-video-model';

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
  providerOptions: {},
} as const;

function createBasicModel({
  headers,
  fetch,
  currentDate,
  modelId = 'luma-dream-machine',
}: {
  headers?: Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
  modelId?: string;
} = {}) {
  return new FalVideoModel(modelId, {
    provider: 'fal.video',
    url: ({ path }) => path,
    headers: () => headers ?? { 'api-key': 'test-key' },
    fetch,
    _internal: {
      currentDate,
    },
  });
}

describe('FalVideoModel', () => {
  const server = createTestServer({
    'https://queue.fal.run/fal-ai/luma-dream-machine': {
      response: {
        type: 'json-value',
        body: {
          request_id: 'test-request-id-123',
          response_url:
            'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123',
        },
      },
    },
    'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123':
      {
        response: {
          type: 'json-value',
          body: {
            video: {
              url: 'https://fal.media/files/video-output.mp4',
              width: 1920,
              height: 1080,
              duration: 5.0,
              fps: 24,
              content_type: 'video/mp4',
            },
            seed: 12345,
            timings: {
              inference: 45.5,
            },
          },
        },
      },
    'https://queue.fal.run/fal-ai/luma-ray-2': {
      response: {
        type: 'json-value',
        body: {
          request_id: 'ray2-request-id',
          response_url:
            'https://queue.fal.run/fal-ai/luma-ray-2/requests/ray2-request-id',
        },
      },
    },
    'https://evil.fal.example/requests/forged': {
      response: {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
        },
      },
    },
    'https://queue.fal.run/fal-ai/luma-ray-2/requests/ray2-request-id': {
      response: {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/ray2-video.mp4',
            width: 1280,
            height: 720,
            duration: 3.0,
            fps: 30,
            content_type: 'video/mp4',
          },
          seed: 67890,
        },
      },
    },
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('fal.video');
      expect(model.modelId).toBe('luma-dream-machine');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(1);
    });

    it('should support different model IDs', () => {
      const model = createBasicModel({ modelId: 'luma-ray-2' });

      expect(model.modelId).toBe('luma-ray-2');
    });
  });

  describe('doGenerate', () => {
    it('should pass the correct parameters including prompt', async () => {
      const model = createBasicModel();

      await model.doGenerate({ ...defaultOptions });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
      });
    });

    it('should pass seed when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        seed: 42,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        seed: 42,
      });
    });

    it('should pass aspect ratio when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        aspect_ratio: '16:9',
      });
    });

    it('should convert duration to string format', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        duration: 5,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        duration: '5s',
      });
    });

    it('should pass headers', async () => {
      const modelWithHeaders = createBasicModel({
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await modelWithHeaders.doGenerate({
        ...defaultOptions,
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

    it('does not send the API key when the status URL is on a foreign origin', async () => {
      const forgedUrl = 'https://evil.fal.example/requests/forged';
      server.urls['https://queue.fal.run/fal-ai/luma-dream-machine'].response =
        {
          type: 'json-value',
          body: {
            request_id: 'test-request-id-123',
            response_url: forgedUrl,
          },
        };

      const model = createBasicModel();
      await model.doGenerate({ ...defaultOptions });

      const pollCall = server.calls.find(call => call.requestUrl === forgedUrl);
      expect(pollCall).toBeDefined();
      expect(pollCall!.requestHeaders['api-key']).toBeUndefined();
    });

    it('should return video with correct data', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://fal.media/files/video-output.mp4',
        mediaType: 'video/mp4',
      });
    });

    it('should return warnings array', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('response metadata', () => {
    it('should include timestamp, headers and modelId in response', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createBasicModel({
        currentDate: () => testDate,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'luma-dream-machine',
        headers: expect.any(Object),
      });
    });
  });

  describe('providerMetadata', () => {
    it('should include video metadata', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata).toStrictEqual({
        fal: {
          videos: [
            {
              url: 'https://fal.media/files/video-output.mp4',
              width: 1920,
              height: 1080,
              duration: 5.0,
              fps: 24,
              contentType: 'video/mp4',
            },
          ],
          seed: 12345,
          timings: {
            inference: 45.5,
          },
        },
      });
    });

    it('should include seed when present', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      const falMetadata = result.providerMetadata?.fal as Record<
        string,
        unknown
      >;
      expect(falMetadata?.seed).toBe(12345);
    });

    it('should include timings when present', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      const falMetadata = result.providerMetadata?.fal as Record<
        string,
        unknown
      >;
      expect(falMetadata?.timings).toStrictEqual({
        inference: 45.5,
      });
    });

    it('should include has_nsfw_concepts when present', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
          has_nsfw_concepts: [false],
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      const falMetadata = result.providerMetadata?.fal as Record<
        string,
        unknown
      >;
      expect(falMetadata?.has_nsfw_concepts).toStrictEqual([false]);
    });

    it('should include prompt when present in response', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
          prompt: 'Enhanced prompt from the model',
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      const falMetadata = result.providerMetadata?.fal as Record<
        string,
        unknown
      >;
      expect(falMetadata?.prompt).toBe('Enhanced prompt from the model');
    });
  });

  describe('Image-to-Video', () => {
    it('should send image_url with file data', async () => {
      // Reset server response
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            width: 1920,
            height: 1080,
            duration: 5.0,
            fps: 24,
            content_type: 'video/mp4',
          },
          seed: 12345,
        },
      };

      const model = createBasicModel();
      const imageData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchObject({
        prompt,
        image_url: 'data:image/png;base64,iVBORw==',
      });
    });

    it('should send image_url with URL-based image', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
        },
      };

      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/input-image.png',
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).toMatchObject({
        prompt,
        image_url: 'https://example.com/input-image.png',
      });
    });
  });

  describe('Provider Options', () => {
    it('should pass loop option', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
        },
      };

      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          fal: {
            loop: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        loop: true,
      });
    });

    it('should pass motionStrength as motion_strength', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
        },
      };

      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          fal: {
            motionStrength: 0.8,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        motion_strength: 0.8,
      });
    });

    it('should pass resolution option', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-ray-2/requests/ray2-request-id'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/ray2-video.mp4',
            content_type: 'video/mp4',
          },
        },
      };

      const model = createBasicModel({ modelId: 'luma-ray-2' });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          fal: {
            resolution: '1080p',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        resolution: '1080p',
      });
    });

    it('should pass negativePrompt as negative_prompt', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
        },
      };

      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          fal: {
            negativePrompt: 'blurry, low quality',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        negative_prompt: 'blurry, low quality',
      });
    });

    it('should pass promptOptimizer as prompt_optimizer', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
        },
      };

      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          fal: {
            promptOptimizer: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        prompt_optimizer: true,
      });
    });

    it('should pass through additional options', async () => {
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
            content_type: 'video/mp4',
          },
        },
      };

      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          fal: {
            custom_param: 'custom_value',
            another_param: 123,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        custom_param: 'custom_value',
        another_param: 123,
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no request ID is returned', async () => {
      server.urls['https://queue.fal.run/fal-ai/luma-dream-machine'].response =
        {
          type: 'json-value',
          body: {},
        };

      const model = createBasicModel();

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: 'No response URL returned from queue endpoint',
      });
    });

    it('should throw error when no video URL in response', async () => {
      server.urls['https://queue.fal.run/fal-ai/luma-dream-machine'].response =
        {
          type: 'json-value',
          body: {
            request_id: 'test-request-id-123',
            response_url:
              'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123',
          },
        };
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {},
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: 'No video URL in response',
      });
    });

    it('should handle API errors from queue endpoint', async () => {
      server.urls['https://queue.fal.run/fal-ai/luma-dream-machine'].response =
        {
          type: 'error',
          status: 400,
          body: JSON.stringify({
            error: {
              message: 'Invalid prompt',
            },
          }),
        };

      const model = createBasicModel();

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('Polling Behavior', () => {
    it('should poll until video is ready', async () => {
      let pollCount = 0;

      // Create a custom model that tracks poll count
      const model = new FalVideoModel('luma-dream-machine', {
        provider: 'fal.video',
        url: ({ path }) => path,
        headers: () => ({ 'api-key': 'test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          // Queue submission endpoint
          if (
            urlString === 'https://queue.fal.run/fal-ai/luma-dream-machine' &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                request_id: 'poll-test-id',
                response_url:
                  'https://queue.fal.run/fal-ai/luma-dream-machine/requests/poll-test-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          // Status endpoint
          if (urlString.includes('/requests/poll-test-id')) {
            pollCount++;

            if (pollCount < 3) {
              // Simulate "still in progress" - return 500 with detail
              return new Response(
                JSON.stringify({ detail: 'Request is still in progress' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              );
            }

            // Final successful response
            return new Response(
              JSON.stringify({
                video: {
                  url: 'https://fal.media/files/final-video.mp4',
                  content_type: 'video/mp4',
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

      const result = await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          fal: {
            pollIntervalMs: 10, // Fast polling for test
          },
        },
      });

      expect(pollCount).toBe(3);
      expect(result.videos[0]).toMatchObject({
        type: 'url',
        url: 'https://fal.media/files/final-video.mp4',
      });
    });

    it('should timeout after pollTimeoutMs', async () => {
      const model = new FalVideoModel('luma-dream-machine', {
        provider: 'fal.video',
        url: ({ path }) => path,
        headers: () => ({ 'api-key': 'test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          if (
            urlString === 'https://queue.fal.run/fal-ai/luma-dream-machine' &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                request_id: 'timeout-test-id',
                response_url:
                  'https://queue.fal.run/fal-ai/luma-dream-machine/requests/timeout-test-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes('/requests/timeout-test-id')) {
            return new Response(
              JSON.stringify({ detail: 'Request is still in progress' }),
              {
                status: 500,
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
            fal: {
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

      const model = new FalVideoModel('luma-dream-machine', {
        provider: 'fal.video',
        url: ({ path }) => path,
        headers: () => ({ 'api-key': 'test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          if (
            urlString === 'https://queue.fal.run/fal-ai/luma-dream-machine' &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                request_id: 'abort-test-id',
                response_url:
                  'https://queue.fal.run/fal-ai/luma-dream-machine/requests/abort-test-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes('/requests/abort-test-id')) {
            // Abort after first poll
            abortController.abort();
            return new Response(
              JSON.stringify({ detail: 'Request is still in progress' }),
              {
                status: 500,
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
            fal: {
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
    it('should default to video/mp4 when content_type is not provided', async () => {
      server.urls['https://queue.fal.run/fal-ai/luma-dream-machine'].response =
        {
          type: 'json-value',
          body: {
            request_id: 'test-request-id-123',
            response_url:
              'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123',
          },
        };
      server.urls[
        'https://queue.fal.run/fal-ai/luma-dream-machine/requests/test-request-id-123'
      ].response = {
        type: 'json-value',
        body: {
          video: {
            url: 'https://fal.media/files/video-output.mp4',
          },
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos[0].mediaType).toBe('video/mp4');
    });
  });
});
