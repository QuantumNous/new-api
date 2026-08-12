import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { createCohere } from './cohere-provider';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const testValues = ['sunny day at the beach', 'rainy day in the city'];

const provider = createCohere({ apiKey: 'test-api-key' });
const model = provider.embeddingModel('embed-english-v3.0');

const server = createTestServer({
  'https://api.cohere.com/v2/embed': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.cohere.com/v2/embed'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('doEmbed', () => {
  beforeEach(() => {
    prepareJsonFixtureResponse('cohere-embedding');
  });

  it('should extract embedding', async () => {
    const { embeddings } = await model.doEmbed({ values: testValues });

    expect(embeddings).toMatchInlineSnapshot(`
      [
        [
          0.03302002,
          0.020904541,
          -0.019744873,
          -0.0625,
          0.04437256,
        ],
        [
          -0.04660034,
          0.00037765503,
          -0.061157227,
          -0.08239746,
          -0.010360718,
        ],
      ]
    `);
  });

  it('should expose the raw response', async () => {
    prepareJsonFixtureResponse('cohere-embedding', {
      'test-header': 'test-value',
    });

    const { response } = await model.doEmbed({ values: testValues });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "363",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
    expect(response).toMatchSnapshot();
  });

  it('should extract usage', async () => {
    const { usage } = await model.doEmbed({ values: testValues });

    expect(usage).toMatchInlineSnapshot(`
      {
        "tokens": 10,
      }
    `);
  });

  it('should pass the model and the values', async () => {
    await model.doEmbed({ values: testValues });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "embedding_types": [
          "float",
        ],
        "input_type": "search_query",
        "model": "embed-english-v3.0",
        "texts": [
          "sunny day at the beach",
          "rainy day in the city",
        ],
      }
    `);
  });

  it('should pass the input_type setting', async () => {
    await provider.embeddingModel('embed-english-v3.0').doEmbed({
      values: testValues,
      providerOptions: {
        cohere: {
          inputType: 'search_document',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "embedding_types": [
          "float",
        ],
        "input_type": "search_document",
        "model": "embed-english-v3.0",
        "texts": [
          "sunny day at the beach",
          "rainy day in the city",
        ],
      }
    `);
  });

  it('should pass the output_dimension setting', async () => {
    await provider.embeddingModel('embed-v4.0').doEmbed({
      values: testValues,
      providerOptions: {
        cohere: {
          outputDimension: 256,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "embedding_types": [
          "float",
        ],
        "input_type": "search_query",
        "model": "embed-v4.0",
        "output_dimension": 256,
        "texts": [
          "sunny day at the beach",
          "rainy day in the city",
        ],
      }
    `);
  });

  it('should pass headers', async () => {
    const provider = createCohere({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.embeddingModel('embed-english-v3.0').doEmbed({
      values: testValues,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const requestHeaders = server.calls[0].requestHeaders;

    expect(requestHeaders).toMatchInlineSnapshot(`
      {
        "authorization": "Bearer test-api-key",
        "content-type": "application/json",
        "custom-provider-header": "provider-header-value",
        "custom-request-header": "request-header-value",
      }
    `);
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/cohere/0.0.0-test`,
    );
  });
});
