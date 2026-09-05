import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { GatewayGenerationInfoFetcher } from './gateway-generation-info';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import {
  GatewayAuthenticationError,
  GatewayInternalServerError,
  GatewayResponseError,
} from './errors';

function createFetcher({
  headers,
  fetch,
}: {
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
} = {}) {
  return new GatewayGenerationInfoFetcher({
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-token' })),
    fetch,
  });
}

const mockGenerationResponse = {
  data: {
    id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
    total_cost: 0.00123,
    upstream_inference_cost: 0.0011,
    usage: 0.00123,
    created_at: '2024-01-01T00:00:00.000Z',
    model: 'gpt-4',
    is_byok: false,
    provider_name: 'openai',
    streamed: true,
    finish_reason: 'stop',
    latency: 200,
    generation_time: 1500,
    native_tokens_prompt: 100,
    native_tokens_completion: 50,
    native_tokens_reasoning: 0,
    native_tokens_cached: 0,
    native_tokens_cache_creation: 0,
    billable_web_search_calls: 0,
  },
};

describe('GatewayGenerationInfoFetcher', () => {
  const server = createTestServer({
    'https://api.example.com/*': {
      response: {
        type: 'json-value',
        body: mockGenerationResponse,
      },
    },
  });

  describe('getGenerationInfo', () => {
    it('should fetch from the correct endpoint with generation ID', async () => {
      const fetcher = createFetcher();

      await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      expect(server.calls[0].requestMethod).toBe('GET');
      const url = new URL(server.calls[0].requestUrl);
      expect(url.pathname).toBe('/v1/generation');
      expect(url.searchParams.get('id')).toBe('gen_01ARZ3NDEKTSV4RRFFQ69G5FAV');
    });

    it('should transform snake_case response fields to camelCase', async () => {
      const fetcher = createFetcher();

      const result = await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      expect(result).toEqual({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        totalCost: 0.00123,
        upstreamInferenceCost: 0.0011,
        usage: 0.00123,
        createdAt: '2024-01-01T00:00:00.000Z',
        model: 'gpt-4',
        isByok: false,
        providerName: 'openai',
        streamed: true,
        finishReason: 'stop',
        latency: 200,
        generationTime: 1500,
        promptTokens: 100,
        completionTokens: 50,
        reasoningTokens: 0,
        cachedTokens: 0,
        cacheCreationTokens: 0,
        billableWebSearchCalls: 0,
      });
    });

    it('should unwrap the data envelope', async () => {
      const fetcher = createFetcher();

      const result = await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      // Result should be the data object directly, not { data: ... }
      expect('data' in result).toBe(false);
      expect(result.id).toBe('gen_01ARZ3NDEKTSV4RRFFQ69G5FAV');
    });

    it('should not have snake_case fields in result', async () => {
      const fetcher = createFetcher();

      const result = await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      expect('total_cost' in result).toBe(false);
      expect('is_byok' in result).toBe(false);
      expect('provider_name' in result).toBe(false);
      expect('created_at' in result).toBe(false);
      expect('generation_time' in result).toBe(false);
      expect('finish_reason' in result).toBe(false);
    });

    it('should pass headers correctly', async () => {
      const fetcher = createFetcher({
        headers: () => ({
          Authorization: 'Bearer custom-token',
          'Custom-Header': 'custom-value',
        }),
      });

      await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
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

      const fetcher = createFetcher();

      try {
        await fetcher.getGenerationInfo({
          id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.statusCode).toBe(401);
      }
    });

    it('should handle 500 internal server errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Failed to retrieve usage data',
            type: 'internal_server_error',
          },
        }),
      };

      const fetcher = createFetcher();

      await expect(
        fetcher.getGenerationInfo({
          id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        }),
      ).rejects.toThrow(GatewayInternalServerError);
    });

    it('should handle malformed JSON error responses', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: '{ invalid json',
      };

      const fetcher = createFetcher();

      try {
        await fetcher.getGenerationInfo({
          id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
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
        new Response(JSON.stringify(mockGenerationResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const fetcher = createFetcher({ fetch: mockFetch });

      const result = await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.totalCost).toBe(0.00123);
      expect(result.model).toBe('gpt-4');
    });

    it('should encode special characters in generation ID', async () => {
      const fetcher = createFetcher();

      await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      const url = new URL(server.calls[0].requestUrl);
      expect(url.searchParams.get('id')).toBe('gen_01ARZ3NDEKTSV4RRFFQ69G5FAV');
    });

    it('should handle BYOK generation response', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          data: {
            ...mockGenerationResponse.data,
            is_byok: true,
            upstream_inference_cost: 0.0009,
            provider_name: 'anthropic',
            model: 'claude-sonnet-4',
          },
        },
      };

      const fetcher = createFetcher();
      const result = await fetcher.getGenerationInfo({
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      });

      expect(result.isByok).toBe(true);
      expect(result.upstreamInferenceCost).toBe(0.0009);
      expect(result.providerName).toBe('anthropic');
    });
  });
});
