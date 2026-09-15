import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createCohere } from '../cohere-provider';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import type { CohereRerankingModelOptions } from './cohere-reranking-model-options';

const provider = createCohere({ apiKey: 'test-api-key' });
const model = provider.rerankingModel('rerank-english-v3.0');

describe('doRerank', () => {
  const server = createTestServer({
    'https://api.cohere.com/v2/rerank': {},
  });

  function prepareJsonFixtureResponse(filename: string) {
    server.urls['https://api.cohere.com/v2/rerank'].response = {
      type: 'json-value',
      body: JSON.parse(
        fs.readFileSync(`src/reranking/__fixtures__/${filename}.json`, 'utf8'),
      ),
    };
    return;
  }

  describe('json documents', () => {
    let result: Awaited<ReturnType<typeof model.doRerank>>;

    beforeEach(async () => {
      prepareJsonFixtureResponse('cohere-reranking.1');

      result = await model.doRerank({
        documents: {
          type: 'object',
          values: [
            { example: 'sunny day at the beach' },
            { example: 'rainy day in the city' },
          ],
        },
        query: 'rainy day',
        topN: 2,
        providerOptions: {
          cohere: {
            maxTokensPerDoc: 1000,
            priority: 1,
          } satisfies CohereRerankingModelOptions,
        },
      });
    });

    it('should send request with stringified json documents', async () => {
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "documents": [
            "{"example":"sunny day at the beach"}",
            "{"example":"rainy day in the city"}",
          ],
          "max_tokens_per_doc": 1000,
          "model": "rerank-english-v3.0",
          "priority": 1,
          "query": "rainy day",
          "top_n": 2,
        }
      `);
    });

    it('should send request with the correct headers', async () => {
      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer test-api-key",
          "content-type": "application/json",
        }
      `);
    });

    it('should return result with warnings', async () => {
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Object documents are converted to strings.",
            "feature": "object documents",
            "type": "compatibility",
          },
        ]
      `);
    });

    it('should return result with the correct ranking', async () => {
      expect(result.ranking).toMatchInlineSnapshot(`
        [
          {
            "index": 1,
            "relevanceScore": 0.10183054,
          },
          {
            "index": 0,
            "relevanceScore": 0.03762639,
          },
        ]
      `);
    });

    it('should not return provider metadata (use response body instead)', async () => {
      expect(result.providerMetadata).toMatchInlineSnapshot(`undefined`);
    });

    it('should return result with the correct response', async () => {
      expect(result.response).toMatchInlineSnapshot(`
        {
          "body": {
            "id": "b44fe75b-e3d3-489a-b61e-1a1aede3ef72",
            "meta": {
              "api_version": {
                "version": "2",
              },
              "billed_units": {
                "search_units": 1,
              },
            },
            "results": [
              {
                "index": 1,
                "relevance_score": 0.10183054,
              },
              {
                "index": 0,
                "relevance_score": 0.03762639,
              },
            ],
          },
          "headers": {
            "content-length": "212",
            "content-type": "application/json",
          },
          "id": "b44fe75b-e3d3-489a-b61e-1a1aede3ef72",
        }
      `);
    });
  });

  describe('text documents', () => {
    let result: Awaited<ReturnType<typeof model.doRerank>>;

    beforeEach(async () => {
      prepareJsonFixtureResponse('cohere-reranking.1');

      result = await model.doRerank({
        documents: {
          type: 'text',
          values: ['sunny day at the beach', 'rainy day in the city'],
        },
        query: 'rainy day',
        topN: 2,
        providerOptions: {
          cohere: {
            maxTokensPerDoc: 1000,
            priority: 1,
          } satisfies CohereRerankingModelOptions,
        },
      });
    });

    it('should send request with text documents', async () => {
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "documents": [
            "sunny day at the beach",
            "rainy day in the city",
          ],
          "max_tokens_per_doc": 1000,
          "model": "rerank-english-v3.0",
          "priority": 1,
          "query": "rainy day",
          "top_n": 2,
        }
      `);
    });

    it('should send request with the correct headers', async () => {
      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer test-api-key",
          "content-type": "application/json",
        }
      `);
    });

    it('should return result without warnings', async () => {
      expect(result.warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should return result with the correct ranking', async () => {
      expect(result.ranking).toMatchInlineSnapshot(`
        [
          {
            "index": 1,
            "relevanceScore": 0.10183054,
          },
          {
            "index": 0,
            "relevanceScore": 0.03762639,
          },
        ]
      `);
    });

    it('should not return provider metadata (use response body instead)', async () => {
      expect(result.providerMetadata).toMatchInlineSnapshot(`undefined`);
    });

    it('should return result with the correct response', async () => {
      expect(result.response).toMatchInlineSnapshot(`
        {
          "body": {
            "id": "b44fe75b-e3d3-489a-b61e-1a1aede3ef72",
            "meta": {
              "api_version": {
                "version": "2",
              },
              "billed_units": {
                "search_units": 1,
              },
            },
            "results": [
              {
                "index": 1,
                "relevance_score": 0.10183054,
              },
              {
                "index": 0,
                "relevance_score": 0.03762639,
              },
            ],
          },
          "headers": {
            "content-length": "212",
            "content-type": "application/json",
          },
          "id": "b44fe75b-e3d3-489a-b61e-1a1aede3ef72",
        }
      `);
    });
  });
});
