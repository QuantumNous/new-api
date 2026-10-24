import type { EmbeddingModelV4Embedding } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { GoogleEmbeddingModel } from './google-embedding-model';
import { createGoogle } from './google-provider';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const dummyEmbeddings = [
  [0.1, 0.2, 0.3, 0.4, 0.5],
  [0.6, 0.7, 0.8, 0.9, 1.0],
];
const testValues = ['sunny day at the beach', 'rainy day in the city'];

const provider = createGoogle({ apiKey: 'test-api-key' });
const model = provider.embeddingModel('gemini-embedding-001');
const multimodalModel = provider.embeddingModel('gemini-embedding-2-preview');

const URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:something';
const MULTIMODAL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:something';

const server = createTestServer({
  [URL]: {},
  [MULTIMODAL_URL]: {},
});

describe('GoogleEmbeddingModel', () => {
  function prepareBatchJsonResponse({
    embeddings = dummyEmbeddings,
    headers,
    url = URL,
  }: {
    embeddings?: EmbeddingModelV4Embedding[];
    headers?: Record<string, string>;
    url?: typeof URL | typeof MULTIMODAL_URL;
  } = {}) {
    server.urls[url].response = {
      type: 'json-value',
      headers,
      body: {
        embeddings: embeddings.map(embedding => ({ values: embedding })),
      },
    };
  }

  function prepareSingleJsonResponse({
    embeddings = dummyEmbeddings,
    headers,
    url = URL,
  }: {
    embeddings?: EmbeddingModelV4Embedding[];
    headers?: Record<string, string>;
    url?: typeof URL | typeof MULTIMODAL_URL;
  } = {}) {
    server.urls[url].response = {
      type: 'json-value',
      headers,
      body: {
        embedding: { values: embeddings[0] },
      },
    };
  }

  it('should extract embedding', async () => {
    prepareBatchJsonResponse();

    const { embeddings } = await model.doEmbed({ values: testValues });

    expect(embeddings).toMatchInlineSnapshot(`
      [
        [
          0.1,
          0.2,
          0.3,
          0.4,
          0.5,
        ],
        [
          0.6,
          0.7,
          0.8,
          0.9,
          1,
        ],
      ]
    `);
  });

  it('should expose the raw response', async () => {
    prepareBatchJsonResponse({
      headers: {
        'test-header': 'test-value',
      },
    });

    const { response } = await model.doEmbed({ values: testValues });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "80",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
    expect(response).toMatchSnapshot();
  });

  it('should pass the model and the values', async () => {
    prepareBatchJsonResponse();

    await model.doEmbed({ values: testValues });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "requests": [
          {
            "content": {
              "parts": [
                {
                  "text": "sunny day at the beach",
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
          },
          {
            "content": {
              "parts": [
                {
                  "text": "rainy day in the city",
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
          },
        ],
      }
    `);
  });

  it('should pass the outputDimensionality setting', async () => {
    prepareBatchJsonResponse();

    await provider.embedding('gemini-embedding-001').doEmbed({
      values: testValues,
      providerOptions: {
        google: { outputDimensionality: 64 },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "requests": [
          {
            "content": {
              "parts": [
                {
                  "text": "sunny day at the beach",
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
            "outputDimensionality": 64,
          },
          {
            "content": {
              "parts": [
                {
                  "text": "rainy day in the city",
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
            "outputDimensionality": 64,
          },
        ],
      }
    `);
  });

  it('should pass the taskType setting', async () => {
    prepareBatchJsonResponse();

    await provider.embedding('gemini-embedding-001').doEmbed({
      values: testValues,
      providerOptions: { google: { taskType: 'SEMANTIC_SIMILARITY' } },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "requests": [
          {
            "content": {
              "parts": [
                {
                  "text": "sunny day at the beach",
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
            "taskType": "SEMANTIC_SIMILARITY",
          },
          {
            "content": {
              "parts": [
                {
                  "text": "rainy day in the city",
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
            "taskType": "SEMANTIC_SIMILARITY",
          },
        ],
      }
    `);
  });

  it('should pass headers', async () => {
    prepareBatchJsonResponse();

    const provider = createGoogle({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.embedding('gemini-embedding-001').doEmbed({
      values: testValues,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
      {
        "content-type": "application/json",
        "custom-provider-header": "provider-header-value",
        "custom-request-header": "request-header-value",
        "x-goog-api-key": "test-api-key",
      }
    `);
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/google/0.0.0-test`,
    );
  });

  it('should throw an error if too many values are provided', async () => {
    const model = new GoogleEmbeddingModel('gemini-embedding-001', {
      provider: 'google.generative-ai',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: () => ({}),
    });

    const tooManyValues = Array(101).fill('test');

    await expect(model.doEmbed({ values: tooManyValues })).rejects.toThrow(
      'Too many values for a single embedding call. The google.generative-ai model "gemini-embedding-001" can only embed up to 100 values per call, but 101 values were provided.',
    );
  });

  it('should expose the Google batch embedding API limit', () => {
    expect(model.maxEmbeddingsPerCall).toBe(100);
  });

  it('should use the batch embeddings endpoint', async () => {
    prepareBatchJsonResponse();
    const model = provider.embeddingModel('gemini-embedding-001');
    await model.doEmbed({
      values: testValues,
    });

    expect(server.calls[0].requestUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents',
    );
  });

  it('should use the single embeddings endpoint', async () => {
    prepareSingleJsonResponse();

    const model = provider.embeddingModel('gemini-embedding-001');

    await model.doEmbed({
      values: [testValues[0]],
    });

    expect(server.calls[0].requestUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
    );
  });

  it('should merge multimodal content for single embedding', async () => {
    prepareSingleJsonResponse();

    await model.doEmbed({
      values: [testValues[0]],
      providerOptions: {
        google: {
          content: [
            [{ inlineData: { mimeType: 'image/png', data: 'abc123' } }],
          ],
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "content": {
          "parts": [
            {
              "text": "sunny day at the beach",
            },
            {
              "inlineData": {
                "data": "abc123",
                "mimeType": "image/png",
              },
            },
          ],
        },
        "model": "models/gemini-embedding-001",
      }
    `);
  });

  it('should merge per-value multimodal content for batch embedding', async () => {
    prepareBatchJsonResponse();

    await model.doEmbed({
      values: testValues,
      providerOptions: {
        google: {
          content: [
            [{ inlineData: { mimeType: 'image/png', data: 'img1' } }],
            [{ inlineData: { mimeType: 'image/jpeg', data: 'img2' } }],
          ],
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "requests": [
          {
            "content": {
              "parts": [
                {
                  "text": "sunny day at the beach",
                },
                {
                  "inlineData": {
                    "data": "img1",
                    "mimeType": "image/png",
                  },
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
          },
          {
            "content": {
              "parts": [
                {
                  "text": "rainy day in the city",
                },
                {
                  "inlineData": {
                    "data": "img2",
                    "mimeType": "image/jpeg",
                  },
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
          },
        ],
      }
    `);
  });

  it('should handle null entries as text-only in batch embedding', async () => {
    prepareBatchJsonResponse();

    await model.doEmbed({
      values: testValues,
      providerOptions: {
        google: {
          content: [
            [{ inlineData: { mimeType: 'image/png', data: 'img1' } }],
            null,
          ],
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "requests": [
          {
            "content": {
              "parts": [
                {
                  "text": "sunny day at the beach",
                },
                {
                  "inlineData": {
                    "data": "img1",
                    "mimeType": "image/png",
                  },
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
          },
          {
            "content": {
              "parts": [
                {
                  "text": "rainy day in the city",
                },
              ],
              "role": "user",
            },
            "model": "models/gemini-embedding-001",
          },
        ],
      }
    `);
  });

  it('should merge fileData content for single embedding', async () => {
    prepareSingleJsonResponse({ url: MULTIMODAL_URL });

    await multimodalModel.doEmbed({
      values: [testValues[0]],
      providerOptions: {
        google: {
          content: [
            [
              {
                fileData: {
                  fileUri: 'gs://bucket/video.mp4',
                  mimeType: 'video/mp4',
                },
              },
            ],
          ],
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      content: {
        parts: [
          { text: 'sunny day at the beach' },
          {
            fileData: {
              fileUri: 'gs://bucket/video.mp4',
              mimeType: 'video/mp4',
            },
          },
        ],
      },
      model: 'models/gemini-embedding-2-preview',
    });
  });

  it('should merge fileData content for batch embedding', async () => {
    prepareBatchJsonResponse({ url: MULTIMODAL_URL });

    await multimodalModel.doEmbed({
      values: testValues,
      providerOptions: {
        google: {
          content: [
            [
              {
                fileData: {
                  fileUri: 'gs://bucket/video.mp4',
                  mimeType: 'video/mp4',
                },
              },
            ],
            null,
          ],
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      requests: [
        {
          content: {
            parts: [
              { text: 'sunny day at the beach' },
              {
                fileData: {
                  fileUri: 'gs://bucket/video.mp4',
                  mimeType: 'video/mp4',
                },
              },
            ],
            role: 'user',
          },
          model: 'models/gemini-embedding-2-preview',
        },
        {
          content: {
            parts: [{ text: 'rainy day in the city' }],
            role: 'user',
          },
          model: 'models/gemini-embedding-2-preview',
        },
      ],
    });
  });

  it('should throw error when content length does not match values length', async () => {
    prepareBatchJsonResponse();

    await expect(
      model.doEmbed({
        values: testValues,
        providerOptions: {
          google: {
            content: [
              [{ inlineData: { mimeType: 'image/png', data: 'img1' } }],
            ],
          },
        },
      }),
    ).rejects.toThrow(
      'The number of multimodal content entries (1) must match the number of values (2).',
    );
  });
});
