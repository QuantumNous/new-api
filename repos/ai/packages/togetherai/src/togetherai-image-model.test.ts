import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { TogetherAIImageModel } from './togetherai-image-model';

const prompt = 'A cute baby sea otter';

function createBasicModel({
  headers,
  fetch,
  currentDate,
}: {
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
} = {}) {
  return new TogetherAIImageModel('stabilityai/stable-diffusion-xl', {
    provider: 'togetherai',
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ 'api-key': 'test-key' })),
    fetch,
    _internal: {
      currentDate,
    },
  });
}

const server = createTestServer({
  'https://api.example.com/*': {
    response: {
      type: 'json-value',
      body: {
        id: 'test-id',
        data: [{ index: 0, b64_json: 'test-base64-content' }],
        model: 'stabilityai/stable-diffusion-xl',
        object: 'list',
      },
    },
  },
});

describe('doGenerate', () => {
  it('should pass the correct parameters including size and seed', async () => {
    const model = createBasicModel();

    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      seed: 42,
      providerOptions: { togetherai: { additional_param: 'value' } },
      aspectRatio: undefined,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'stabilityai/stable-diffusion-xl',
      prompt,
      seed: 42,
      width: 1024,
      height: 1024,
      response_format: 'base64',
      additional_param: 'value',
    });
  });

  it('should omit seed from request body when seed is undefined', async () => {
    const model = createBasicModel();

    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: undefined,
      seed: undefined,
      providerOptions: {},
      aspectRatio: undefined,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody).not.toHaveProperty('seed');
    expect(requestBody).toStrictEqual({
      model: 'stabilityai/stable-diffusion-xl',
      prompt,
      response_format: 'base64',
    });
  });

  it('should include n parameter when requesting multiple images', async () => {
    const model = createBasicModel();

    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 3,
      size: '1024x1024',
      seed: 42,
      providerOptions: {},
      aspectRatio: undefined,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'stabilityai/stable-diffusion-xl',
      prompt,
      seed: 42,
      n: 3,
      width: 1024,
      height: 1024,
      response_format: 'base64',
    });
  });

  it('should call the correct url', async () => {
    const model = createBasicModel();

    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      seed: 42,
      providerOptions: {},
      aspectRatio: undefined,
    });

    expect(server.calls[0].requestMethod).toStrictEqual('POST');
    expect(server.calls[0].requestUrl).toStrictEqual(
      'https://api.example.com/images/generations',
    );
  });

  it('should pass headers', async () => {
    const modelWithHeaders = createBasicModel({
      headers: () => ({
        'Custom-Provider-Header': 'provider-header-value',
      }),
    });

    await modelWithHeaders.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: undefined,
      seed: undefined,
      providerOptions: {},
      aspectRatio: undefined,
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

  it('should handle API errors', async () => {
    server.urls['https://api.example.com/*'].response = {
      type: 'error',
      status: 400,
      body: JSON.stringify({
        error: {
          message: 'Bad Request',
        },
      }),
    };

    const model = createBasicModel();
    await expect(
      model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        providerOptions: {},
        aspectRatio: undefined,
      }),
    ).rejects.toMatchObject({
      message: 'Bad Request',
    });
  });

  describe('warnings', () => {
    it('should return aspectRatio warning when aspectRatio is provided', async () => {
      const model = createBasicModel();

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
            "details": "This model does not support the \`aspectRatio\` option. Use \`size\` instead.",
            "feature": "aspectRatio",
            "type": "unsupported",
          },
        ]
      `);
    });
  });

  it('should respect the abort signal', async () => {
    const model = createBasicModel();
    const controller = new AbortController();

    const generatePromise = model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: undefined,
      seed: undefined,
      providerOptions: {},
      aspectRatio: undefined,
      abortSignal: controller.signal,
    });

    controller.abort();

    await expect(generatePromise).rejects.toThrow('This operation was aborted');
  });

  describe('response metadata', () => {
    it('should include timestamp, headers and modelId in response', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const model = createBasicModel({
        currentDate: () => testDate,
      });

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        providerOptions: {},
        aspectRatio: undefined,
      });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'stabilityai/stable-diffusion-xl',
        headers: expect.any(Object),
      });
    });

    it('should include response headers from API call', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          id: 'test-id',
          data: [{ index: 0, b64_json: 'test-base64-content' }],
          model: 'stabilityai/stable-diffusion-xl',
          object: 'list',
        },
        headers: {
          'x-request-id': 'test-request-id',
          'content-length': '128',
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
        providerOptions: {},
        aspectRatio: undefined,
      });

      expect(result.response.headers).toStrictEqual({
        'x-request-id': 'test-request-id',
        'content-type': 'application/json',
        'content-length': '128',
      });
    });
  });
});

describe('constructor', () => {
  it('should expose correct provider and model information', () => {
    const model = createBasicModel();

    expect(model.provider).toBe('togetherai');
    expect(model.modelId).toBe('stabilityai/stable-diffusion-xl');
    expect(model.specificationVersion).toBe('v4');
    expect(model.maxImagesPerCall).toBe(1);
  });
});

describe('Image Editing', () => {
  const server = createTestServer({
    'https://api.example.com/*': {
      response: {
        type: 'json-value',
        body: {
          id: 'test-id',
          data: [{ index: 0, b64_json: 'test-base64-content' }],
          model: 'black-forest-labs/FLUX.1-kontext-pro',
          object: 'list',
        },
      },
    },
  });

  it('should send image_url when URL file is provided', async () => {
    const model = createBasicModel();

    await model.doGenerate({
      prompt: 'Make the shirt yellow',
      files: [
        {
          type: 'url',
          url: 'https://example.com/input.jpg',
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
    expect(requestBody).toMatchInlineSnapshot(`
      {
        "image_url": "https://example.com/input.jpg",
        "model": "stabilityai/stable-diffusion-xl",
        "prompt": "Make the shirt yellow",
        "response_format": "base64",
      }
    `);
  });

  it('should convert Uint8Array file to data URI', async () => {
    const model = createBasicModel();
    const testImageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    await model.doGenerate({
      prompt: 'Transform this image',
      files: [
        {
          type: 'file',
          data: testImageData,
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
    expect(requestBody.image_url).toMatch(/^data:image\/png;base64,/);
    expect(requestBody.prompt).toBe('Transform this image');
  });

  it('should convert file with base64 string data to data URI', async () => {
    const model = createBasicModel();

    await model.doGenerate({
      prompt: 'Edit this',
      files: [
        {
          type: 'file',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
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
    expect(requestBody.image_url).toBe(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    );
  });

  it('should throw error when mask is provided', async () => {
    const model = createBasicModel();

    await expect(
      model.doGenerate({
        prompt: 'Inpaint this area',
        files: [
          {
            type: 'url',
            url: 'https://example.com/input.jpg',
          },
        ],
        mask: {
          type: 'url',
          url: 'https://example.com/mask.png',
        },
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      }),
    ).rejects.toThrow(
      'Together AI does not support mask-based image editing. ' +
        'Use FLUX Kontext models (e.g., black-forest-labs/FLUX.1-kontext-pro) ' +
        'with a reference image and descriptive prompt instead.',
    );
  });

  it('should warn when multiple files are provided', async () => {
    const model = createBasicModel();

    const result = await model.doGenerate({
      prompt: 'Edit multiple images',
      files: [
        {
          type: 'url',
          url: 'https://example.com/input1.jpg',
        },
        {
          type: 'url',
          url: 'https://example.com/input2.jpg',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "message": "Together AI only supports a single input image. Additional images are ignored.",
          "type": "other",
        },
      ]
    `);

    // Should only use the first image
    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.image_url).toBe('https://example.com/input1.jpg');
  });

  it('should pass provider options with image editing', async () => {
    const model = createBasicModel();

    await model.doGenerate({
      prompt: 'Transform the style',
      files: [
        {
          type: 'url',
          url: 'https://example.com/input.jpg',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        togetherai: {
          steps: 28,
          guidance: 3.5,
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody).toMatchInlineSnapshot(`
      {
        "guidance": 3.5,
        "image_url": "https://example.com/input.jpg",
        "model": "stabilityai/stable-diffusion-xl",
        "prompt": "Transform the style",
        "response_format": "base64",
        "steps": 28,
      }
    `);
  });
});
