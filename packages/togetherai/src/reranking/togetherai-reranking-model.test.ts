import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTogetherAI } from '../togetherai-provider';
import type { TogetherAIRerankingModelOptions } from './togetherai-reranking-model-options';

const provider = createTogetherAI({ apiKey: 'test-api-key' });
const model = provider.rerankingModel('Salesforce/Llama-Rank-v1');

describe('doRerank', () => {
  const server = createTestServer({
    'https://api.together.xyz/v1/rerank': {},
  });

  function prepareJsonFixtureResponse(filename: string) {
    server.urls['https://api.together.xyz/v1/rerank'].response = {
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
      prepareJsonFixtureResponse('togetherai-reranking.1');

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
          togetherai: {
            rankFields: ['example'],
          } satisfies TogetherAIRerankingModelOptions,
        },
      });
    });

    it('should send request with stringified json documents', async () => {
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "documents": [
            {
              "example": "sunny day at the beach",
            },
            {
              "example": "rainy day in the city",
            },
          ],
          "model": "Salesforce/Llama-Rank-v1",
          "query": "rainy day",
          "rank_fields": [
            "example",
          ],
          "return_documents": false,
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
      expect(result.warnings).toMatchInlineSnapshot(`undefined`);
    });

    it('should return result with the correct ranking', async () => {
      expect(result.ranking).toMatchInlineSnapshot(`
        [
          {
            "index": 0,
            "relevanceScore": 0.6475887154399037,
          },
          {
            "index": 5,
            "relevanceScore": 0.6323295373206566,
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
            "id": "oGs6Zt9-62bZhn-99529372487b1b0a",
            "model": "Salesforce/Llama-Rank-v1",
            "object": "rerank",
            "results": [
              {
                "document": {},
                "index": 0,
                "relevance_score": 0.6475887154399037,
              },
              {
                "document": {},
                "index": 5,
                "relevance_score": 0.6323295373206566,
              },
            ],
            "usage": {
              "completion_tokens": 0,
              "prompt_tokens": 2966,
              "total_tokens": 2966,
            },
          },
          "headers": {
            "content-length": "304",
            "content-type": "application/json",
          },
          "id": "oGs6Zt9-62bZhn-99529372487b1b0a",
          "modelId": "Salesforce/Llama-Rank-v1",
        }
      `);
    });
  });

  describe('text documents', () => {
    let result: Awaited<ReturnType<typeof model.doRerank>>;

    beforeEach(async () => {
      prepareJsonFixtureResponse('togetherai-reranking.1');

      result = await model.doRerank({
        documents: {
          type: 'text',
          values: ['sunny day at the beach', 'rainy day in the city'],
        },
        query: 'rainy day',
        topN: 2,
        providerOptions: {
          togetherai: {
            rankFields: ['example'],
          } satisfies TogetherAIRerankingModelOptions,
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
          "model": "Salesforce/Llama-Rank-v1",
          "query": "rainy day",
          "rank_fields": [
            "example",
          ],
          "return_documents": false,
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
      expect(result.warnings).toMatchInlineSnapshot(`undefined`);
    });

    it('should return result with the correct ranking', async () => {
      expect(result.ranking).toMatchInlineSnapshot(`
        [
          {
            "index": 0,
            "relevanceScore": 0.6475887154399037,
          },
          {
            "index": 5,
            "relevanceScore": 0.6323295373206566,
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
            "id": "oGs6Zt9-62bZhn-99529372487b1b0a",
            "model": "Salesforce/Llama-Rank-v1",
            "object": "rerank",
            "results": [
              {
                "document": {},
                "index": 0,
                "relevance_score": 0.6475887154399037,
              },
              {
                "document": {},
                "index": 5,
                "relevance_score": 0.6323295373206566,
              },
            ],
            "usage": {
              "completion_tokens": 0,
              "prompt_tokens": 2966,
              "total_tokens": 2966,
            },
          },
          "headers": {
            "content-length": "304",
            "content-type": "application/json",
          },
          "id": "oGs6Zt9-62bZhn-99529372487b1b0a",
          "modelId": "Salesforce/Llama-Rank-v1",
        }
      `);
    });
  });
});
