import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { KlingAIVideoModel } from './klingai-video-model';

const prompt = 'A character performs a graceful dance';

const createTaskResponse = {
  code: 0,
  message: 'success',
  request_id: 'req-001',
  data: {
    task_id: 'task-abc-123',
    task_status: 'submitted',
    task_info: { external_task_id: null },
    created_at: 1722769557708,
    updated_at: 1722769557708,
  },
};

const successfulTaskResponse = {
  code: 0,
  message: 'success',
  request_id: 'req-002',
  data: {
    task_id: 'task-abc-123',
    task_status: 'succeed',
    task_status_msg: '',
    task_info: { external_task_id: null },
    watermark_info: { enabled: false },
    final_unit_deduction: '1',
    created_at: 1722769557708,
    updated_at: 1722769560000,
    task_result: {
      videos: [
        {
          id: 'video-001',
          url: 'https://p1.a.kwimgs.com/output/video-001.mp4',
          watermark_url:
            'https://p1.a.kwimgs.com/output/video-001-watermark.mp4',
          duration: '5.0',
        },
      ],
    },
  },
};

const klingaiProviderOptions = {
  klingai: {
    videoUrl: 'https://example.com/reference-motion.mp4',
    characterOrientation: 'image' as const,
    mode: 'std' as const,
    pollIntervalMs: 10, // Fast polling for tests
    pollTimeoutMs: 5000,
  },
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
  providerOptions: klingaiProviderOptions,
} as const;

const t2vProviderOptions = {
  klingai: {
    mode: 'std' as const,
    pollIntervalMs: 10,
    pollTimeoutMs: 5000,
  },
};

const t2vDefaultOptions = {
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
  providerOptions: t2vProviderOptions,
} as const;

const i2vProviderOptions = {
  klingai: {
    mode: 'std' as const,
    pollIntervalMs: 10,
    pollTimeoutMs: 5000,
  },
};

const i2vDefaultOptions = {
  prompt,
  n: 1,
  image: {
    type: 'url' as const,
    url: 'https://example.com/start-frame.png',
  },
  frameImages: undefined,
  inputReferences: undefined,
  aspectRatio: undefined,
  resolution: undefined,
  duration: undefined,
  fps: undefined,
  seed: undefined,
  generateAudio: undefined,
  providerOptions: i2vProviderOptions,
} as const;

const TEST_BASE_URL = 'https://api-singapore.klingai.com';

function createBasicModel({
  headers,
  currentDate,
  modelId = 'kling-v2.6-motion-control',
}: {
  headers?: Record<string, string | undefined>;
  currentDate?: () => Date;
  modelId?: string;
} = {}) {
  return new KlingAIVideoModel(modelId, {
    provider: 'klingai.video',
    baseURL: TEST_BASE_URL,
    headers: headers ?? { Authorization: 'Bearer test-jwt-token' },
    _internal: {
      currentDate,
    },
  });
}

