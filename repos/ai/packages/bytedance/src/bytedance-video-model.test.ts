import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { ByteDanceVideoModel } from './bytedance-video-model';

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
  modelId = 'seedance-1-0-pro-250528',
}: {
  headers?: Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
  modelId?: string;
} = {}) {
  return new ByteDanceVideoModel(modelId, {
    provider: 'bytedance.video',
    baseURL: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    headers: () => headers ?? { Authorization: 'Bearer test-key' },
    fetch,
    _internal: {
      currentDate,
    },
  });
}

describe('ByteDanceVideoModel', () => {
  const server = createTestServer({
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks':
      {
        response: {
          type: 'json-value',
          body: {
            id: 'test-task-id-123',
          },
        },
      },
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/test-task-id-123':
      {
        response: {
          type: 'json-value',
          body: {
            id: 'test-task-id-123',
            model: 'seedance-1-0-pro-250528',
            status: 'succeeded',
            content: {
              video_url: 'https://bytedance.cdn/files/video-output.mp4',
            },
            usage: {
              completion_tokens: 100,
            },
          },
        },
      },
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('bytedance.video');
      expect(model.modelId).toBe('seedance-1-0-pro-250528');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxVideosPerCall).toBe(1);
    });

    it('should support different model IDs', () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      expect(model.modelId).toBe('seedance-1-5-pro-251215');
    });

    it('should support custom model IDs', () => {
      const model = createBasicModel({
        modelId: 'custom-model-id',
      });

      expect(model.modelId).toBe('custom-model-id');
    });
  });

  describe('doGenerate', () => {
    it('should pass the correct parameters including prompt', async () => {
      const model = createBasicModel();

      await model.doGenerate({ ...defaultOptions });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      });
    });

    it('should pass seed when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        seed: 42,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
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
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        ratio: '16:9',
      });
    });

    it('should pass duration when provided', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        duration: 5,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        duration: 5,
      });
    });

    it('should map WxH resolution to API format', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        resolution: '1920x1080',
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        resolution: '1080p',
      });
    });

    it('should map 720p resolution correctly', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        resolution: '1280x720',
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        resolution: '720p',
      });
    });

    it('should map 480p resolution correctly', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        resolution: '864x480',
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        resolution: '480p',
      });
    });

    it('should pass through unmapped resolution values', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        resolution: '640x480',
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        resolution: '640x480',
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

    it('should return video with correct data', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toStrictEqual({
        type: 'url',
        url: 'https://bytedance.cdn/files/video-output.mp4',
        mediaType: 'video/mp4',
      });
    });

    it('should return warnings array', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('warnings', () => {
    it('should warn when fps is provided', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        fps: 30,
      });

      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'fps',
        details:
          'ByteDance video models do not support custom FPS. Frame rate is fixed at 24 fps.',
      });
    });

    it('should warn when n > 1', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        ...defaultOptions,
        n: 3,
      });

      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'n',
        details:
          'ByteDance video models do not support generating multiple videos per call. ' +
          'Only 1 video will be generated.',
      });
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
        modelId: 'seedance-1-0-pro-250528',
        headers: expect.any(Object),
      });
    });
  });

  describe('providerMetadata', () => {
    it('should include task ID and usage', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({ ...defaultOptions });

      expect(result.providerMetadata).toStrictEqual({
        bytedance: {
          taskId: 'test-task-id-123',
          usage: {
            completion_tokens: 100,
          },
        },
      });
    });
  });

  describe('Image-to-Video', () => {
    it('should send image_url with file data', async () => {
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
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,iVBORw==',
            },
          },
        ],
      });
    });

    it('should send image_url with URL-based image', async () => {
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
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: 'https://example.com/input-image.png',
            },
          },
        ],
      });
    });
  });

  describe('Provider Options', () => {
    it('should pass watermark option', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            watermark: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        watermark: true,
      });
    });

    it('should pass generateAudio as generate_audio', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            generateAudio: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        generate_audio: true,
      });
    });

    it('should map the top-level generateAudio option', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        generateAudio: true,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        generate_audio: true,
      });
    });

    it('should let the top-level generateAudio override the legacy provider option', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        generateAudio: false,
        providerOptions: {
          bytedance: {
            generateAudio: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        generate_audio: false,
      });
    });

    it('should pass cameraFixed as camera_fixed', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            cameraFixed: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        camera_fixed: true,
      });
    });

    it('should pass returnLastFrame as return_last_frame', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            returnLastFrame: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        return_last_frame: true,
      });
    });

    it('should pass serviceTier as service_tier', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            serviceTier: 'flex',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        service_tier: 'flex',
      });
    });

    it('should pass draft option', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            draft: true,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-5-pro-251215',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        draft: true,
      });
    });

    it('should add last frame image with role', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/first-frame.png',
        },
        providerOptions: {
          bytedance: {
            lastFrameImage: 'https://example.com/last-frame.png',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/first-frame.png' },
          role: 'first_frame',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/last-frame.png' },
          role: 'last_frame',
        },
      ]);
    });

    it('should add last frame image from frameImages last_frame with role', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/first-frame.png',
        },
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/last-frame.png' },
            frameType: 'last_frame',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/first-frame.png' },
          role: 'first_frame',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/last-frame.png' },
          role: 'last_frame',
        },
      ]);
    });

    it('should prefer frameImages last_frame over providerOptions.bytedance.lastFrameImage', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/first-frame.png',
        },
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/new-last.png' },
            frameType: 'last_frame',
          },
        ],
        providerOptions: {
          bytedance: {
            lastFrameImage: 'https://example.com/legacy-last.png',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toContainEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/new-last.png' },
        role: 'last_frame',
      });
    });

    it('should use frameImages first_frame as the starting image', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      await model.doGenerate({
        ...defaultOptions,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/first-frame.png' },
            frameType: 'first_frame',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/first-frame.png' },
        },
      ]);
    });

    it('should prefer frameImages first_frame over the legacy image option', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      await model.doGenerate({
        ...defaultOptions,
        image: {
          type: 'url',
          url: 'https://example.com/legacy-image.png',
        },
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/first-frame.png' },
            frameType: 'first_frame',
          },
          {
            image: { type: 'url', url: 'https://example.com/last-frame.png' },
            frameType: 'last_frame',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/first-frame.png' },
          role: 'first_frame',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/last-frame.png' },
          role: 'last_frame',
        },
      ]);
    });

    it('should send only last_frame when only last_frame is provided without a legacy image', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-5-pro-251215',
      });

      await model.doGenerate({
        ...defaultOptions,
        image: undefined,
        frameImages: [
          {
            image: { type: 'url', url: 'https://example.com/last-frame.png' },
            frameType: 'last_frame',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/last-frame.png' },
          role: 'last_frame',
        },
      ]);
    });

    it('should add reference images from inputReferences with role', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-0-lite-i2v-250428',
      });

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          {
            type: 'url',
            url: 'https://example.com/ref1.png',
            mediaType: 'image/png',
          },
          {
            type: 'url',
            url: 'https://example.com/ref2.png',
            mediaType: 'image/png',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/ref1.png' },
          role: 'reference_image',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/ref2.png' },
          role: 'reference_image',
        },
      ]);
    });

    it('should add a reference video from inputReferences with video media type', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          {
            type: 'url',
            url: 'https://example.com/a.mp4',
            mediaType: 'video/mp4',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'video_url',
          video_url: { url: 'https://example.com/a.mp4' },
          role: 'reference_video',
        },
      ]);
    });

    it('should add a reference image from inputReferences with image media type', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          {
            type: 'url',
            url: 'https://example.com/a.png',
            mediaType: 'image/png',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/a.png' },
          role: 'reference_image',
        },
      ]);
    });

    it('should route a mix of video and image inputReferences by media type', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          {
            type: 'url',
            url: 'https://example.com/a.mp4',
            mediaType: 'video/mp4',
          },
          {
            type: 'url',
            url: 'https://example.com/b.png',
            mediaType: 'image/png',
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'video_url',
          video_url: { url: 'https://example.com/a.mp4' },
          role: 'reference_video',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/b.png' },
          role: 'reference_image',
        },
      ]);
    });

    it('should warn when a URL inputReference has no mediaType and treat it as an image reference', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      const result = await model.doGenerate({
        ...defaultOptions,
        inputReferences: [{ type: 'url', url: 'https://example.com/a.mp4' }],
      });

      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'inputReferences',
        details:
          'ByteDance requires an explicit mediaType to route URL references as ' +
          'video or image. Pass { data: url, mediaType: "video/mp4" } for video ' +
          'references. The reference was treated as an image.',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/a.mp4' },
          role: 'reference_image',
        },
      ]);
    });

    it('should prefer inputReferences over providerOptions.bytedance.referenceImages', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-0-lite-i2v-250428',
      });

      await model.doGenerate({
        ...defaultOptions,
        inputReferences: [
          { type: 'url', url: 'https://example.com/new-ref.png' },
        ],
        providerOptions: {
          bytedance: {
            referenceImages: ['https://example.com/legacy-ref.png'],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toContainEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/new-ref.png' },
        role: 'reference_image',
      });
      expect(requestBody.content).not.toContainEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/legacy-ref.png' },
        role: 'reference_image',
      });
    });

    it('should add reference images with role', async () => {
      const model = createBasicModel({
        modelId: 'seedance-1-0-lite-i2v-250428',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            referenceImages: [
              'https://example.com/ref1.png',
              'https://example.com/ref2.png',
              'https://example.com/ref3.png',
            ],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/ref1.png' },
          role: 'reference_image',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/ref2.png' },
          role: 'reference_image',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/ref3.png' },
          role: 'reference_image',
        },
      ]);
    });

    it('should add reference videos with role', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            referenceVideos: [
              'https://example.com/ref1.mp4',
              'https://example.com/ref2.mp4',
            ],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'video_url',
          video_url: { url: 'https://example.com/ref1.mp4' },
          role: 'reference_video',
        },
        {
          type: 'video_url',
          video_url: { url: 'https://example.com/ref2.mp4' },
          role: 'reference_video',
        },
      ]);
    });

    it('should add reference audio with role', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            referenceAudio: ['https://example.com/audio.mp3'],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'audio_url',
          audio_url: { url: 'https://example.com/audio.mp3' },
          role: 'reference_audio',
        },
      ]);
    });

    it('should add multiple reference audios', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            referenceAudio: [
              'https://example.com/audio1.mp3',
              'https://example.com/audio2.mp3',
              'https://example.com/audio3.mp3',
            ],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'audio_url',
          audio_url: { url: 'https://example.com/audio1.mp3' },
          role: 'reference_audio',
        },
        {
          type: 'audio_url',
          audio_url: { url: 'https://example.com/audio2.mp3' },
          role: 'reference_audio',
        },
        {
          type: 'audio_url',
          audio_url: { url: 'https://example.com/audio3.mp3' },
          role: 'reference_audio',
        },
      ]);
    });

    it('should support data URI for reference audio', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            referenceAudio: ['data:audio/mp3;base64,SGVsbG8='],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'audio_url',
          audio_url: { url: 'data:audio/mp3;base64,SGVsbG8=' },
          role: 'reference_audio',
        },
      ]);
    });

    it('should support reference videos and audio together', async () => {
      const model = createBasicModel({
        modelId: 'dreamina-seedance-2-0-260128',
      });

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            referenceVideos: ['https://example.com/ref.mp4'],
            referenceAudio: ['https://example.com/audio.mp3'],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.content).toStrictEqual([
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'video_url',
          video_url: { url: 'https://example.com/ref.mp4' },
          role: 'reference_video',
        },
        {
          type: 'audio_url',
          audio_url: { url: 'https://example.com/audio.mp3' },
          role: 'reference_audio',
        },
      ]);
    });

    it('should pass through additional options', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        ...defaultOptions,
        providerOptions: {
          bytedance: {
            custom_param: 'custom_value',
            another_param: 123,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'seedance-1-0-pro-250528',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        custom_param: 'custom_value',
        another_param: 123,
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no task ID is returned', async () => {
      server.urls[
        'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks'
      ].response = {
        type: 'json-value',
        body: {},
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate({ ...defaultOptions }),
      ).rejects.toMatchObject({
        message: 'No task ID returned from API',
      });
    });

    it('should throw error when task fails', async () => {
      const model = new ByteDanceVideoModel('seedance-1-0-pro-250528', {
        provider: 'bytedance.video',
        baseURL: 'https://ark.ap-southeast.bytepluses.com/api/v3',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          if (
            urlString.endsWith('/contents/generations/tasks') &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                id: 'failed-task-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes('/tasks/failed-task-id')) {
            return new Response(
              JSON.stringify({
                id: 'failed-task-id',
                status: 'failed',
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
            bytedance: {
              pollIntervalMs: 10,
            },
          },
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Video generation failed'),
      });
    });

    it('should throw error when no video URL in response', async () => {
      const model = new ByteDanceVideoModel('seedance-1-0-pro-250528', {
        provider: 'bytedance.video',
        baseURL: 'https://ark.ap-southeast.bytepluses.com/api/v3',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          if (
            urlString.endsWith('/contents/generations/tasks') &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                id: 'no-video-task-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes('/tasks/no-video-task-id')) {
            return new Response(
              JSON.stringify({
                id: 'no-video-task-id',
                status: 'succeeded',
                content: {},
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
            bytedance: {
              pollIntervalMs: 10,
            },
          },
        }),
      ).rejects.toMatchObject({
        message: 'No video URL in response',
      });
    });

    it('should handle API errors from task creation', async () => {
      server.urls[
        'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks'
      ].response = {
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

      const model = new ByteDanceVideoModel('seedance-1-0-pro-250528', {
        provider: 'bytedance.video',
        baseURL: 'https://ark.ap-southeast.bytepluses.com/api/v3',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          // Task creation endpoint
          if (
            urlString.endsWith('/contents/generations/tasks') &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                id: 'poll-test-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          // Status endpoint
          if (urlString.includes('/tasks/poll-test-id')) {
            pollCount++;

            if (pollCount < 3) {
              return new Response(
                JSON.stringify({
                  id: 'poll-test-id',
                  status: 'processing',
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              );
            }

            // Final successful response
            return new Response(
              JSON.stringify({
                id: 'poll-test-id',
                status: 'succeeded',
                content: {
                  video_url: 'https://bytedance.cdn/files/final-video.mp4',
                },
                usage: {
                  completion_tokens: 100,
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
          bytedance: {
            pollIntervalMs: 10, // Fast polling for test
          },
        },
      });

      expect(pollCount).toBe(3);
      expect(result.videos[0]).toMatchObject({
        type: 'url',
        url: 'https://bytedance.cdn/files/final-video.mp4',
      });
    });

    it('should timeout after pollTimeoutMs', async () => {
      const model = new ByteDanceVideoModel('seedance-1-0-pro-250528', {
        provider: 'bytedance.video',
        baseURL: 'https://ark.ap-southeast.bytepluses.com/api/v3',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          if (
            urlString.endsWith('/contents/generations/tasks') &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                id: 'timeout-test-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes('/tasks/timeout-test-id')) {
            return new Response(
              JSON.stringify({
                id: 'timeout-test-id',
                status: 'processing',
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
            bytedance: {
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

      const model = new ByteDanceVideoModel('seedance-1-0-pro-250528', {
        provider: 'bytedance.video',
        baseURL: 'https://ark.ap-southeast.bytepluses.com/api/v3',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        fetch: async (url, init) => {
          const urlString = url.toString();

          if (
            urlString.endsWith('/contents/generations/tasks') &&
            init?.method === 'POST'
          ) {
            return new Response(
              JSON.stringify({
                id: 'abort-test-id',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          if (urlString.includes('/tasks/abort-test-id')) {
            // Abort after first poll
            abortController.abort();
            return new Response(
              JSON.stringify({
                id: 'abort-test-id',
                status: 'processing',
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
            bytedance: {
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
});
