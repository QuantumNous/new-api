import {
  InvalidArgumentError,
  LoadAPIKeyError,
  NoSuchModelError,
  type ImageModelV4CallOptions,
} from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateSvgResponseFixture,
  vectorizeSvgResponseFixture,
} from './__fixtures__/quiverai-fixtures';
import { createQuiverAI } from './quiverai-provider';

const decoder = new TextDecoder();
const canonicalModelIds = ['arrow-1', 'arrow-1.1', 'arrow-1.1-max'] as const;

const server = createTestServer({
  'https://api.quiver.ai/v1/svgs/generations': {
    response: {
      type: 'json-value',
      body: generateSvgResponseFixture,
    },
  },
  'https://env.quiver.ai/v1/svgs/generations': {
    response: {
      type: 'json-value',
      body: generateSvgResponseFixture,
    },
  },
  'https://override.quiver.ai/v1/svgs/generations': {
    response: {
      type: 'json-value',
      body: generateSvgResponseFixture,
    },
  },
  'https://api.quiver.ai/v1/svgs/vectorizations': {
    response: {
      type: 'json-value',
      body: vectorizeSvgResponseFixture,
    },
  },
});

const generateOptions: ImageModelV4CallOptions = {
  prompt: 'Draw a square icon.',
  n: 1,
  size: undefined,
  aspectRatio: undefined,
  seed: undefined,
  files: undefined,
  mask: undefined,
  providerOptions: {},
};

