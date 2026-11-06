import { TooManyEmbeddingValuesForCallError } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import * as fs from 'node:fs';
import { GoogleVertexEmbeddingModel } from './google-vertex-embedding-model';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGoogleVertex } from './google-vertex-provider-base';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const testValues = ['test text one', 'test text two'];

const DEFAULT_URL =
  'https://us-central1-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/us-central1/publishers/google/models/textembedding-gecko@001:predict';

const GEMINI_EMBEDDING_2_URL =
  'https://us-central1-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/us-central1/publishers/google/models/gemini-embedding-2:embedContent';

const CUSTOM_URL =
  'https://custom-endpoint.com/models/textembedding-gecko@001:predict';

const server = createTestServer({
  [DEFAULT_URL]: {},
  [GEMINI_EMBEDDING_2_URL]: {},
  [CUSTOM_URL]: {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls[DEFAULT_URL].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('GoogleVertexEmbeddingModel', () => {
  const mockModelId = 'textembedding-gecko@001';
  const mockProviderOptions = {
    outputDimensionality: 768,
    taskType: 'SEMANTIC_SIMILARITY',
    title: 'test title',
    autoTruncate: false,
  };

  const mockConfig = {
    provider: 'google-vertex',
    region: 'us-central1',
    project: 'test-project',
    headers: () => ({}),
    baseURL:
      'https://us-central1-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/us-central1/publishers/google',
  };

  const model = new GoogleVertexEmbeddingModel(mockModelId, mockConfig);

  describe('embedding', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('google-vertex-embedding');
    });

    it('should extract embeddings', async () => {
      const { embeddings } = await model.doEmbed({
        values: testValues,
        providerOptions: { google: mockProviderOptions },
      });

      expect(embeddings).toMatchInlineSnapshot(`
        [
          [
            -0.017999587580561638,
            -0.006893285550177097,
            -0.036766719073057175,
            -0.017558680847287178,
            -0.019938766956329346,
          ],
          [
            -0.06007182598114014,
            0.004907649010419846,
            -0.00690646655857563,
            -0.007314121350646019,
            -0.048464205116033554,
          ],
        ]
      `);
    });

    it('should return full result snapshot', async () => {
      const result = await model.doEmbed({
        values: testValues,
        providerOptions: { google: mockProviderOptions },
      });

      expect(result).toMatchSnapshot();
    });

    it('should extract usage', async () => {
      const { usage } = await model.doEmbed({
        values: testValues,
        providerOptions: { google: mockProviderOptions },
      });

      expect(usage).toMatchInlineSnapshot(`
        {
          "tokens": 11,
        }
      `);
    });

    it('should pass the model parameters correctly', async () => {
      await model.doEmbed({
        values: testValues,
        providerOptions: { google: mockProviderOptions },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "content": "test text one",
              "task_type": "SEMANTIC_SIMILARITY",
              "title": "test title",
            },
            {
              "content": "test text two",
              "task_type": "SEMANTIC_SIMILARITY",
              "title": "test title",
            },
          ],
          "parameters": {
            "autoTruncate": false,
            "outputDimensionality": 768,
          },
        }
      `);
    });

    it('should accept googleVertex as provider options key', async () => {
      await model.doEmbed({
        values: testValues,
        providerOptions: { googleVertex: mockProviderOptions },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "content": "test text one",
              "task_type": "SEMANTIC_SIMILARITY",
              "title": "test title",
            },
            {
              "content": "test text two",
              "task_type": "SEMANTIC_SIMILARITY",
              "title": "test title",
            },
          ],
          "parameters": {
            "autoTruncate": false,
            "outputDimensionality": 768,
          },
        }
      `);
    });

    it('should pass the taskType setting in instances', async () => {
      await model.doEmbed({
        values: testValues,
        providerOptions: {
          google: { taskType: mockProviderOptions.taskType },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "content": "test text one",
              "task_type": "SEMANTIC_SIMILARITY",
            },
            {
              "content": "test text two",
              "task_type": "SEMANTIC_SIMILARITY",
            },
          ],
          "parameters": {},
        }
      `);
    });

    it('should pass the title setting in instances', async () => {
      await model.doEmbed({
        values: testValues,
        providerOptions: { google: { title: mockProviderOptions.title } },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "instances": [
            {
              "content": "test text one",
              "title": "test title",
            },
            {
              "content": "test text two",
              "title": "test title",
            },
          ],
          "parameters": {},
        }
      `);
    });

    it('should use embedContent for gemini-embedding-2', async () => {
      server.urls[GEMINI_EMBEDDING_2_URL].response = {
        type: 'json-value',
        body: {
          embedding: { values: [0.1, 0.2, 0.3] },
          usageMetadata: { promptTokenCount: 4 },
        },
      };

      const geminiEmbeddingModel = new GoogleVertexEmbeddingModel(
        'gemini-embedding-2',
        mockConfig,
      );

      const result = await geminiEmbeddingModel.doEmbed({
        values: ['test text one'],
        providerOptions: { google: mockProviderOptions },
      });

      expect(server.calls[0].requestUrl).toBe(GEMINI_EMBEDDING_2_URL);
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "content": {
            "parts": [
              {
                "text": "test text one",
              },
            ],
          },
          "embedContentConfig": {
            "autoTruncate": false,
            "outputDimensionality": 768,
            "taskType": "SEMANTIC_SIMILARITY",
            "title": "test title",
          },
        }
      `);
      expect(result.embeddings).toStrictEqual([[0.1, 0.2, 0.3]]);
      expect(result.usage).toStrictEqual({ tokens: 4 });
    });

    it('should limit gemini-embedding-2 to one value per call', () => {
      const geminiEmbeddingModel = new GoogleVertexEmbeddingModel(
        'gemini-embedding-2',
        mockConfig,
      );

      expect(geminiEmbeddingModel.maxEmbeddingsPerCall).toBe(1);
    });
  });

  describe('response headers', () => {
    it('should expose response headers', async () => {
      prepareJsonFixtureResponse('google-vertex-embedding', {
        'test-header': 'test-value',
      });

      const { response } = await model.doEmbed({
        values: testValues,
        providerOptions: { google: mockProviderOptions },
      });

      expect(response?.headers).toMatchInlineSnapshot(`
        {
          "content-length": "429",
          "content-type": "application/json",
          "test-header": "test-value",
        }
      `);
    });
  });

  describe('response metadata', () => {
    it('should expose the raw response', async () => {
      prepareJsonFixtureResponse('google-vertex-embedding', {
        'test-header': 'test-value',
      });

      const { response } = await model.doEmbed({
        values: testValues,
        providerOptions: { google: mockProviderOptions },
      });

      expect(response).toMatchSnapshot();
    });
  });

  it('should pass headers correctly', async () => {
    prepareJsonFixtureResponse('google-vertex-embedding');

    const provider = createGoogleVertex({
      project: 'test-project',
      location: 'us-central1',
      headers: { 'X-Custom-Header': 'custom-value' },
    });

    await provider.embeddingModel(mockModelId).doEmbed({
      values: testValues,
      headers: { 'X-Request-Header': 'request-value' },
      providerOptions: { google: mockProviderOptions },
    });

    expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
      {
        "content-type": "application/json",
        "x-custom-header": "custom-value",
        "x-request-header": "request-value",
      }
    `);
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/google-vertex/0.0.0-test`,
    );
  });

  it('should throw TooManyEmbeddingValuesForCallError when too many values provided', async () => {
    const tooManyValues = Array(2049).fill('test');

    await expect(
      model.doEmbed({
        values: tooManyValues,
        providerOptions: { google: mockProviderOptions },
      }),
    ).rejects.toThrow(TooManyEmbeddingValuesForCallError);
  });

  it('should use custom baseURL when provided', async () => {
    server.urls[CUSTOM_URL].response = {
      type: 'json-value',
      body: JSON.parse(
        fs.readFileSync(
          'src/__fixtures__/google-vertex-embedding.json',
          'utf8',
        ),
      ),
    };

    const modelWithCustomUrl = new GoogleVertexEmbeddingModel(
      'textembedding-gecko@001',
      {
        headers: () => ({}),
        baseURL: 'https://custom-endpoint.com',
        provider: 'google-vertex',
      },
    );

    const response = await modelWithCustomUrl.doEmbed({
      values: testValues,
      providerOptions: {
        google: { outputDimensionality: 768 },
      },
    });

    expect(response.embeddings).toMatchInlineSnapshot(`
      [
        [
          -0.017999587580561638,
          -0.006893285550177097,
          -0.036766719073057175,
          -0.017558680847287178,
          -0.019938766956329346,
        ],
        [
          -0.06007182598114014,
          0.004907649010419846,
          -0.00690646655857563,
          -0.007314121350646019,
          -0.048464205116033554,
        ],
      ]
    `);

    expect(server.calls[0].requestUrl).toBe(
      'https://custom-endpoint.com/models/textembedding-gecko@001:predict',
    );
  });

  it('should use custom fetch when provided and include proper request content', async () => {
    const fixture = JSON.parse(
      fs.readFileSync('src/__fixtures__/google-vertex-embedding.json', 'utf8'),
    );
    const customFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(fixture)));

    const modelWithCustomFetch = new GoogleVertexEmbeddingModel(
      'textembedding-gecko@001',
      {
        headers: () => ({}),
        baseURL: 'https://custom-endpoint.com',
        provider: 'google-vertex',
        fetch: customFetch,
      },
    );

    const response = await modelWithCustomFetch.doEmbed({
      values: testValues,
      providerOptions: {
        google: { outputDimensionality: 768 },
      },
    });

    expect(response.embeddings).toMatchInlineSnapshot(`
      [
        [
          -0.017999587580561638,
          -0.006893285550177097,
          -0.036766719073057175,
          -0.017558680847287178,
          -0.019938766956329346,
        ],
        [
          -0.06007182598114014,
          0.004907649010419846,
          -0.00690646655857563,
          -0.007314121350646019,
          -0.048464205116033554,
        ],
      ]
    `);

    expect(customFetch).toHaveBeenCalledWith(CUSTOM_URL, expect.any(Object));

    const [_, secondArgument] = customFetch.mock.calls[0];
    const requestBody = JSON.parse(secondArgument.body);

    expect(requestBody).toMatchInlineSnapshot(`
      {
        "instances": [
          {
            "content": "test text one",
          },
          {
            "content": "test text two",
          },
        ],
        "parameters": {
          "outputDimensionality": 768,
        },
      }
    `);
  });
});
