import { describe, it, expect } from 'vitest';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { GatewayEmbeddingModel } from './gateway-embedding-model';
import type { GatewayConfig } from './gateway-config';
import {
  GatewayInvalidRequestError,
  GatewayInternalServerError,
} from './errors';

const dummyEmbeddings = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
];
const testValues = ['sunny day at the beach', 'rainy afternoon in the city'];

const server = createTestServer({
  'https://api.test.com/embedding-model': {},
});

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) =>
  new GatewayEmbeddingModel('openai/text-embedding-3-small', {
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

describe('GatewayEmbeddingModel', () => {
  function prepareJsonResponse({
    embeddings = dummyEmbeddings,
    usage = { tokens: 8 },
    warnings,
    headers,
  }: {
    embeddings?: number[][];
    usage?: { tokens: number };
    warnings?: Array<
      | { type: 'unsupported'; feature: string; details?: string }
      | { type: 'compatibility'; feature: string; details?: string }
      | { type: 'deprecated'; setting: string; message: string }
      | { type: 'other'; message: string }
    >;
    headers?: Record<string, string>;
  } = {}) {
    server.urls['https://api.test.com/embedding-model'].response = {
      type: 'json-value',
      headers,
      body: {
        embeddings,
        usage,
        ...(warnings && { warnings }),
      },
    };
  }

  describe('doEmbed', () => {
    it('should pass headers correctly', async () => {
      prepareJsonResponse();

      await createTestModel().doEmbed({
        values: testValues,
        headers: { 'Custom-Header': 'test-value' },
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        authorization: 'Bearer test-token',
        'custom-header': 'test-value',
        'ai-embedding-model-specification-version': '4',
        'ai-model-id': 'openai/text-embedding-3-small',
      });
    });

    it('should include o11y headers', async () => {
      prepareJsonResponse();

      const o11yHeaders = {
        'ai-o11y-deployment-id': 'deployment-1',
        'ai-o11y-environment': 'production',
        'ai-o11y-region': 'iad1',
      } as const;

      await createTestModel({ o11yHeaders }).doEmbed({ values: testValues });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject(o11yHeaders);
    });

    it('should extract embeddings and usage', async () => {
      prepareJsonResponse({
        embeddings: dummyEmbeddings,
        usage: { tokens: 42 },
      });

      const { embeddings, usage } = await createTestModel().doEmbed({
        values: testValues,
      });

      expect(embeddings).toStrictEqual(dummyEmbeddings);
      expect(usage).toStrictEqual({ tokens: 42 });
    });

    it('should extract warnings', async () => {
      const mockWarnings = [
        {
          type: 'deprecated' as const,
          setting: 'dimensions',
          message: 'Use outputDimensions instead.',
        },
      ];

      prepareJsonResponse({ warnings: mockWarnings });

      const { warnings } = await createTestModel().doEmbed({
        values: testValues,
      });

      expect(warnings).toStrictEqual(mockWarnings);
    });

    it('should default warnings to an empty array when absent', async () => {
      prepareJsonResponse();

      const { warnings } = await createTestModel().doEmbed({
        values: testValues,
      });

      expect(warnings).toStrictEqual([]);
    });

    it('should send value as array', async () => {
      prepareJsonResponse();

      await createTestModel().doEmbed({ values: testValues });
      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        values: testValues,
      });
    });

    it('should pass providerOptions into request body', async () => {
      prepareJsonResponse();

      await createTestModel().doEmbed({
        values: testValues,
        providerOptions: { openai: { dimensions: 64 } },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        values: testValues,
        providerOptions: { openai: { dimensions: 64 } },
      });
    });

    it('should not include providerOptions when not provided', async () => {
      prepareJsonResponse();

      await createTestModel().doEmbed({ values: testValues });

      const body = await server.calls[0].requestBodyJson;
      expect(body).toStrictEqual({ values: testValues });
      expect('providerOptions' in body).toBe(false);
    });

    it('should convert gateway error responses', async () => {
      server.urls['https://api.test.com/embedding-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid input',
            type: 'invalid_request_error',
          },
        }),
      };

      await expect(
        createTestModel().doEmbed({ values: testValues }),
      ).rejects.toSatisfy(
        err =>
          GatewayInvalidRequestError.isInstance(err) && err.statusCode === 400,
      );

      server.urls['https://api.test.com/embedding-model'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Server blew up',
            type: 'internal_server_error',
          },
        }),
      };

      await expect(
        createTestModel().doEmbed({ values: testValues }),
      ).rejects.toSatisfy(
        err =>
          GatewayInternalServerError.isInstance(err) && err.statusCode === 500,
      );
    });

    it('should include providerMetadata in response body', async () => {
      server.urls['https://api.test.com/embedding-model'].response = {
        type: 'json-value',
        body: {
          embeddings: dummyEmbeddings,
          usage: { tokens: 5 },
          providerMetadata: { gateway: { routing: { test: true } } },
        },
      };

      const { response } = await createTestModel().doEmbed({
        values: testValues,
      });

      expect(response?.body).toMatchObject({
        providerMetadata: { gateway: { routing: { test: true } } },
      });
    });

    it('should extract providerMetadata to top level', async () => {
      server.urls['https://api.test.com/embedding-model'].response = {
        type: 'json-value',
        body: {
          embeddings: dummyEmbeddings,
          usage: { tokens: 5 },
          providerMetadata: { gateway: { routing: { test: true } } },
        },
      };

      const result = await createTestModel().doEmbed({
        values: testValues,
      });

      expect(result.providerMetadata).toStrictEqual({
        gateway: { routing: { test: true } },
      });
    });
  });
});
