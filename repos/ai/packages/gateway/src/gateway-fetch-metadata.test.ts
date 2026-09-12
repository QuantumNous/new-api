import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { GatewayFetchMetadata } from './gateway-fetch-metadata';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import {
  GatewayAuthenticationError,
  GatewayInternalServerError,
  GatewayRateLimitError,
  GatewayResponseError,
  GatewayError,
} from './errors';

function createBasicMetadataFetcher({
  headers,
  fetch,
}: {
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
} = {}) {
  return new GatewayFetchMetadata({
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-token' })),
    fetch,
  });
}

describe('GatewayFetchMetadata', () => {
  const mockModelEntry = {
    id: 'model-1',
    name: 'Model One',
    description: 'A test model',
    pricing: {
      input: '0.000001',
      output: '0.000002',
    },
    specification: {
      specificationVersion: 'v4' as const,
      provider: 'test-provider',
      modelId: 'model-1',
    },
  };

  const mockModelEntryWithoutPricing = {
    id: 'model-2',
    name: 'Model Two',
    specification: {
      specificationVersion: 'v4' as const,
      provider: 'test-provider',
      modelId: 'model-2',
    },
  };

  const server = createTestServer({
    'https://api.example.com/*': {
      response: {
        type: 'json-value',
        body: {
          models: [mockModelEntry],
        },
      },
    },
  });

  describe('getAvailableModels', () => {
    it('should fetch available models from the correct endpoint', async () => {
      const metadata = createBasicMetadataFetcher();

      const result = await metadata.getAvailableModels();

      expect(server.calls[0].requestMethod).toBe('GET');
      expect(server.calls[0].requestUrl).toBe('https://api.example.com/config');
      expect(result).toEqual({
        models: [mockModelEntry],
      });
    });

    it('should handle models with pricing information', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [mockModelEntry],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();

      expect(result.models[0]).toEqual(mockModelEntry);
      expect(result.models[0].pricing).toEqual({
        input: '0.000001',
        output: '0.000002',
      });
    });

    it('should map cache pricing fields to SDK names when present', async () => {
      const gatewayEntryWithCache = {
        ...mockModelEntry,
        pricing: {
          input: '0.000003',
          output: '0.000015',
          input_cache_read: '0.0000003',
          input_cache_write: '0.00000375',
        },
      };

      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [gatewayEntryWithCache],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();

      expect(result.models[0].pricing).toEqual({
        input: '0.000003',
        output: '0.000015',
        cachedInputTokens: '0.0000003',
        cacheCreationInputTokens: '0.00000375',
      });
      const pricing = result.models[0].pricing;
      expect(pricing).toBeDefined();
      if (pricing) {
        expect('input_cache_read' in pricing).toBe(false);
        expect('input_cache_write' in pricing).toBe(false);
      }
    });

    it('should handle models without pricing information', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [mockModelEntryWithoutPricing],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();

      expect(result.models[0]).toEqual(mockModelEntryWithoutPricing);
      expect(result.models[0].pricing).toBeUndefined();
    });

    it('should handle mixed models with and without pricing', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [mockModelEntry, mockModelEntryWithoutPricing],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();

      expect(result.models).toHaveLength(2);
      expect(result.models[0].pricing).toEqual({
        input: '0.000001',
        output: '0.000002',
      });
      expect(result.models[1].pricing).toBeUndefined();
    });

    it('should handle models with description', async () => {
      const modelWithDescription = {
        ...mockModelEntry,
        description: 'A powerful language model',
      };

      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [modelWithDescription],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();

      expect(result.models[0].description).toBe('A powerful language model');
    });

    it('should accept top-level modelType when present', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [
            {
              ...mockModelEntry,
              modelType: 'language',
            },
          ],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();
      expect(result.models[0].modelType).toBe('language');
    });

    it('should filter out models with unknown modelType values', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [
            {
              id: 'model-unknown-type',
              name: 'Unknown Type Model',
              specification: {
                specificationVersion: 'v4' as const,
                provider: 'test-provider',
                modelId: 'model-unknown-type',
              },
              modelType: 'some-future-type',
            },
          ],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();
      expect(result.models).toHaveLength(0);
    });

    it('should preserve all known modelType values', async () => {
      const knownTypes = [
        'embedding',
        'image',
        'language',
        'realtime',
        'reranking',
        'speech',
        'transcription',
        'video',
      ];
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: knownTypes.map((type, i) => ({
            id: `model-${type}`,
            name: `Model ${type}`,
            specification: {
              specificationVersion: 'v4' as const,
              provider: 'test-provider',
              modelId: `model-${type}`,
            },
            modelType: type,
          })),
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();
      expect(result.models).toHaveLength(knownTypes.length);
      for (let i = 0; i < knownTypes.length; i++) {
        expect(result.models[i].modelType).toBe(knownTypes[i]);
      }
    });

    it('should keep known models and filter unknown from mixed response', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [
            {
              ...mockModelEntry,
              modelType: 'language',
            },
            {
              id: 'model-future',
              name: 'Future Model',
              specification: {
                specificationVersion: 'v4' as const,
                provider: 'test-provider',
                modelId: 'model-future',
              },
              modelType: 'hologram',
            },
          ],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();
      expect(result.models).toHaveLength(1);
      expect(result.models[0].modelType).toBe('language');
    });

    it('should pass headers correctly', async () => {
      const metadata = createBasicMetadataFetcher({
        headers: () => ({
          Authorization: 'Bearer custom-token',
          'Custom-Header': 'custom-value',
        }),
      });

      await metadata.getAvailableModels();

      expect(server.calls[0].requestHeaders).toEqual({
        authorization: 'Bearer custom-token',
        'custom-header': 'custom-value',
      });
    });

    it('should handle API errors', async () => {
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

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getAvailableModels();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.message).toContain('No authentication provided');
        expect(authError.type).toBe('authentication_error');
        expect(authError.statusCode).toBe(401);
      }
    });

    it('should convert API call errors to Gateway errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 403,
        body: JSON.stringify({
          error: {
            message: 'Forbidden access',
            type: 'authentication_error',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getAvailableModels();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.message).toContain('No authentication provided');
        expect(authError.type).toBe('authentication_error');
        expect(authError.statusCode).toBe(403);
      }
    });

    it('should handle malformed JSON error responses', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: '{ invalid json',
      };

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getAvailableModels();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayResponseError.isInstance(error)).toBe(true);
        const responseError = error as GatewayResponseError;
        expect(responseError.statusCode).toBe(500);
        expect(responseError.type).toBe('response_error');
      }
    });

    it('should handle malformed response data', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          invalid: 'response',
        },
      };

      const metadata = createBasicMetadataFetcher();

      await expect(metadata.getAvailableModels()).rejects.toThrow();
    });

    it('should reject models with invalid pricing format', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [
            {
              id: 'model-1',
              name: 'Model One',
              pricing: {
                input: 123, // Should be string, not number
                output: '0.000002',
              },
              specification: {
                specificationVersion: 'v4',
                provider: 'test-provider',
                modelId: 'model-1',
              },
            },
          ],
        },
      };

      const metadata = createBasicMetadataFetcher();

      await expect(metadata.getAvailableModels()).rejects.toThrow();
    });

    it('should not double-wrap existing Gateway errors', async () => {
      // Create a Gateway error and verify it doesn't get wrapped
      const existingError = new GatewayAuthenticationError({
        message: 'Already wrapped',
        statusCode: 401,
      });

      // Test the catch block logic directly
      try {
        throw existingError;
      } catch (error: unknown) {
        if (GatewayError.isInstance(error)) {
          expect(error).toBe(existingError); // Should be the same instance
          expect(error.message).toBe('Already wrapped');
          return;
        }
        throw new Error('Should not reach here');
      }
    });

    it('should handle various server error types', async () => {
      // Test rate limit error
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

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getAvailableModels();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayRateLimitError.isInstance(error)).toBe(true);
        const rateLimitError = error as GatewayRateLimitError;
        expect(rateLimitError.message).toBe('Rate limit exceeded');
        expect(rateLimitError.type).toBe('rate_limit_exceeded');
        expect(rateLimitError.statusCode).toBe(429);
      }
    });

    it('should handle internal server errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Database connection failed',
            type: 'internal_server_error',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getAvailableModels();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayInternalServerError.isInstance(error)).toBe(true);
        const serverError = error as GatewayInternalServerError;
        expect(serverError.message).toBe('Database connection failed');
        expect(serverError.type).toBe('internal_server_error');
        expect(serverError.statusCode).toBe(500);
      }
    });

    it('should preserve error cause chain', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 401,
        body: JSON.stringify({
          error: {
            message: 'Token expired',
            type: 'authentication_error',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getAvailableModels();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.cause).toBeDefined();
      }
    });

    it('should use custom fetch function when provided', async () => {
      const customModelEntry = {
        id: 'custom-model-1',
        name: 'Custom Model One',
        description: 'Custom model description',
        pricing: {
          input: '0.000005',
          output: '0.000010',
        },
        specification: {
          specificationVersion: 'v4' as const,
          provider: 'custom-provider',
          modelId: 'custom-model-1',
        },
      };

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            models: [customModelEntry],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const metadata = createBasicMetadataFetcher({
        fetch: mockFetch,
      });

      const result = await metadata.getAvailableModels();

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({
        models: [customModelEntry],
      });
    });

    it('should handle empty response', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          models: [],
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getAvailableModels();

      expect(result).toEqual({
        models: [],
      });
    });
  });

  describe('getCredits', () => {
    it('should fetch credits from the correct endpoint', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          balance: '150.50',
          total_used: '75.25',
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getCredits();

      expect(result).toEqual({
        balance: '150.50',
        totalUsed: '75.25',
      });
    });

    it('should pass headers correctly to credits endpoint', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          balance: '100.00',
          total_used: '50.00',
        },
      };

      const metadata = createBasicMetadataFetcher({
        headers: () => ({
          Authorization: 'Bearer custom-token',
          'Custom-Header': 'custom-value',
        }),
      });

      const result = await metadata.getCredits();

      expect(server.calls[0].requestHeaders).toEqual({
        authorization: 'Bearer custom-token',
        'custom-header': 'custom-value',
      });
      expect(result).toEqual({
        balance: '100.00',
        totalUsed: '50.00',
      });
    });

    it('should handle API errors for credits endpoint', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 401,
        body: JSON.stringify({
          error: {
            type: 'authentication_error',
            message: 'Invalid API key',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      await expect(metadata.getCredits()).rejects.toThrow(
        GatewayAuthenticationError,
      );
    });

    it('should handle rate limit errors for credits endpoint', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 429,
        body: JSON.stringify({
          error: {
            type: 'rate_limit_exceeded',
            message: 'Rate limit exceeded',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      await expect(metadata.getCredits()).rejects.toThrow(
        GatewayRateLimitError,
      );
    });

    it('should handle internal server errors for credits endpoint', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            type: 'internal_server_error',
            message: 'Database unavailable',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      await expect(metadata.getCredits()).rejects.toThrow(
        GatewayInternalServerError,
      );
    });

    it('should handle malformed credits response', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          balance: 'not-a-number',
          total_used: '75.25',
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getCredits();

      expect(result).toEqual({
        balance: 'not-a-number',
        totalUsed: '75.25',
      });
    });

    it('should use custom fetch function when provided', async () => {
      const customFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            balance: '200.00',
            total_used: '100.50',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const metadata = createBasicMetadataFetcher({
        fetch: customFetch as unknown as FetchFunction,
      });

      const result = await metadata.getCredits();

      expect(result).toEqual({
        balance: '200.00',
        totalUsed: '100.50',
      });

      expect(customFetch).toHaveBeenCalledWith(
        'https://api.example.com/v1/credits',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('should convert API call errors to Gateway errors', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 403,
        body: JSON.stringify({
          error: {
            message: 'Forbidden access',
            type: 'authentication_error',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getCredits();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.message).toContain('No authentication provided');
        expect(authError.type).toBe('authentication_error');
        expect(authError.statusCode).toBe(403);
      }
    });

    it('should handle malformed JSON error responses', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 500,
        body: '{ invalid json',
      };

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getCredits();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayResponseError.isInstance(error)).toBe(true);
        const responseError = error as GatewayResponseError;
        expect(responseError.statusCode).toBe(500);
        expect(responseError.type).toBe('response_error');
      }
    });

    it('should not double-wrap existing Gateway errors', async () => {
      const existingError = new GatewayAuthenticationError({
        message: 'Already wrapped',
        statusCode: 401,
      });

      try {
        throw existingError;
      } catch (error: unknown) {
        if (GatewayError.isInstance(error)) {
          expect(error).toBe(existingError);
          expect(error.message).toBe('Already wrapped');
          return;
        }
        throw new Error('Should not reach here');
      }
    });

    it('should preserve error cause chain', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'error',
        status: 401,
        body: JSON.stringify({
          error: {
            message: 'Token expired',
            type: 'authentication_error',
          },
        }),
      };

      const metadata = createBasicMetadataFetcher();

      try {
        await metadata.getCredits();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.cause).toBeDefined();
      }
    });

    it('should handle empty response', async () => {
      server.urls['https://api.example.com/*'].response = {
        type: 'json-value',
        body: {
          balance: '0.00',
          total_used: '0.00',
        },
      };

      const metadata = createBasicMetadataFetcher();
      const result = await metadata.getCredits();

      expect(result).toEqual({
        balance: '0.00',
        totalUsed: '0.00',
      });
    });
  });
});
