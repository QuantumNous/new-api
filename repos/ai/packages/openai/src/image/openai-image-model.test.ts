import fs from 'node:fs';

import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createOpenAI } from '../openai-provider';
import { OpenAIImageModel } from './openai-image-model';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const prompt = 'A cute baby sea otter';

const provider = createOpenAI({ apiKey: 'test-api-key' });
const model = provider.image('dall-e-3');

const server = createTestServer({
  'https://api.openai.com/v1/images/generations': {},
  'https://api.openai.com/v1/images/edits': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.openai.com/v1/images/generations'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/image/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

function prepareEditFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.openai.com/v1/images/edits'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/image/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('doGenerate', () => {
  it('should pass the model and the settings', async () => {
    prepareJsonFixtureResponse('openai-image');

    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: { openai: { style: 'vivid' } },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      style: 'vivid',
      response_format: 'b64_json',
    });
  });

  it('should map provider options to snake_case for /images/generations', async () => {
    prepareJsonFixtureResponse('openai-image');

    await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        openai: {
          quality: 'high',
          background: 'transparent',
          moderation: 'low',
          outputFormat: 'webp',
          outputCompression: 80,
          user: 'user-123',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
      background: 'transparent',
      moderation: 'low',
      output_format: 'webp',
      output_compression: 80,
      user: 'user-123',
    });
  });

  it('should pass headers', async () => {
    prepareJsonFixtureResponse('openai-image');

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.image('dall-e-3').doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: { openai: { style: 'vivid' } },
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
      'openai-organization': 'test-organization',
      'openai-project': 'test-project',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/openai/0.0.0-test`,
    );
  });

  it('should extract the generated images', async () => {
    prepareJsonFixtureResponse('openai-image');

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
        "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAA3CGNhQlgAADcIanVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNj",
        "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAEp2GNhQlgAASnYanVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNj",
      ]
    `);
  });

  it('should return warnings for unsupported settings', async () => {
    prepareJsonFixtureResponse('openai-image');

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
          "details": "This model does not support aspect ratio. Use \`size\` instead.",
          "feature": "aspectRatio",
          "type": "unsupported",
        },
        {
          "feature": "seed",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should respect maxImagesPerCall setting', async () => {
    const defaultModel = provider.image('dall-e-2');
    expect(defaultModel.maxImagesPerCall).toBe(10);

    const unknownModel = provider.image('unknown-model' as any);
    expect(unknownModel.maxImagesPerCall).toBe(1);
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareJsonFixtureResponse('openai-image', {
      'x-request-id': 'test-request-id',
      'x-ratelimit-remaining': '123',
    });

    const testDate = new Date('2024-03-15T12:00:00Z');

    const customModel = new OpenAIImageModel('dall-e-3', {
      provider: 'test-provider',
      url: () => 'https://api.openai.com/v1/images/generations',
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

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: 'dall-e-3',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });
  });

  it('should use real date when no custom date provider is specified', async () => {
    prepareJsonFixtureResponse('openai-image');
    const beforeDate = new Date();

    const result = await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const afterDate = new Date();

    expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(
      beforeDate.getTime(),
    );
    expect(result.response.timestamp.getTime()).toBeLessThanOrEqual(
      afterDate.getTime(),
    );
    expect(result.response.modelId).toBe('dall-e-3');
  });

  it('should not include response_format for gpt-image-1', async () => {
    prepareJsonFixtureResponse('openai-image');

    const gptImageModel = provider.image('gpt-image-1');
    await gptImageModel.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const requestBody =
      await server.calls[server.calls.length - 1].requestBodyJson;
    expect(requestBody).toStrictEqual({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
    });

    expect(requestBody).not.toHaveProperty('response_format');
  });

  it('should not include response_format for gpt-image-2', async () => {
    prepareJsonFixtureResponse('openai-image');

    const gptImageModel = provider.image('gpt-image-2');
    await gptImageModel.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const requestBody =
      await server.calls[server.calls.length - 1].requestBodyJson;
    expect(requestBody).toStrictEqual({
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: '1024x1024',
    });

    expect(requestBody).not.toHaveProperty('response_format');
  });

  it('should not include response_format for chatgpt-image-latest', async () => {
    prepareJsonFixtureResponse('openai-image');

    const chatgptImageModel = provider.image('chatgpt-image-latest');
    await chatgptImageModel.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const requestBody =
      await server.calls[server.calls.length - 1].requestBodyJson;
    expect(requestBody).toStrictEqual({
      model: 'chatgpt-image-latest',
      prompt,
      n: 1,
      size: '1024x1024',
    });

    expect(requestBody).not.toHaveProperty('response_format');
  });

  it('should not include response_format for date-suffixed gpt-image model IDs (Azure deployment names)', async () => {
    prepareJsonFixtureResponse('openai-image');

    const azureDeploymentModel = provider.image('gpt-image-1.5-2025-12-16');
    await azureDeploymentModel.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const requestBody =
      await server.calls[server.calls.length - 1].requestBodyJson;
    expect(requestBody).toStrictEqual({
      model: 'gpt-image-1.5-2025-12-16',
      prompt,
      n: 1,
      size: '1024x1024',
    });

    expect(requestBody).not.toHaveProperty('response_format');
  });

  it('should handle null revised_prompt responses', async () => {
    server.urls['https://api.openai.com/v1/images/generations'].response = {
      type: 'json-value',
      body: {
        created: 1733837122,
        data: [
          {
            revised_prompt: null,
            b64_json: 'base64-image-1',
          },
        ],
      },
    };

    const result = await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.images).toStrictEqual(['base64-image-1']);
    expect(result.warnings).toStrictEqual([]);
    expect(result.providerMetadata).toStrictEqual({
      openai: {
        images: [
          {
            created: 1733837122,
            size: undefined,
            quality: undefined,
            background: undefined,
            outputFormat: undefined,
          },
        ],
      },
    });
  });

  it('should include response_format for dall-e-3', async () => {
    prepareJsonFixtureResponse('openai-image');

    await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const requestBody =
      await server.calls[server.calls.length - 1].requestBodyJson;
    expect(requestBody).toHaveProperty('response_format', 'b64_json');
  });

  it('should return image meta data', async () => {
    prepareJsonFixtureResponse('openai-image');

    const result = await model.doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: { openai: { style: 'vivid' } },
    });

    expect(result.providerMetadata).toMatchInlineSnapshot(`
      {
        "openai": {
          "images": [
            {
              "background": undefined,
              "created": 1770935200,
              "outputFormat": undefined,
              "quality": undefined,
              "revisedPrompt": "A small and adorable baby sea otter. This little creature is covered in a thick and fluffy brown fur, its tiny paws are slightly visible. The otter has bright, curious eyes and it's floating on its back on a calm sea, surrounded by floating seaweed.",
              "size": undefined,
            },
            {
              "background": undefined,
              "created": 1770935200,
              "outputFormat": undefined,
              "quality": undefined,
              "size": undefined,
            },
          ],
        },
      }
    `);
  });

  it('should map OpenAI usage to usage', async () => {
    server.urls['https://api.openai.com/v1/images/generations'].response = {
      type: 'json-value',
      body: {
        created: 1733837122,
        data: [
          {
            b64_json: 'base64-image-1',
          },
        ],
        usage: {
          input_tokens: 12,
          output_tokens: 0,
          total_tokens: 12,
          input_tokens_details: {
            image_tokens: 7,
            text_tokens: 5,
          },
        },
      },
    };

    const result = await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.usage).toStrictEqual({
      inputTokens: 12,
      outputTokens: 0,
      totalTokens: 12,
    });

    expect(result.providerMetadata?.openai).toMatchObject({
      images: [
        {
          imageTokens: 7,
          textTokens: 5,
        },
      ],
    });
  });

  it('should distribute input token details evenly across images', async () => {
    server.urls['https://api.openai.com/v1/images/generations'].response = {
      type: 'json-value',
      body: {
        created: 1733837122,
        data: [
          { b64_json: 'base64-image-1' },
          { b64_json: 'base64-image-2' },
          { b64_json: 'base64-image-3' },
        ],
        usage: {
          input_tokens: 30,
          output_tokens: 900,
          total_tokens: 930,
          input_tokens_details: {
            image_tokens: 194,
            text_tokens: 28,
          },
        },
      },
    };

    const result = await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: undefined,
      mask: undefined,
      n: 3,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.providerMetadata?.openai).toMatchObject({
      images: [
        { imageTokens: 64, textTokens: 9 },
        { imageTokens: 64, textTokens: 9 },
        { imageTokens: 66, textTokens: 10 },
      ],
    });
  });
});

