import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createAmazonBedrock } from './amazon-bedrock-provider';
import { AmazonBedrockImageModel } from './amazon-bedrock-image-model';
import { injectFetchHeaders } from './inject-fetch-headers';
import { describe, it, expect } from 'vitest';

const prompt = 'A cute baby sea otter';

const provider = createAmazonBedrock();
const fakeFetchWithAuth = injectFetchHeaders({ 'x-amz-auth': 'test-auth' });

const invokeUrl = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent(
  'amazon.nova-canvas-v1:0',
)}/invoke`;

describe('doGenerate', () => {
  const mockConfigHeaders = {
    'config-header': 'config-value',
    'shared-header': 'config-shared',
  };

  const server = createTestServer({
    [invokeUrl]: {
      response: {
        type: 'binary',
        headers: {
          'content-type': 'application/json',
        },
        body: Buffer.from(
          JSON.stringify({
            images: ['base64-image-1', 'base64-image-2'],
          }),
        ),
      },
    },
  });

  const model = new AmazonBedrockImageModel('amazon.nova-canvas-v1:0', {
    baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
    headers: mockConfigHeaders,
    fetch: fakeFetchWithAuth,
  });

  it('should pass the model and the settings', async () => {
    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: 1234,
      providerOptions: {
        bedrock: {
          negativeText: 'bad',
          quality: 'premium',
          cfgScale: 1.2,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "cfgScale": 1.2,
          "height": 1024,
          "numberOfImages": 1,
          "quality": "premium",
          "seed": 1234,
          "width": 1024,
        },
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {
          "negativeText": "bad",
          "text": "A cute baby sea otter",
        },
      }
    `);
  });

  it('should properly combine headers from all sources', async () => {
    const optionsHeaders = {
      'options-header': 'options-value',
      'shared-header': 'options-shared',
    };

    const modelWithHeaders = new AmazonBedrockImageModel(
      'amazon.nova-canvas-v1:0',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: {
          'model-header': 'model-value',
          'shared-header': 'model-shared',
        },
        fetch: injectFetchHeaders({
          'signed-header': 'signed-value',
          authorization: 'AWS4-HMAC-SHA256...',
        }),
      },
    );

    await modelWithHeaders.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
      headers: optionsHeaders,
    });

    const requestHeaders = server.calls[0].requestHeaders;
    expect(requestHeaders['options-header']).toBe('options-value');
    expect(requestHeaders['model-header']).toBe('model-value');
    expect(requestHeaders['signed-header']).toBe('signed-value');
    expect(requestHeaders['authorization']).toBe('AWS4-HMAC-SHA256...');
    expect(requestHeaders['shared-header']).toBe('options-shared');
  });

  it('should respect maxImagesPerCall setting', async () => {
    const defaultModel = provider.image('amazon.nova-canvas-v1:0');
    expect(defaultModel.maxImagesPerCall).toBe(5); // 'amazon.nova-canvas-v1:0','s default from settings

    const unknownModel = provider.image('unknown-model' as any);
    expect(unknownModel.maxImagesPerCall).toBe(1); // fallback for unknown models
  });

  it('should return warnings for unsupported settings', async () => {
    const result = await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: '1:1',
      seed: undefined,
      providerOptions: {},
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "This model does not support aspect ratio. Use \`size\` instead.",
          "feature": "aspectRatio",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should extract the generated images', async () => {
    const result = await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.images).toMatchInlineSnapshot(`
      [
        "base64-image-1",
        "base64-image-2",
      ]
    `);
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    const testDate = new Date('2024-03-15T12:00:00Z');

    const customModel = new AmazonBedrockImageModel('amazon.nova-canvas-v1:0', {
      baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.response).toMatchInlineSnapshot(`
      {
        "headers": {
          "content-length": "46",
          "content-type": "application/json",
        },
        "modelId": "amazon.nova-canvas-v1:0",
        "timestamp": 2024-03-15T12:00:00.000Z,
      }
    `);
  });

  it('should use real date when no custom date provider is specified', async () => {
    const beforeDate = new Date();

    const result = await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: 1234,
      providerOptions: {},
    });

    const afterDate = new Date();

    expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(
      beforeDate.getTime(),
    );
    expect(result.response.timestamp.getTime()).toBeLessThanOrEqual(
      afterDate.getTime(),
    );
    expect(result.response.modelId).toBe('amazon.nova-canvas-v1:0');
  });

  it('should pass the style parameter when provided', async () => {
    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: 1234,
      providerOptions: {
        bedrock: {
          negativeText: 'bad',
          quality: 'premium',
          cfgScale: 1.2,
          style: 'PHOTOREALISM',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "cfgScale": 1.2,
          "height": 1024,
          "numberOfImages": 1,
          "quality": "premium",
          "seed": 1234,
          "width": 1024,
        },
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {
          "negativeText": "bad",
          "style": "PHOTOREALISM",
          "text": "A cute baby sea otter",
        },
      }
    `);
  });

  it('should not include style parameter when not provided', async () => {
    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: 1234,
      providerOptions: {
        bedrock: {
          quality: 'standard',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.textToImageParams).not.toHaveProperty('style');
  });

  it('should throw error when request is moderated', async () => {
    server.urls[invokeUrl].response = {
      type: 'binary',
      headers: {
        'content-type': 'application/json',
      },
      body: Buffer.from(
        JSON.stringify({
          id: 'fe7256d1-50d9-4663-8592-85eaf002e80c',
          status: 'Request Moderated',
          result: null,
          progress: null,
          details: { 'Moderation Reasons': ['Derivative Works Filter'] },
          preview: null,
        }),
      ),
    };

    await expect(
      model.doGenerate({
        prompt: 'Generate something that triggers moderation',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      }),
    ).rejects.toThrow(
      'Amazon Bedrock request was moderated: Derivative Works Filter',
    );
  });

  it('should throw error when no images are returned', async () => {
    server.urls[invokeUrl].response = {
      type: 'binary',
      headers: {
        'content-type': 'application/json',
      },
      body: Buffer.from(
        JSON.stringify({
          images: [],
        }),
      ),
    };

    await expect(
      model.doGenerate({
        prompt: 'Generate an image',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      }),
    ).rejects.toThrow('Amazon Bedrock returned no images');
  });
});

describe('Image Editing', () => {
  const server = createTestServer({
    [invokeUrl]: {
      response: {
        type: 'binary',
        headers: {
          'content-type': 'application/json',
        },
        body: Buffer.from(
          JSON.stringify({
            images: ['edited-image-base64'],
          }),
        ),
      },
    },
  });

  const model = new AmazonBedrockImageModel('amazon.nova-canvas-v1:0', {
    baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
    headers: {},
    fetch: fakeFetchWithAuth,
  });

  it('should send inpainting request with files and maskPrompt', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

    await model.doGenerate({
      prompt: 'a cute corgi dog',
      files: [
        {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: 42,
      providerOptions: {
        bedrock: {
          maskPrompt: 'cat',
          quality: 'standard',
          cfgScale: 7.0,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "cfgScale": 7,
          "numberOfImages": 1,
          "quality": "standard",
          "seed": 42,
        },
        "inPaintingParams": {
          "image": "iVBORw==",
          "maskPrompt": "cat",
          "text": "a cute corgi dog",
        },
        "taskType": "INPAINTING",
      }
    `);
  });

  it('should send inpainting request with files and mask image', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);
    const maskData = new Uint8Array([255, 255, 255, 0]);

    await model.doGenerate({
      prompt: 'A sunlit indoor lounge area with a pool containing a flamingo',
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
      providerOptions: {
        bedrock: {
          quality: 'standard',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "numberOfImages": 1,
          "quality": "standard",
        },
        "inPaintingParams": {
          "image": "iVBORw==",
          "maskImage": "////AA==",
          "text": "A sunlit indoor lounge area with a pool containing a flamingo",
        },
        "taskType": "INPAINTING",
      }
    `);
  });

  it('should send inpainting request with base64 string data', async () => {
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';

    await model.doGenerate({
      prompt: 'Edit this image',
      files: [
        {
          type: 'file',
          data: base64Image,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          maskPrompt: 'background',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.taskType).toBe('INPAINTING');
    expect(requestBody.inPaintingParams.image).toBe(base64Image);
  });

  it('should include negativeText in inpainting params', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);

    await model.doGenerate({
      prompt: 'a beautiful garden',
      files: [
        {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          maskPrompt: 'sky',
          negativeText: 'clouds, rain',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "numberOfImages": 1,
        },
        "inPaintingParams": {
          "image": "iVBORw==",
          "maskPrompt": "sky",
          "negativeText": "clouds, rain",
          "text": "a beautiful garden",
        },
        "taskType": "INPAINTING",
      }
    `);
  });

  it('should extract edited images from response', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);

    const result = await model.doGenerate({
      prompt: 'Edit this image',
      files: [
        {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          maskPrompt: 'object',
        },
      },
    });

    expect(result.images).toMatchInlineSnapshot(`
      [
        "edited-image-base64",
      ]
    `);
  });

  it('should throw error for URL-based images', async () => {
    await expect(
      model.doGenerate({
        prompt: 'Edit this image',
        files: [
          {
            type: 'url',
            url: 'https://example.com/image.png',
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
      'URL-based images are not supported for Amazon Bedrock image editing.',
    );
  });

  it('should send outpainting request with taskType OUTPAINTING', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);
    const maskData = new Uint8Array([255, 255, 255, 0]);

    await model.doGenerate({
      prompt: 'Extend the background with a beautiful sunset',
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
      providerOptions: {
        bedrock: {
          taskType: 'OUTPAINTING',
          outPaintingMode: 'DEFAULT',
          negativeText: 'bad quality',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "numberOfImages": 1,
        },
        "outPaintingParams": {
          "image": "iVBORw==",
          "maskImage": "////AA==",
          "negativeText": "bad quality",
          "outPaintingMode": "DEFAULT",
          "text": "Extend the background with a beautiful sunset",
        },
        "taskType": "OUTPAINTING",
      }
    `);
  });

  it('should send outpainting request with maskPrompt', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);

    await model.doGenerate({
      prompt: 'Replace the background with mountains',
      files: [
        {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          taskType: 'OUTPAINTING',
          maskPrompt: 'background',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "numberOfImages": 1,
        },
        "outPaintingParams": {
          "image": "iVBORw==",
          "maskPrompt": "background",
          "text": "Replace the background with mountains",
        },
        "taskType": "OUTPAINTING",
      }
    `);
  });

  it('should send background removal request', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);

    await model.doGenerate({
      prompt: undefined,
      files: [
        {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          taskType: 'BACKGROUND_REMOVAL',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "backgroundRemovalParams": {
          "image": "iVBORw==",
        },
        "taskType": "BACKGROUND_REMOVAL",
      }
    `);
  });

  it('should send image variation request with single image', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);

    await model.doGenerate({
      prompt: 'Create a variation in anime style',
      files: [
        {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 3,
      size: '512x512',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          taskType: 'IMAGE_VARIATION',
          similarityStrength: 0.7,
          negativeText: 'bad quality, low resolution',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "height": 512,
          "numberOfImages": 3,
          "width": 512,
        },
        "imageVariationParams": {
          "images": [
            "iVBORw==",
          ],
          "negativeText": "bad quality, low resolution",
          "similarityStrength": 0.7,
          "text": "Create a variation in anime style",
        },
        "taskType": "IMAGE_VARIATION",
      }
    `);
  });

  it('should send image variation request with multiple images', async () => {
    const image1 = new Uint8Array([137, 80, 78, 71]);
    const image2 = new Uint8Array([255, 216, 255, 224]);

    await model.doGenerate({
      prompt: 'Combine these images into one cohesive scene',
      files: [
        {
          type: 'file',
          data: image1,
          mediaType: 'image/png',
        },
        {
          type: 'file',
          data: image2,
          mediaType: 'image/jpeg',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          taskType: 'IMAGE_VARIATION',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "numberOfImages": 1,
        },
        "imageVariationParams": {
          "images": [
            "iVBORw==",
            "/9j/4A==",
          ],
          "text": "Combine these images into one cohesive scene",
        },
        "taskType": "IMAGE_VARIATION",
      }
    `);
  });

  it('should default to IMAGE_VARIATION when files provided without mask or maskPrompt', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);

    await model.doGenerate({
      prompt: 'Create variations',
      files: [
        {
          type: 'file',
          data: imageData,
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
    expect(requestBody.taskType).toBe('IMAGE_VARIATION');
  });

  it('should default to INPAINTING when files provided with mask', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);
    const maskData = new Uint8Array([255, 255, 255, 0]);

    await model.doGenerate({
      prompt: 'Edit masked area',
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

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.taskType).toBe('INPAINTING');
  });

  it('should default to INPAINTING when files provided with maskPrompt', async () => {
    const imageData = new Uint8Array([137, 80, 78, 71]);

    await model.doGenerate({
      prompt: 'Edit the cat',
      files: [
        {
          type: 'file',
          data: imageData,
          mediaType: 'image/png',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        bedrock: {
          maskPrompt: 'cat',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.taskType).toBe('INPAINTING');
  });
});