describe('createQuiverAI', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the default base URL and auth headers', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });
    const result = await provider.image('arrow-1').doGenerate(generateOptions);
    const image = result.images[0];

    expect(result.images).toHaveLength(1);
    expect(image).toBeInstanceOf(Uint8Array);
    expect(decoder.decode(image as Uint8Array)).toBe(
      generateSvgResponseFixture.data[0].svg,
    );
    expect(result.providerMetadata?.quiverai).toEqual({
      images: [{ index: 0, mimeType: 'image/svg+xml' }],
    });
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 9,
      totalTokens: 21,
    });
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].requestUrl).toBe(
      'https://api.quiver.ai/v1/svgs/generations',
    );
    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
    });
    expect(server.calls[0].requestUserAgent).toContain('ai-sdk/quiverai/');
  });

  it('reads the base URL and API key from the environment', async () => {
    vi.stubEnv('QUIVERAI_API_KEY', 'env-api-key');
    vi.stubEnv('QUIVERAI_BASE_URL', 'https://env.quiver.ai/v1');

    const provider = createQuiverAI();
    await provider.imageModel('arrow-1').doGenerate(generateOptions);

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].requestUrl).toBe(
      'https://env.quiver.ai/v1/svgs/generations',
    );
    expect(server.calls[0].requestHeaders.authorization).toBe(
      'Bearer env-api-key',
    );
  });

  it('throws when the QuiverAI API key is missing', async () => {
    const provider = createQuiverAI();

    const result = provider.image('arrow-1').doGenerate(generateOptions);

    await expect(result).rejects.toBeInstanceOf(LoadAPIKeyError);
    await expect(result).rejects.toThrow(
      "QuiverAI API key is missing. Pass it using the 'apiKey' parameter or the QUIVERAI_API_KEY environment variable.",
    );
  });

  it('prefers explicit options and exposes image factory methods', async () => {
    vi.stubEnv('QUIVERAI_API_KEY', 'env-api-key');
    vi.stubEnv('QUIVERAI_BASE_URL', 'https://env.quiver.ai/v1');

    const provider = createQuiverAI({
      apiKey: 'override-api-key',
      baseURL: 'https://override.quiver.ai/v1',
      headers: { 'X-QuiverAI-Test': '1' },
    });

    expect(provider.image('arrow-1').modelId).toBe('arrow-1');
    expect(provider.imageModel('arrow-1').provider).toBe('quiverai.image');

    await provider.image('arrow-1').doGenerate(generateOptions);

    expect(server.calls[0].requestUrl).toBe(
      'https://override.quiver.ai/v1/svgs/generations',
    );
    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer override-api-key',
      'x-quiverai-test': '1',
    });
  });

  it('throws for unsupported language and embedding models', () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    expect(() => provider.languageModel('chat-model')).toThrow(
      NoSuchModelError,
    );
    expect(() => provider.embeddingModel('embed-model')).toThrow(
      NoSuchModelError,
    );
    expect(() => provider.textEmbeddingModel('embed-model')).toThrow(
      NoSuchModelError,
    );
  });

  it('supports all canonical Quiver model ids', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    for (const modelId of canonicalModelIds) {
      expect(provider.image(modelId).modelId).toBe(modelId);
      expect(provider.imageModel(modelId).modelId).toBe(modelId);
      expect(provider.image(modelId).provider).toBe('quiverai.image');

      const result = await provider.image(modelId).doGenerate(generateOptions);

      expect(decoder.decode(result.images[0] as Uint8Array)).toBe(
        generateSvgResponseFixture.data[0].svg,
      );
      expect(result.response.modelId).toBe(modelId);
    }

    expect(server.calls).toHaveLength(canonicalModelIds.length);
    expect(
      await Promise.all(server.calls.map(call => call.requestBodyJson)),
    ).toMatchObject(canonicalModelIds.map(modelId => ({ model: modelId })));
  });

  it('vectorizes an image when requested through providerOptions', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });
    const result = await provider.image('arrow-1').doGenerate({
      ...generateOptions,
      prompt: undefined,
      files: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([1, 2, 3]),
        },
      ],
      providerOptions: { quiverai: { operation: 'vectorize' } },
    });

    expect(decoder.decode(result.images[0] as Uint8Array)).toBe(
      vectorizeSvgResponseFixture.data[0].svg,
    );
    expect(server.calls[0].requestUrl).toBe(
      'https://api.quiver.ai/v1/svgs/vectorizations',
    );
    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: 'arrow-1',
      n: 1,
      image: {
        base64: 'AQID',
      },
    });
  });

  it('forwards docs-backed generation options and reference images', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    await provider.image('arrow-1').doGenerate({
      ...generateOptions,
      files: [
        {
          type: 'url',
          url: 'https://example.com/reference-1.png',
        },
        {
          type: 'file',
          mediaType: 'image/png',
          data: new Uint8Array([4, 5, 6]),
        },
      ],
      providerOptions: {
        quiverai: {
          instructions: 'Use a flat monochrome style with clean geometry.',
          temperature: 0.4,
          topP: 0.95,
          presencePenalty: 0.2,
          maxOutputTokens: 4096,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: 'arrow-1',
      prompt: 'Draw a square icon.',
      instructions: 'Use a flat monochrome style with clean geometry.',
      temperature: 0.4,
      top_p: 0.95,
      presence_penalty: 0.2,
      max_output_tokens: 4096,
      stream: false,
      references: [
        { url: 'https://example.com/reference-1.png' },
        { base64: 'BAUG' },
      ],
    });
  });

  it('accepts up to 16 reference images for arrow-1.1-max', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    await provider.image('arrow-1.1-max').doGenerate({
      ...generateOptions,
      files: Array.from({ length: 16 }, (_, index) => ({
        type: 'url' as const,
        url: `https://example.com/reference-${index + 1}.png`,
      })),
    });

    const requestBody = (await server.calls[0].requestBodyJson) as {
      model: string;
      references: unknown[];
    };

    expect(requestBody).toMatchObject({
      model: 'arrow-1.1-max',
    });
    expect(requestBody.references).toHaveLength(16);
  });

  it('rejects more than 16 reference images for arrow-1.1-max', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    await expect(
      provider.image('arrow-1.1-max').doGenerate({
        ...generateOptions,
        files: Array.from({ length: 17 }, (_, index) => ({
          type: 'url' as const,
          url: `https://example.com/reference-${index + 1}.png`,
        })),
      }),
    ).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('forwards docs-backed vectorize options', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    await provider.image('arrow-1').doGenerate({
      ...generateOptions,
      prompt: undefined,
      files: [
        {
          type: 'url',
          url: 'https://example.com/logo.png',
        },
      ],
      providerOptions: {
        quiverai: {
          operation: 'vectorize',
          temperature: 0.4,
          topP: 0.95,
          presencePenalty: 0.2,
          maxOutputTokens: 4096,
          autoCrop: true,
          targetSize: 1024,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: 'arrow-1',
      image: {
        url: 'https://example.com/logo.png',
      },
      temperature: 0.4,
      top_p: 0.95,
      presence_penalty: 0.2,
      max_output_tokens: 4096,
      auto_crop: true,
      target_size: 1024,
      stream: false,
    });
  });

  it('fails fast when vectorize is requested without an input image', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    await expect(
      provider.image('arrow-1').doGenerate({
        ...generateOptions,
        prompt: undefined,
        providerOptions: { quiverai: { operation: 'vectorize' } },
      }),
    ).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('warns on unsupported call options', async () => {
    const provider = createQuiverAI({ apiKey: 'test-api-key' });

    const result = await provider.image('arrow-1').doGenerate({
      ...generateOptions,
      size: '1024x1024',
      aspectRatio: '1:1',
      seed: 42,
    });

    expect(result.warnings).toMatchObject([
      { type: 'unsupported', feature: 'size' },
      { type: 'unsupported', feature: 'aspectRatio' },
      { type: 'unsupported', feature: 'seed' },
    ]);
  });
});
