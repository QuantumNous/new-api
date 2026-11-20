import { describe, it, expect } from 'vitest';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { GatewayRerankingModel } from './gateway-reranking-model';
import type { GatewayConfig } from './gateway-config';
import {
  GatewayInvalidRequestError,
  GatewayInternalServerError,
} from './errors';

const dummyRanking = [
  { index: 0, relevanceScore: 0.89 },
  { index: 2, relevanceScore: 0.15 },
  { index: 1, relevanceScore: 0.12 },
];

const testDocuments = {
  type: 'text' as const,
  values: [
    'Paris is the capital of France.',
    'Berlin is the capital of Germany.',
    'Madrid is the capital of Spain.',
  ],
};

const testQuery = 'What is the capital of France?';

const server = createTestServer({
  'https://api.test.com/reranking-model': {},
});

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) =>
  new GatewayRerankingModel('cohere/rerank-v3.5', {
    provider: 'gateway',
    baseURL: 'https://api.test.com',
    headers: () => ({
      Authorization: 'Bearer test-token',
      'ai-gateway-auth-method': 'api-key',
    }),
    fetch: globalThis.fetch,
    o11yHeaders: config.o11yHeaders || {},
    ...config,
  });

describe('GatewayRerankingModel', () => {
  function prepareJsonResponse({
    ranking = dummyRanking,
    warnings,
    headers,
  }: {
    ranking?: Array<{ index: number; relevanceScore: number }>;
    warnings?: Array<
      | { type: 'unsupported'; feature: string; details?: string }
      | { type: 'compatibility'; feature: string; details?: string }
      | { type: 'deprecated'; setting: string; message: string }
      | { type: 'other'; message: string }
    >;
    headers?: Record<string, string>;
  } = {}) {
    server.urls['https://api.test.com/reranking-model'].response = {
      type: 'json-value',
      headers,
      body: { ranking, ...(warnings && { warnings }) },
    };
  }

  describe('doRerank', () => {
    it('should pass headers correctly', async () => {
      prepareJsonResponse();

      await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
        headers: { 'Custom-Header': 'test-value' },
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        authorization: 'Bearer test-token',
        'custom-header': 'test-value',
        'ai-reranking-model-specification-version': '4',
        'ai-model-id': 'cohere/rerank-v3.5',
      });
    });

    it('should include o11y headers', async () => {
      prepareJsonResponse();

      const o11yHeaders = {
        'ai-o11y-deployment-id': 'deployment-1',
        'ai-o11y-environment': 'production',
        'ai-o11y-region': 'iad1',
      } as const;

      await createTestModel({ o11yHeaders }).doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject(o11yHeaders);
    });

    it('should extract ranking from response', async () => {
      prepareJsonResponse({ ranking: dummyRanking });

      const { ranking } = await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      expect(ranking).toStrictEqual(dummyRanking);
    });

    it('should extract warnings', async () => {
      const mockWarnings = [
        {
          type: 'unsupported' as const,
          feature: 'topN',
          details: 'This model ignores topN.',
        },
      ];

      prepareJsonResponse({ warnings: mockWarnings });

      const { warnings } = await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      expect(warnings).toStrictEqual(mockWarnings);
    });

    it('should default warnings to an empty array when absent', async () => {
      prepareJsonResponse();

      const { warnings } = await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      expect(warnings).toStrictEqual([]);
    });

    it('should send documents and query in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
        topN: 2,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        documents: testDocuments,
        query: testQuery,
        topN: 2,
      });
    });

    it('should pass providerOptions into request body', async () => {
      prepareJsonResponse();

      await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
        providerOptions: { cohere: { maxTokensPerDoc: 512 } },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toMatchObject({
        providerOptions: { cohere: { maxTokensPerDoc: 512 } },
      });
    });

    it('should omit topN when not provided', async () => {
      prepareJsonResponse();

      await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toStrictEqual({
        documents: testDocuments,
        query: testQuery,
      });
    });

    it('should return response headers', async () => {
      prepareJsonResponse({
        headers: { 'x-request-id': 'req-123' },
      });

      const result = await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      expect(result.response?.headers?.['x-request-id']).toBe('req-123');
    });

    it('should return provider metadata', async () => {
      server.urls['https://api.test.com/reranking-model'].response = {
        type: 'json-value',
        body: {
          ranking: dummyRanking,
          providerMetadata: {
            gateway: { cost: '0.002' },
          },
        },
      };

      const result = await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      expect(result.providerMetadata).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw GatewayInvalidRequestError on 400', async () => {
      server.urls['https://api.test.com/reranking-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid documents format',
            type: 'invalid_request_error',
          },
        }),
      };

      await expect(
        createTestModel().doRerank({
          documents: testDocuments,
          query: testQuery,
        }),
      ).rejects.toSatisfy(
        err =>
          GatewayInvalidRequestError.isInstance(err) && err.statusCode === 400,
      );
    });

    it('should throw GatewayInternalServerError on 500', async () => {
      server.urls['https://api.test.com/reranking-model'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Internal server error',
            type: 'internal_server_error',
          },
        }),
      };

      await expect(
        createTestModel().doRerank({
          documents: testDocuments,
          query: testQuery,
        }),
      ).rejects.toSatisfy(
        err =>
          GatewayInternalServerError.isInstance(err) && err.statusCode === 500,
      );
    });
  });

  describe('URL construction', () => {
    it('should post to /reranking-model endpoint', async () => {
      prepareJsonResponse();

      await createTestModel().doRerank({
        documents: testDocuments,
        query: testQuery,
      });

      expect(server.calls[0].requestUrl).toBe(
        'https://api.test.com/reranking-model',
      );
    });
  });
});
