import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { GatewaySpendReport } from './gateway-spend-report';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import {
  GatewayAuthenticationError,
  GatewayInternalServerError,
  GatewayRateLimitError,
  GatewayResponseError,
} from './errors';

function createSpendReport({
  headers,
  fetch,
}: {
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
} = {}) {
  return new GatewaySpendReport({
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-token' })),
    fetch,
  });
}

describe('GatewaySpendReport', () => {
  const server = createTestServer({
    'https://api.example.com/*': {
      response: {
        type: 'json-value',
        body: {
          results: [],
        },
      },
    },
  });

  describe('getSpendReport', () => {
    it('should fetch from the correct endpoint with required params', async () => {
      const report = createSpendReport();

      await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
      });

      expect(server.calls[0].requestMethod).toBe('GET');
      const url = new URL(server.calls[0].requestUrl);
      expect(url.pathname).toBe('/v1/report');
      expect(url.searchParams.get('start_date')).toBe('2026-03-01');
      expect(url.searchParams.get('end_date')).toBe('2026-03-25');
    });

    it('should serialize all optional query params', async () => {
      const report = createSpendReport();

      await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
        groupBy: 'model',
        datePart: 'hour',
        userId: 'user_123',
        model: 'anthropic/claude-sonnet-4.5',
        provider: 'anthropic',
        credentialType: 'byok',
        tags: ['production', 'api'],
      });

      const url = new URL(server.calls[0].requestUrl);
      expect(url.searchParams.get('group_by')).toBe('model');
      expect(url.searchParams.get('date_part')).toBe('hour');
      expect(url.searchParams.get('user_id')).toBe('user_123');
      expect(url.searchParams.get('model')).toBe('anthropic/claude-sonnet-4.5');
      expect(url.searchParams.get('provider')).toBe('anthropic');
      expect(url.searchParams.get('credential_type')).toBe('byok');
      expect(url.searchParams.get('tags')).toBe('production,api');
    });

    it('should not include optional params when not provided', async () => {
      const report = createSpendReport();

      await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
      });

      const url = new URL(server.calls[0].requestUrl);
      expect(url.searchParams.has('group_by')).toBe(false);
      expect(url.searchParams.has('date_part')).toBe(false);
      expect(url.searchParams.has('user_id')).toBe(false);
      expect(url.searchParams.has('model')).toBe(false);
      expect(url.searchParams.has('provider')).toBe(false);
      expect(url.searchParams.has('credential_type')).toBe(false);
      expect(url.searchParams.has('tags')).toBe(false);
    });

    it('should not include tags when array is empty', async () => {
      const report = createSpendReport();

      await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
        tags: [],
      });

      const url = new URL(server.calls[0].requestUrl);
      expect(url.searchParams.has('tags')).toBe(false);
    });

    it('should transform snake_case response fields to camelCase', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          results: [
            {
              day: '2026-03-01',
              total_cost: 12.5,
              market_cost: 11.0,
              input_tokens: 50000,
              output_tokens: 10000,
              cached_input_tokens: 5000,
              cache_creation_input_tokens: 2000,
              reasoning_tokens: 1000,
              request_count: 42,
            },
          ],
        },
      };

      const report = createSpendReport();
      const result = await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-01',
      });

      expect(result.results[0]).toEqual({
        day: '2026-03-01',
        totalCost: 12.5,
        marketCost: 11.0,
        inputTokens: 50000,
        outputTokens: 10000,
        cachedInputTokens: 5000,
        cacheCreationInputTokens: 2000,
        reasoningTokens: 1000,
        requestCount: 42,
      });
    });

    it('should transform credential_type to credentialType in response', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          results: [
            {
              credential_type: 'byok',
              total_cost: 5.0,
            },
          ],
        },
      };

      const report = createSpendReport();
      const result = await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
        groupBy: 'credential_type',
      });

      expect(result.results[0]).toEqual({
        credentialType: 'byok',
        totalCost: 5.0,
      });
      expect('credential_type' in result.results[0]).toBe(false);
    });

    it('should handle groupBy model response', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          results: [
            {
              model: 'anthropic/claude-sonnet-4.5',
              total_cost: 10.0,
              request_count: 100,
            },
            {
              model: 'openai/gpt-4o',
              total_cost: 8.0,
              request_count: 50,
            },
          ],
        },
      };

      const report = createSpendReport();
      const result = await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
        groupBy: 'model',
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].model).toBe('anthropic/claude-sonnet-4.5');
      expect(result.results[1].model).toBe('openai/gpt-4o');
    });

    it('should handle empty results', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          results: [],
        },
      };

      const report = createSpendReport();
      const result = await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
      });

      expect(result.results).toEqual([]);
    });

    it('should omit optional metric fields when not present', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          results: [
            {
              day: '2026-03-01',
              total_cost: 1.5,
            },
          ],
        },
      };

      const report = createSpendReport();
      const result = await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-01',
      });

      expect(result.results[0]).toEqual({
        day: '2026-03-01',
        totalCost: 1.5,
      });
      expect('marketCost' in result.results[0]).toBe(false);
      expect('inputTokens' in result.results[0]).toBe(false);
    });

    it('should pass headers correctly', async () => {
      const report = createSpendReport({
        headers: () => ({
          Authorization: 'Bearer custom-token',
          'Custom-Header': 'custom-value',
        }),
      });

      await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-25',
      });

      expect(server.calls[0].requestHeaders).toEqual({
        authorization: 'Bearer custom-token',
        'custom-header': 'custom-value',
      });
    });

    it('should handle 401 authentication errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 401,
        body: JSON.stringify({
          error: {
            message: 'Unauthorized',
            type: 'authentication_error',
          },
        }),
      };

      const report = createSpendReport();

      try {
        await report.getSpendReport({
          startDate: '2026-03-01',
          endDate: '2026-03-25',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.statusCode).toBe(401);
      }
    });

    it('should handle 429 rate limit errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 429,
        body: JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
          },
        }),
      };

      const report = createSpendReport();

      await expect(
        report.getSpendReport({
          startDate: '2026-03-01',
          endDate: '2026-03-25',
        }),
      ).rejects.toThrow(GatewayRateLimitError);
    });

    it('should handle 500 internal server errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Internal server error',
            type: 'internal_server_error',
          },
        }),
      };

      const report = createSpendReport();

      await expect(
        report.getSpendReport({
          startDate: '2026-03-01',
          endDate: '2026-03-25',
        }),
      ).rejects.toThrow(GatewayInternalServerError);
    });

    it('should handle malformed JSON error responses', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: '{ invalid json',
      };

      const report = createSpendReport();

      try {
        await report.getSpendReport({
          startDate: '2026-03-01',
          endDate: '2026-03-25',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayResponseError.isInstance(error)).toBe(true);
        const responseError = error as GatewayResponseError;
        expect(responseError.statusCode).toBe(500);
      }
    });

    it('should use custom fetch function when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                day: '2026-03-01',
                total_cost: 5.0,
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const report = createSpendReport({
        fetch: mockFetch,
      });

      const result = await report.getSpendReport({
        startDate: '2026-03-01',
        endDate: '2026-03-01',
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.results[0].totalCost).toBe(5.0);
    });
  });
});