describe('KlingAIVideoModel', () => {
  const server = createTestServer({
    // Motion control endpoints
    [`${TEST_BASE_URL}/v1/videos/motion-control`]: {
      response: {
        type: 'json-value',
        body: createTaskResponse,
      },
    },
    [`${TEST_BASE_URL}/v1/videos/motion-control/task-abc-123`]: {
      response: {
        type: 'json-value',
        body: successfulTaskResponse,
      },
    },
    // T2V endpoints
    [`${TEST_BASE_URL}/v1/videos/text2video`]: {
      response: {
        type: 'json-value',
        body: createTaskResponse,
      },
    },
    [`${TEST_BASE_URL}/v1/videos/text2video/task-abc-123`]: {
      response: {
        type: 'json-value',
        body: successfulTaskResponse,
      },
    },
    // I2V endpoints
    [`${TEST_BASE_URL}/v1/videos/image2video`]: {
      response: {
        type: 'json-value',
        body: createTaskResponse,
      },
    },
    [`${TEST_BASE_URL}/v1/videos/image2video/task-abc-123`]: {
      response: {
        type: 'json-value',
        body: successfulTaskResponse,
      },
    },
    // Multi-image (reference-to-video) endpoints
    [`${TEST_BASE_URL}/v1/videos/multi-image2video`]: {
      response: {
        type: 'json-value',
        body: createTaskResponse,
      },
    },
    [`${TEST_BASE_URL}/v1/videos/multi-image2video/task-abc-123`]: {
      response: {
        type: 'json-value',
        body: successfulTaskResponse,
      },
    },
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('klingai.video');
      expect(model.modelId).toBe('kling-v2.6-motion-control');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(1);
    });

    it('should accept custom model IDs in constructor', () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      expect(model.modelId).toBe('kling-v2.6-t2v');
    });

    it('should throw NoSuchModelError for unknown model IDs on generate', async () => {
      const model = createBasicModel({ modelId: 'unknown-model' });

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'No such videoModel: unknown-model',
      );
    });
  });

  describe('doGenerate - motion control', () => {
    it('should send correct request body with required fields', async () => {
      const model = createBasicModel();

      await model.doGenerate({ ...defaultOptions });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model_name: 'kling-v2-6',
        prompt,
        video_url: 'https://example.com/reference-motion.mp4',
        character_orientation: 'image',
        mode: 'std',
      });
    });

    it('should send prompt when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({ ...defaultOptions, prompt: 'Dance gracefully' });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ prompt: 'Dance gracefully' });
    });

    it('should send image_url from URL-based image', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/reference-image.png',
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_url: 'https://example.com/reference-image.png',
      });
    });

    it('should send image_url as base64 from file data', async () => {
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

      const body = await server.calls[0].requestBodyJson;
      // KlingAI expects raw base64, no data: prefix
      expect(body).toMatchObject({
        image_url: 'iVBORw==',
      });
    });

    it('should send keep_original_sound when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          klingai: {
            ...klingaiProviderOptions.klingai,
            keepOriginalSound: 'no',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        keep_original_sound: 'no',
      });
    });

    it('should send watermark_info when watermarkEnabled is set', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          klingai: {
            ...klingaiProviderOptions.klingai,
            watermarkEnabled: true,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        watermark_info: { enabled: true },
      });
    });

    it('should pass headers to requests', async () => {
      const model = createBasicModel({
        headers: {
          Authorization: 'Bearer custom-token',
          'X-Custom': 'value',
        },
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
    });

    it('should return video with correct URL and media type', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://p1.a.kwimgs.com/output/video-001.mp4',
        mediaType: 'video/mp4',
      });
    });

    it('should return empty warnings for supported features', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.warnings).toStrictEqual([]);
    });

    it('should warn about unsupported aspectRatio', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        aspectRatio: '16:9',
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'aspectRatio',
        }),
      );
    });

    it('should warn about unsupported resolution', async () => {
      const model = createBasicModel();

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

    it('should warn about unsupported seed', async () => {
      const model = createBasicModel();

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

    it('should warn about unsupported fps', async () => {
      const model = createBasicModel();

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

    it('should warn about unsupported duration', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        duration: 10,
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'duration',
        }),
      );
    });

    it('should warn when n > 1', async () => {
      const model = createBasicModel();

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
      const model = createBasicModel();

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

    it('should derive model_name kling-v3 for kling-v3.0-motion-control', async () => {
      const model = createBasicModel({
        modelId: 'kling-v3.0-motion-control',
      });

      await model.doGenerate({ ...defaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v3' });
    });

    it('should send element_list when provided for motion control', async () => {
      const model = createBasicModel({
        modelId: 'kling-v3.0-motion-control',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          klingai: {
            ...klingaiProviderOptions.klingai,
            elementList: [{ element_id: 829836802793406551 }],
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        element_list: [{ element_id: 829836802793406551 }],
      });
    });

    it('should send mode=pro when specified', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          klingai: {
            videoUrl: 'https://example.com/motion.mp4',
            characterOrientation: 'video',
            mode: 'pro',
            pollIntervalMs: 10,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        character_orientation: 'video',
        mode: 'pro',
      });
    });
  });

  describe('doGenerate - text-to-video', () => {
    it('should POST to /v1/videos/text2video endpoint', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({ ...t2vDefaultOptions });

      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/v1/videos/text2video`,
      );
    });

    it('should GET from /v1/videos/text2video/{id} for polling', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({ ...t2vDefaultOptions });

      expect(server.calls[1].requestUrl).toBe(
        `${TEST_BASE_URL}/v1/videos/text2video/task-abc-123`,
      );
    });

    it('should send model_name derived from model ID', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({ ...t2vDefaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v2-6' });
    });

    it('should convert dots to hyphens in model_name', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.1-master-t2v' });

      await model.doGenerate({ ...t2vDefaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v2-1-master' });
    });

    it('should handle model IDs without dots', async () => {
      const model = createBasicModel({ modelId: 'kling-v1-t2v' });

      await model.doGenerate({ ...t2vDefaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v1' });
    });

    it('should send prompt in request body', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        prompt: 'A sunset over the ocean',
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ prompt: 'A sunset over the ocean' });
    });

    it('should map SDK aspectRatio to aspect_ratio', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        aspectRatio: '16:9',
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ aspect_ratio: '16:9' });
    });

    it('should not warn about aspectRatio for T2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      const result = await model.doGenerate({
        ...t2vDefaultOptions,
        aspectRatio: '16:9',
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'aspectRatio' }),
      );
    });

    it('should map SDK duration to string', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        duration: 10,
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ duration: '10' });
    });

    it('should not warn about duration for T2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      const result = await model.doGenerate({
        ...t2vDefaultOptions,
        duration: 5,
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'duration' }),
      );
    });

    it('should send negative_prompt when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            negativePrompt: 'blurry, low quality',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ negative_prompt: 'blurry, low quality' });
    });

    it('should send sound when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            sound: 'on',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ sound: 'on' });
    });

    it('should map the top-level generateAudio option to sound', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        generateAudio: true,
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ sound: 'on' });
    });

    it('should let the top-level generateAudio override the legacy sound option', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        generateAudio: false,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            sound: 'on',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ sound: 'off' });
    });

    it('should send cfg_scale when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            cfgScale: 0.7,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ cfg_scale: 0.7 });
    });

    it('should send camera_control when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });
      const cameraControl = {
        type: 'simple' as const,
        config: { zoom: 5 },
      };

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            cameraControl,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        camera_control: { type: 'simple', config: { zoom: 5 } },
      });
    });

    it('should derive model_name kling-v3 for kling-v3.0-t2v', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-t2v' });

      await model.doGenerate({ ...t2vDefaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v3' });
    });

    it('should send multi_shot and shot_type when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            multiShot: true,
            shotType: 'customize',
            multiPrompt: [
              { index: 1, prompt: 'A sunrise over mountains', duration: '4' },
              {
                index: 2,
                prompt: 'A bird flying across the sky',
                duration: '3',
              },
            ],
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        multi_shot: true,
        shot_type: 'customize',
        multi_prompt: [
          { index: 1, prompt: 'A sunrise over mountains', duration: '4' },
          { index: 2, prompt: 'A bird flying across the sky', duration: '3' },
        ],
      });
    });

    it('should send multi_shot with intelligence shot_type', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            multiShot: true,
            shotType: 'intelligence',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        multi_shot: true,
        shot_type: 'intelligence',
      });
      expect(body).not.toHaveProperty('multi_prompt');
    });

    it('should send voice_list when provided for T2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            voiceList: [{ voice_id: 'voice-abc' }],
            sound: 'on',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        voice_list: [{ voice_id: 'voice-abc' }],
        sound: 'on',
      });
    });

    it('should send watermark_info when watermarkEnabled is set for T2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            watermarkEnabled: true,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        watermark_info: { enabled: true },
      });
    });

    it('should not send element_list for T2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-t2v' });

      await model.doGenerate({
        ...t2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...t2vProviderOptions.klingai,
            elementList: [{ element_id: 101 }],
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).not.toHaveProperty('element_list');
    });

    it('should warn when image is provided for T2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      const result = await model.doGenerate({
        ...t2vDefaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/image.png',
        },
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'image',
        }),
      );
    });

    it('should not require motion-control provider options', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      const result = await model.doGenerate({ ...t2vDefaultOptions });

      expect(result.videos).toHaveLength(1);
    });

    it('should return videos from successful T2V generation', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      const result = await model.doGenerate({ ...t2vDefaultOptions });

      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://p1.a.kwimgs.com/output/video-001.mp4',
        mediaType: 'video/mp4',
      });
    });
  });

  describe('doGenerate - image-to-video', () => {
    it('should POST to /v1/videos/image2video endpoint', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({ ...i2vDefaultOptions });

      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/v1/videos/image2video`,
      );
    });

    it('should GET from /v1/videos/image2video/{id} for polling', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({ ...i2vDefaultOptions });

      expect(server.calls[1].requestUrl).toBe(
        `${TEST_BASE_URL}/v1/videos/image2video/task-abc-123`,
      );
    });

    it('should send model_name derived from model ID', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({ ...i2vDefaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v2-6' });
    });

    it('should convert dots to hyphens in I2V model_name', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.5-turbo-i2v' });

      await model.doGenerate({ ...i2vDefaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v2-5-turbo' });
    });

    it('should send image from URL-based input', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/start-frame.png',
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: 'https://example.com/start-frame.png',
      });
    });

    it('should send image as base64 from file data', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });
      const imageData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ image: 'iVBORw==' });
    });

    it('should send image_tail when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            imageTail: 'https://example.com/end-frame.png',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_tail: 'https://example.com/end-frame.png',
      });
    });

    it('should send image_tail from frameImages last_frame (URL)', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/end-frame.png' },
            frameType: 'last_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_tail: 'https://example.com/end-frame.png',
      });
    });

    it('should send image_tail as base64 from frameImages last_frame (file)', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        frameImages: [
          {
            image: {
              type: 'file',
              data: new Uint8Array([137, 80, 78, 71]),
              mediaType: 'image/png',
            },
            frameType: 'last_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ image_tail: 'iVBORw==' });
    });

    it('should prefer frameImages last_frame over providerOptions.klingai.imageTail', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/new-end.png' },
            frameType: 'last_frame',
          },
        ],
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            imageTail: 'https://example.com/legacy-end.png',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_tail: 'https://example.com/new-end.png',
      });
    });

    it('should use frameImages first_frame as the start image (URL)', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/start-frame.png' },
            frameType: 'first_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: 'https://example.com/start-frame.png',
      });
    });

    it('should prefer frameImages first_frame over the legacy image option', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: { type: 'url', url: 'https://example.com/legacy-start.png' },
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/new-start.png' },
            frameType: 'first_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image: 'https://example.com/new-start.png',
      });
    });

    it('should send only image_tail when only last_frame is provided without a legacy image', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/end-frame.png' },
            frameType: 'last_frame',
          },
        ],
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_tail: 'https://example.com/end-frame.png',
      });
      expect(body.image).toBeUndefined();
    });

    it('should send prompt with image', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        prompt: 'The cat walks away',
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ prompt: 'The cat walks away' });
    });

    it('should map SDK duration to string for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        duration: 10,
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ duration: '10' });
    });

    it('should not warn about duration for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        duration: 5,
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'duration' }),
      );
    });

    it('should warn about aspectRatio for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        aspectRatio: '16:9',
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'aspectRatio',
        }),
      );
    });

    it('should send static_mask when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            staticMask: 'https://example.com/mask.png',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        static_mask: 'https://example.com/mask.png',
      });
    });

    it('should send dynamic_masks when provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });
      const dynamicMasks = [
        {
          mask: 'https://example.com/dynamic-mask.png',
          trajectories: [
            { x: 279, y: 219 },
            { x: 417, y: 65 },
          ],
        },
      ];

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            dynamicMasks,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ dynamic_masks: dynamicMasks });
    });

    it('should derive model_name kling-v3 for kling-v3.0-i2v', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-i2v' });

      await model.doGenerate({ ...i2vDefaultOptions });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ model_name: 'kling-v3' });
    });

    it('should send multi_shot and multi_prompt for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            multiShot: true,
            shotType: 'customize',
            multiPrompt: [
              { index: 1, prompt: 'The cat stretches lazily', duration: '3' },
              { index: 2, prompt: 'The cat pounces on a toy', duration: '2' },
            ],
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        multi_shot: true,
        shot_type: 'customize',
        multi_prompt: [
          { index: 1, prompt: 'The cat stretches lazily', duration: '3' },
          { index: 2, prompt: 'The cat pounces on a toy', duration: '2' },
        ],
      });
    });

    it('should send element_list when provided for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            elementList: [{ element_id: 101 }, { element_id: 202 }],
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        element_list: [{ element_id: 101 }, { element_id: 202 }],
      });
    });

    it('should send voice_list when provided for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v3.0-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            voiceList: [{ voice_id: 'voice-abc' }, { voice_id: 'voice-def' }],
            sound: 'on',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        voice_list: [{ voice_id: 'voice-abc' }, { voice_id: 'voice-def' }],
        sound: 'on',
      });
    });

    it('should send watermark_info when watermarkEnabled is set for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            watermarkEnabled: false,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        watermark_info: { enabled: false },
      });
    });

    it('should send negative_prompt for I2V', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            negativePrompt: 'blurry',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({ negative_prompt: 'blurry' });
    });

    it('should return videos from successful I2V generation', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({ ...i2vDefaultOptions });

      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://p1.a.kwimgs.com/output/video-001.mp4',
        mediaType: 'video/mp4',
      });
    });
  });

  describe('doGenerate - reference-to-video (multi-image)', () => {
    const referenceImages = [
      { type: 'url' as const, url: 'https://example.com/ref-1.png' },
      { type: 'url' as const, url: 'https://example.com/ref-2.png' },
    ];

    it('should POST to /v1/videos/multi-image2video when inputReferences are provided', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: referenceImages,
      });

      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/v1/videos/multi-image2video`,
      );
    });

    it('should GET from /v1/videos/multi-image2video/{id} for polling', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: referenceImages,
      });

      expect(server.calls[1].requestUrl).toBe(
        `${TEST_BASE_URL}/v1/videos/multi-image2video/task-abc-123`,
      );
    });

    it('should map inputReferences to image_list', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: referenceImages,
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        model_name: 'kling-v2-6',
        image_list: [
          { image: 'https://example.com/ref-1.png' },
          { image: 'https://example.com/ref-2.png' },
        ],
      });
    });

    it('should encode file-based reference images as base64 in image_list', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
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
        image_list: [{ image: 'iVBORw==' }],
      });
    });

    it('should map aspectRatio and duration for reference-to-video', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: referenceImages,
        aspectRatio: '16:9',
        duration: 10,
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        aspect_ratio: '16:9',
        duration: '10',
      });
    });

    it('should not warn about aspectRatio for reference-to-video', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: referenceImages,
        aspectRatio: '16:9',
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'aspectRatio' }),
      );
    });

    it('should send negative_prompt, cfg_scale and mode for reference-to-video', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: referenceImages,
        providerOptions: {
          klingai: {
            ...i2vProviderOptions.klingai,
            mode: 'pro',
            negativePrompt: 'blurry',
            cfgScale: 0.5,
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        mode: 'pro',
        negative_prompt: 'blurry',
        cfg_scale: 0.5,
      });
    });

    it('should warn when a start image is provided alongside inputReferences', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: { type: 'url', url: 'https://example.com/start-frame.png' },
        inputReferences: referenceImages,
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'image',
        }),
      );
    });

    it('should warn when inputReferences are provided for text-to-video', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-t2v' });

      const result = await model.doGenerate({
        ...t2vDefaultOptions,
        inputReferences: referenceImages,
      });

      expect(server.calls[0].requestUrl).toBe(
        `${TEST_BASE_URL}/v1/videos/text2video`,
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'inputReferences',
        }),
      );
    });

    it('should return videos from successful reference-to-video generation', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: referenceImages,
      });

      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://p1.a.kwimgs.com/output/video-001.mp4',
        mediaType: 'video/mp4',
      });
    });
  });

  describe('video input guard', () => {
    it('should warn and not send a video inputReference as an image', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: [
          {
            type: 'url',
            url: 'https://example.com/reference.mp4',
            mediaType: 'video/mp4',
          },
          { type: 'url', url: 'https://example.com/ref-image.png' },
        ],
      });

      // The video reference must produce an unsupported warning.
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'inputReferences',
        }),
      );

      // The video URL must not be sent in image_list; only the image remains.
      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_list: [{ image: 'https://example.com/ref-image.png' }],
      });
      expect(JSON.stringify(body)).not.toContain(
        'https://example.com/reference.mp4',
      );
    });

    it('should warn and not send a file-based video inputReference as an image', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: [
          {
            type: 'file',
            data: new Uint8Array([0, 0, 0, 24]),
            mediaType: 'video/mp4',
          },
          { type: 'url', url: 'https://example.com/ref-image.png' },
        ],
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'inputReferences',
        }),
      );

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_list: [{ image: 'https://example.com/ref-image.png' }],
      });
    });

    it('should warn and not send a video start image (frame image)', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/start.mp4',
          mediaType: 'video/mp4',
        },
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'frameImages',
        }),
      );

      const body = await server.calls[0].requestBodyJson;
      expect(body.image).toBeUndefined();
    });

    it('should warn and not send a video first_frame image', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        frameImages: [
          {
            image: {
              type: 'url',
              url: 'https://example.com/start.mp4',
              mediaType: 'video/mp4',
            },
            frameType: 'first_frame',
          },
        ],
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'frameImages',
        }),
      );

      const body = await server.calls[0].requestBodyJson;
      expect(body.image).toBeUndefined();
    });

    it('should warn and not send a video last_frame image as image_tail', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        frameImages: [
          {
            image: {
              type: 'url',
              url: 'https://example.com/end.mp4',
              mediaType: 'video/mp4',
            },
            frameType: 'last_frame',
          },
        ],
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'frameImages',
        }),
      );

      const body = await server.calls[0].requestBodyJson;
      expect(body.image_tail).toBeUndefined();
    });

    it('should not warn or filter when image references have no video mediaType', async () => {
      const model = createBasicModel({ modelId: 'kling-v2.6-i2v' });

      const result = await model.doGenerate({
        ...i2vDefaultOptions,
        image: undefined,
        inputReferences: [
          {
            type: 'url',
            url: 'https://example.com/ref-image.png',
            mediaType: 'image/png',
          },
        ],
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ feature: 'inputReferences' }),
      );

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        image_list: [{ image: 'https://example.com/ref-image.png' }],
      });
    });
  });

  describe('response metadata', () => {
    it('should include timestamp, headers, and modelId in response', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createBasicModel({
        currentDate: () => testDate,
      });

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'kling-v2.6-motion-control',
        headers: expect.any(Object),
      });
    });
  });

  describe('providerMetadata', () => {
    it('should include taskId and video metadata', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata).toStrictEqual({
        klingai: {
          taskId: 'task-abc-123',
          videos: [
            {
              id: 'video-001',
              url: 'https://p1.a.kwimgs.com/output/video-001.mp4',
              watermarkUrl:
                'https://p1.a.kwimgs.com/output/video-001-watermark.mp4',
              duration: '5.0',
            },
          ],
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw when motion control provider options are missing required fields', async () => {
      const model = createBasicModel();

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {
            klingai: {
              // Missing videoUrl, characterOrientation, mode
              pollIntervalMs: 10,
            },
          },
        }),
      ).rejects.toThrow();
    });

    it('should throw when klingai provider options are missing entirely for motion control', async () => {
      const model = createBasicModel();

      await expect(
        model.doGenerate({
          ...defaultOptions,
          providerOptions: {},
        }),
      ).rejects.toThrow('providerOptions.klingai');
    });

    it('should throw when task status is failed', async () => {
      server.urls[
        `${TEST_BASE_URL}/v1/videos/motion-control/task-abc-123`
      ].response = {
        type: 'json-value',
        body: {
          code: 0,
          message: 'success',
          request_id: 'req-003',
          data: {
            task_id: 'task-abc-123',
            task_status: 'failed',
            task_status_msg: 'Content policy violation',
            task_info: {},
            created_at: 1722769557708,
            updated_at: 1722769560000,
          },
        },
      };

      const model = createBasicModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'Content policy violation',
      );

      // Reset
      server.urls[
        `${TEST_BASE_URL}/v1/videos/motion-control/task-abc-123`
      ].response = {
        type: 'json-value',
        body: successfulTaskResponse,
      };
    });

    it('should throw when no task_id is returned', async () => {
      server.urls[`${TEST_BASE_URL}/v1/videos/motion-control`].response = {
        type: 'json-value',
        body: {
          code: 0,
          message: 'success',
          request_id: 'req-004',
          data: null,
        },
      };

      const model = createBasicModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'No task_id',
      );

      // Reset
      server.urls[`${TEST_BASE_URL}/v1/videos/motion-control`].response = {
        type: 'json-value',
        body: createTaskResponse,
      };
    });

    it('should throw when no videos in response', async () => {
      server.urls[
        `${TEST_BASE_URL}/v1/videos/motion-control/task-abc-123`
      ].response = {
        type: 'json-value',
        body: {
          code: 0,
          message: 'success',
          request_id: 'req-005',
          data: {
            task_id: 'task-abc-123',
            task_status: 'succeed',
            task_status_msg: '',
            task_info: {},
            created_at: 1722769557708,
            updated_at: 1722769560000,
            task_result: {
              videos: [],
            },
          },
        },
      };

      const model = createBasicModel();

      await expect(model.doGenerate({ ...defaultOptions })).rejects.toThrow(
        'No videos in response',
      );

      // Reset
      server.urls[
        `${TEST_BASE_URL}/v1/videos/motion-control/task-abc-123`
      ].response = {
        type: 'json-value',
        body: successfulTaskResponse,
      };
    });
  });
});
