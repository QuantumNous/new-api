import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { injectFetchHeaders } from '../inject-fetch-headers';
import { AmazonBedrockRerankingModel } from './amazon-bedrock-reranking-model';
import type { AmazonBedrockRerankingModelOptions } from './amazon-bedrock-reranking-model-options';

const fakeFetchWithAuth = injectFetchHeaders({ 'x-amz-auth': 'test-auth' });

const model = new AmazonBedrockRerankingModel('cohere.rerank-v3-5:0', {
  baseUrl: () => 'https://bedrock-agent-runtime.us-east-1.amazonaws.com',
  region: 'us-west-2',
  headers: {
    'config-header': 'config-value',
    'shared-header': 'config-shared',
  },
  fetch: fakeFetchWithAuth,
});

describe('doRerank', () => {
  const server = createTestServer({
    'https://bedrock-agent-runtime.us-east-1.amazonaws.com/rerank': {},
  });

  function prepareJsonFixtureResponse(filename: string) {
    server.urls[
      'https://bedrock-agent-runtime.us-east-1.amazonaws.com/rerank'
    ].response = {
      type: 'binary',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(
        fs.readFileSync(`src/reranking/__fixtures__/${filename}.json`, 'utf8'),
      ),
    };
  }

  describe('json documents', () => {
    let result: Awaited<ReturnType<typeof model.doRerank>>;

    beforeEach(async () => {
      prepareJsonFixtureResponse('amazon-bedrock-reranking.1');

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
          bedrock: {
            nextToken: 'test-token',
            additionalModelRequestFields: {
              test: 'test-value',
            },
          } satisfies AmazonBedrockRerankingModelOptions,
        },
      });
    });

    it('should send request with stringified json documents', async () => {
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "nextToken": "test-token",
          "queries": [
            {
              "textQuery": {
                "text": "rainy day",
              },
              "type": "TEXT",
            },
          ],
          "rerankingConfiguration": {
            "bedrockRerankingConfiguration": {
              "modelConfiguration": {
                "additionalModelRequestFields": {
                  "test": "test-value",
                },
                "modelArn": "arn:aws:bedrock:us-west-2::foundation-model/cohere.rerank-v3-5:0",
              },
              "numberOfResults": 2,
            },
            "type": "BEDROCK_RERANKING_MODEL",
          },
          "sources": [
            {
              "inlineDocumentSource": {
                "jsonDocument": {
                  "example": "sunny day at the beach",
                },
                "type": "JSON",
              },
              "type": "INLINE",
            },
            {
              "inlineDocumentSource": {
                "jsonDocument": {
                  "example": "rainy day in the city",
                },
                "type": "JSON",
              },
              "type": "INLINE",
            },
          ],
        }
      `);
    });

    it('should send the AWS-required `bedrockRerankingConfiguration` wire key', async () => {
      const body = await server.calls[0].requestBodyJson;
      // The Bedrock Agent Runtime Rerank API requires this exact member name;
      // renaming it sends the required member as null and AWS rejects the
      // request with HTTP 400. Asserted explicitly (not via the body snapshot
      // above, which `--update` would silently regenerate) so a future rename
      // fails loudly instead of locking in a broken wire contract.
      // https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_RerankingConfiguration.html
      expect(body).toHaveProperty(
        'rerankingConfiguration.bedrockRerankingConfiguration',
      );
    });

    it('should send request with the correct headers', async () => {
      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "config-header": "config-value",
          "content-type": "application/json",
          "shared-header": "config-shared",
          "x-amz-auth": "test-auth",
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
            "relevanceScore": 0.5110583305358887,
          },
          {
            "index": 5,
            "relevanceScore": 0.30241215229034424,
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
            "results": [
              {
                "index": 0,
                "relevanceScore": 0.5110583305358887,
              },
              {
                "index": 5,
                "relevanceScore": 0.30241215229034424,
              },
            ],
          },
          "headers": {
            "content-length": "171",
            "content-type": "application/json",
          },
        }
      `);
    });
  });

  describe('text documents', () => {
    let result: Awaited<ReturnType<typeof model.doRerank>>;

    beforeEach(async () => {
      prepareJsonFixtureResponse('amazon-bedrock-reranking.1');

      result = await model.doRerank({
        documents: {
          type: 'text',
          values: ['sunny day at the beach', 'rainy day in the city'],
        },
        query: 'rainy day',
        topN: 2,
        providerOptions: {
          bedrock: {
            nextToken: 'test-token',
            additionalModelRequestFields: {
              test: 'test-value',
            },
          } satisfies AmazonBedrockRerankingModelOptions,
        },
      });
    });

    it('should send request with text documents', async () => {
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "nextToken": "test-token",
          "queries": [
            {
              "textQuery": {
                "text": "rainy day",
              },
              "type": "TEXT",
            },
          ],
          "rerankingConfiguration": {
            "bedrockRerankingConfiguration": {
              "modelConfiguration": {
                "additionalModelRequestFields": {
                  "test": "test-value",
                },
                "modelArn": "arn:aws:bedrock:us-west-2::foundation-model/cohere.rerank-v3-5:0",
              },
              "numberOfResults": 2,
            },
            "type": "BEDROCK_RERANKING_MODEL",
          },
          "sources": [
            {
              "inlineDocumentSource": {
                "textDocument": {
                  "text": "sunny day at the beach",
                },
                "type": "TEXT",
              },
              "type": "INLINE",
            },
            {
              "inlineDocumentSource": {
                "textDocument": {
                  "text": "rainy day in the city",
                },
                "type": "TEXT",
              },
              "type": "INLINE",
            },
          ],
        }
      `);
    });

    it('should send request with the correct headers', async () => {
      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "config-header": "config-value",
          "content-type": "application/json",
          "shared-header": "config-shared",
          "x-amz-auth": "test-auth",
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
            "relevanceScore": 0.5110583305358887,
          },
          {
            "index": 5,
            "relevanceScore": 0.30241215229034424,
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
            "results": [
              {
                "index": 0,
                "relevanceScore": 0.5110583305358887,
              },
              {
                "index": 5,
                "relevanceScore": 0.30241215229034424,
              },
            ],
          },
          "headers": {
            "content-length": "171",
            "content-type": "application/json",
          },
        }
      `);
    });
  });
});
