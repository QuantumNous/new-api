import {
  TooManyEmbeddingValuesForCallError,
  UnsupportedFunctionalityError,
  type EmbeddingModelV4Embedding,
} from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, it, expect, vi } from 'vitest';
import { createAlibaba } from './alibaba-provider';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const testValues = ['sunny day at the beach', 'rainy day in the city'];
const dummyEmbeddings: EmbeddingModelV4Embedding[] = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
];

const provider = createAlibaba({ apiKey: 'test-api-key' });
const model = provider.embedding('text-embedding-v4');

const server = createTestServer({
  'https://dashscope-intl.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding':
    {},
});

function prepareJsonResponse({
  embeddings = dummyEmbeddings,
  usage = { total_tokens: 8 },
  headers,
  reverseOrder = false,
  sparse = false,
}: {
  embeddings?: EmbeddingModelV4Embedding[];
  usage?: { total_tokens: number } | null;
  headers?: Record<string, string>;
  reverseOrder?: boolean;
  sparse?: boolean;
} = {}) {
  const data = embeddings.map((embedding, textIndex) => ({
    embedding,
    text_index: textIndex,
    ...(sparse
      ? {
          sparse_embedding: [
            { index: textIndex + 100, value: 0.8, token: `token-${textIndex}` },
          ],
        }
      : {}),
  }));

  server.urls[
    'https://dashscope-intl.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
  ].response = {
    type: 'json-value',
    headers,
    body: {
      output: {
        embeddings: reverseOrder ? [...data].reverse() : data,
      },
      ...(usage === null ? {} : { usage }),
    },
  };
}

describe('doEmbed', () => {
  it('should extract embeddings in input order', async () => {
    prepareJsonResponse({ reverseOrder: true });

    const { embeddings } = await model.doEmbed({ values: testValues });

    expect(embeddings).toStrictEqual(dummyEmbeddings);
  });

  it('should extract usage', async () => {
    prepareJsonResponse({ usage: { total_tokens: 20 } });

    const { usage } = await model.doEmbed({ values: testValues });

    expect(usage).toStrictEqual({ tokens: 20 });
  });

  it('should omit usage when the response does not include usage', async () => {
    prepareJsonResponse({ usage: null });

    const { usage } = await model.doEmbed({ values: testValues });

    expect(usage).toBeUndefined();
  });

  it('should expose the raw response', async () => {
    prepareJsonResponse({
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await model.doEmbed({ values: testValues });

    expect(response?.headers).toMatchObject({
      'content-type': 'application/json',
      'test-header': 'test-value',
    });
    expect(response?.body).toStrictEqual({
      output: {
        embeddings: [
          { embedding: [0.1, 0.2, 0.3], text_index: 0 },
          { embedding: [0.4, 0.5, 0.6], text_index: 1 },
        ],
      },
      usage: { total_tokens: 8 },
    });
  });

  it('should pass the model and values', async () => {
    prepareJsonResponse();

    await model.doEmbed({ values: testValues });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'text-embedding-v4',
      input: {
        texts: testValues,
      },
      parameters: {},
    });
  });

  it('should pass provider options', async () => {
    prepareJsonResponse();

    await model.doEmbed({
      values: testValues,
      providerOptions: {
        alibaba: {
          textType: 'query',
          dimension: 768,
          outputType: 'dense&sparse',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'text-embedding-v4',
      input: {
        texts: testValues,
      },
      parameters: {
        text_type: 'query',
        dimension: 768,
        output_type: 'dense&sparse',
      },
    });
  });

  it('should extract sparse embeddings into provider metadata', async () => {
    prepareJsonResponse({ sparse: true });

    const { providerMetadata } = await model.doEmbed({
      values: testValues,
      providerOptions: {
        alibaba: {
          outputType: 'dense&sparse',
        },
      },
    });

    expect(providerMetadata).toStrictEqual({
      alibaba: {
        sparseEmbeddings: [
          {
            textIndex: 0,
            sparseEmbedding: [{ index: 100, value: 0.8, token: 'token-0' }],
          },
          {
            textIndex: 1,
            sparseEmbedding: [{ index: 101, value: 0.8, token: 'token-1' }],
          },
        ],
      },
    });
  });

  it('should reject sparse-only output', async () => {
    await expect(
      model.doEmbed({
        values: testValues,
        providerOptions: {
          alibaba: {
            outputType: 'sparse',
          },
        },
      }),
    ).rejects.toBeInstanceOf(UnsupportedFunctionalityError);

    expect(server.calls).toHaveLength(0);
  });

  it('should reject too many values', async () => {
    await expect(
      model.doEmbed({
        values: Array.from({ length: 11 }, (_, index) => `value-${index}`),
      }),
    ).rejects.toBeInstanceOf(TooManyEmbeddingValuesForCallError);

    expect(server.calls).toHaveLength(0);
  });

  it('should pass headers', async () => {
    prepareJsonResponse();

    const provider = createAlibaba({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.embedding('text-embedding-v4').doEmbed({
      values: testValues,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      'ai-sdk/alibaba/0.0.0-test',
    );
  });
});
