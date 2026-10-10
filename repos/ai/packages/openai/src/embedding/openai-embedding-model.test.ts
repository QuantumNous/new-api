import fs from 'node:fs';

import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createOpenAI } from '../openai-provider';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const testValues = ['sunny day at the beach', 'rainy day in the city'];

const provider = createOpenAI({ apiKey: 'test-api-key' });
const model = provider.embedding('text-embedding-3-large');

const server = createTestServer({
  'https://api.openai.com/v1/embeddings': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.openai.com/v1/embeddings'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/embedding/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('doEmbed', () => {
  it('should extract embedding', async () => {
    prepareJsonFixtureResponse('openai-embedding');

    const { embeddings } = await model.doEmbed({ values: testValues });

    expect(embeddings).toMatchInlineSnapshot(`
      [
        [
          0.0057293195,
          -0.012727811,
          0.020042092,
          -0.013437585,
          0.022833068,
        ],
        [
          -0.037104916,
          -0.05178114,
          -0.008340587,
          0.001164541,
          -0.0035253682,
        ],
      ]
    `);
  });

  it('should expose the raw response headers', async () => {
    prepareJsonFixtureResponse('openai-embedding', {
      'test-header': 'test-value',
    });

    const { response } = await model.doEmbed({ values: testValues });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "327",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should expose the raw response body', async () => {
    prepareJsonFixtureResponse('openai-embedding');

    const { response } = await model.doEmbed({ values: testValues });

    expect(response).toMatchSnapshot();
  });

  it('should extract usage', async () => {
    prepareJsonFixtureResponse('openai-embedding');

    const { usage } = await model.doEmbed({ values: testValues });

    expect(usage).toMatchInlineSnapshot(`
      {
        "tokens": 12,
      }
    `);
  });

  it('should pass the model and the values', async () => {
    prepareJsonFixtureResponse('openai-embedding');

    await model.doEmbed({ values: testValues });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "encoding_format": "float",
        "input": [
          "sunny day at the beach",
          "rainy day in the city",
        ],
        "model": "text-embedding-3-large",
      }
    `);
  });

  it('should pass the dimensions setting', async () => {
    prepareJsonFixtureResponse('openai-embedding');

    await provider.embedding('text-embedding-3-large').doEmbed({
      values: testValues,
      providerOptions: { openai: { dimensions: 64 } },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "dimensions": 64,
        "encoding_format": "float",
        "input": [
          "sunny day at the beach",
          "rainy day in the city",
        ],
        "model": "text-embedding-3-large",
      }
    `);
  });

  it('should pass headers', async () => {
    prepareJsonFixtureResponse('openai-embedding');

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.embedding('text-embedding-3-large').doEmbed({
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
      'openai-organization': 'test-organization',
      'openai-project': 'test-project',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/openai/0.0.0-test`,
    );
  });
});