describe('doGenerate - image editing', () => {
  it('should call /images/edits endpoint when files are provided', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(server.calls[0].requestUrl).toBe(
      'https://api.openai.com/v1/images/edits',
    );
  });

  it('should send image as form data with Uint8Array input', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(await server.calls[0].requestBodyMultipart).toMatchObject({
      model: 'gpt-image-1',
      prompt,
      n: '1',
      size: '1024x1024',
    });
  });

  it('should send image as form data with base64 string input', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: 'iVBORw0KGgo=',
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const multipart = await server.calls[0].requestBodyMultipart;
    expect(multipart?.model).toBe('gpt-image-1');
    expect(multipart?.image).toBeDefined();
  });

  it('should send multiple images as form data array', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
        {
          type: 'file',
          mediaType: 'image/jpeg',
          data: new Uint8Array([255, 216, 255, 224]),
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    const multipart = await server.calls[0].requestBodyMultipart;
    expect(multipart?.['image[]']).toBeDefined();
  });

  it('should pass provider options in form data', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        openai: {
          quality: 'high',
          background: 'transparent',
        },
      },
    });

    expect(await server.calls[0].requestBodyMultipart).toMatchObject({
      quality: 'high',
      background: 'transparent',
    });
  });

  it('should map provider options to snake_case for /images/edits', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {
        openai: {
          inputFidelity: 'high',
          outputFormat: 'webp',
          outputCompression: 80,
          user: 'user-123',
        },
      },
    });

    expect(await server.calls[0].requestBodyMultipart).toMatchObject({
      input_fidelity: 'high',
      output_format: 'webp',
      output_compression: '80',
      user: 'user-123',
    });
  });

  it('should extract the edited images from response', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    const result = await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.images).toMatchInlineSnapshot(`
      [
        "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAFEE2NhQlgAAUQTanVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNj",
      ]
    `);
  });

  it('should include response metadata for edited images', async () => {
    prepareEditFixtureResponse('openai-image-edit', {
      'x-request-id': 'edit-request-id',
    });

    const testDate = new Date('2024-03-15T12:00:00Z');

    const customModel = new OpenAIImageModel('gpt-image-1', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.response.timestamp).toEqual(testDate);
    expect(result.response.modelId).toBe('gpt-image-1');
    expect(result.response.headers?.['x-request-id']).toBe('edit-request-id');
  });

  it('should return warnings for unsupported settings in edit mode', async () => {
    prepareEditFixtureResponse('openai-image-edit');

    const result = await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: '1024x1024',
      aspectRatio: '16:9',
      seed: 42,
      providerOptions: {},
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "This model does not support aspect ratio. Use \`size\` instead.",
          "feature": "aspectRatio",
          "type": "unsupported",
        },
        {
          "feature": "seed",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should return usage information for edited images', async () => {
    server.urls['https://api.openai.com/v1/images/edits'].response = {
      type: 'json-value',
      body: {
        created: 1733837122,
        data: [
          {
            b64_json: 'edited-base64-image-1',
          },
        ],
        usage: {
          input_tokens: 25,
          output_tokens: 0,
          total_tokens: 25,
        },
      },
    };

    const result = await provider.image('gpt-image-1').doGenerate({
      prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
      mask: undefined,
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      providerOptions: {},
    });

    expect(result.usage).toStrictEqual({
      inputTokens: 25,
      outputTokens: 0,
      totalTokens: 25,
    });
  });
});
