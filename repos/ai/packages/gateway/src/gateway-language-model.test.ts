import type {
  LanguageModelV4Prompt,
  LanguageModelV4FilePart,
} from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { GatewayLanguageModel } from './gateway-language-model';
import type { GatewayConfig } from './gateway-config';
import {
  GatewayAuthenticationError,
  GatewayRateLimitError,
  GatewayInternalServerError,
  GatewayInvalidRequestError,
  GatewayModelNotFoundError,
  GatewayResponseError,
} from './errors';
import { describe, it, expect, vi } from 'vitest';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) => {
  return new GatewayLanguageModel('test-model', {
    provider: 'test-provider',
    baseURL: 'https://api.test.com',
    headers: () => ({
      Authorization: 'Bearer test-token',
      'ai-gateway-auth-method': 'api-key',
    }),
    fetch: globalThis.fetch,
    o11yHeaders: config.o11yHeaders || {},
    ...config,
  });
};

describe('GatewayLanguageModel', () => {
  const server = createTestServer({
    'https://api.test.com/language-model': {},
  });

  describe('constructor', () => {
    it('should set basic properties', () => {
      const model = createTestModel();
      expect(model.modelId).toBe('test-model');
      expect(model.provider).toBe('test-provider');
      expect(model.specificationVersion).toBe('v4');
    });
  });

  describe('doGenerate', () => {
    function prepareJsonResponse({
      content = { type: 'text', text: '' },
      usage = {
        prompt_tokens: 4,
        completion_tokens: 30,
      },
      finish_reason = 'stop',
      id = 'test-id',
      created = 1711115037,
      model = 'test-model',
    } = {}) {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'json-value',
        body: {
          id,
          created,
          model,
          content,
          finish_reason,
          usage,
        },
      };
    }

    it('should pass headers correctly', async () => {
      prepareJsonResponse({ content: { type: 'text', text: 'Hello, World!' } });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        headers: {
          'Custom-Header': 'test-value',
        },
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        authorization: 'Bearer test-token',
        'custom-header': 'test-value',
        'ai-language-model-specification-version': '4',
        'ai-language-model-id': 'test-model',
        'ai-language-model-streaming': 'false',
      });
    });

    it('should extract text response', async () => {
      prepareJsonResponse({ content: { type: 'text', text: 'Hello, World!' } });

      const { content } = await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(content).toEqual({ type: 'text', text: 'Hello, World!' });
    });

    it('should extract usage information', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test' },
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      });

      const { usage } = await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
      });
    });

    it('should remove abortSignal from the request body', async () => {
      prepareJsonResponse({ content: { type: 'text', text: 'Test response' } });

      const controller = new AbortController();
      const signal = controller.signal;

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        abortSignal: signal,
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).not.toHaveProperty('abortSignal');
    });

    it('should pass abortSignal to fetch when provided', async () => {
      prepareJsonResponse({ content: { type: 'text', text: 'Test response' } });

      const mockFetch = vi.fn().mockImplementation(globalThis.fetch);

      const controller = new AbortController();
      const signal = controller.signal;

      await createTestModel({
        fetch: mockFetch,
      }).doGenerate({
        prompt: TEST_PROMPT,
        abortSignal: signal,
      });

      expect(mockFetch).toHaveBeenCalled();
      const fetchCallArgs = mockFetch.mock.calls[0];
      expect(fetchCallArgs[1].signal).toBe(signal);
    });

    it('should not pass abortSignal to fetch when not provided', async () => {
      prepareJsonResponse({ content: { type: 'text', text: 'Test response' } });

      const mockFetch = vi.fn().mockImplementation(globalThis.fetch);

      await createTestModel({
        fetch: mockFetch,
      }).doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(mockFetch).toHaveBeenCalled();
      const fetchCallArgs = mockFetch.mock.calls[0];
      expect(fetchCallArgs[1].signal).toBeUndefined();
    });

    it('should include o11y headers in the request', async () => {
      prepareJsonResponse({ content: { type: 'text', text: 'Hello, World!' } });

      const o11yHeaders = {
        'ai-o11y-deployment-id': 'test-deployment',
        'ai-o11y-environment': 'production',
        'ai-o11y-region': 'iad1',
      };

      await createTestModel({ o11yHeaders }).doGenerate({
        prompt: TEST_PROMPT,
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject(o11yHeaders);
    });
    it('should convert API call errors to Gateway errors', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 401,
        body: JSON.stringify({
          error: {
            message: 'Invalid API key provided',
            type: 'authentication_error',
          },
        }),
      };

      const model = createTestModel();

      try {
        await model.doGenerate({ prompt: TEST_PROMPT });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.message).toContain('Invalid API key');
        expect(authError.message).toContain('vercel.com/d?to=');
        expect(authError.statusCode).toBe(401);
        expect(authError.type).toBe('authentication_error');
      }
    });

    it('should handle malformed error responses', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 500,
        body: 'Not JSON',
      };

      const model = createTestModel();

      try {
        await model.doGenerate({ prompt: TEST_PROMPT });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayResponseError.isInstance(error)).toBe(true);
        const responseError = error as GatewayResponseError;
        expect(responseError.statusCode).toBe(500);
        expect(responseError.type).toBe('response_error');
      }
    });

    it('should handle rate limit errors', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 429,
        body: JSON.stringify({
          error: {
            message: 'Rate limit exceeded. Try again later.',
            type: 'rate_limit_exceeded',
          },
        }),
      };

      const model = createTestModel();

      try {
        await model.doGenerate({ prompt: TEST_PROMPT });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayRateLimitError.isInstance(error)).toBe(true);
        const rateLimitError = error as GatewayRateLimitError;
        expect(rateLimitError.message).toBe(
          'Rate limit exceeded. Try again later.',
        );
        expect(rateLimitError.statusCode).toBe(429);
        expect(rateLimitError.type).toBe('rate_limit_exceeded');
      }
    });

    it('should handle invalid request errors', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid prompt format',
            type: 'invalid_request_error',
          },
        }),
      };

      const model = createTestModel();

      try {
        await model.doGenerate({ prompt: TEST_PROMPT });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayInvalidRequestError.isInstance(error)).toBe(true);
        const invalidError = error as GatewayInvalidRequestError;
        expect(invalidError.message).toBe('Invalid prompt format');
        expect(invalidError.statusCode).toBe(400);
        expect(invalidError.type).toBe('invalid_request_error');
      }
    });

    describe('Image part encoding', () => {
      it('should not modify prompt without image parts', async () => {
        prepareJsonResponse({ content: { type: 'text', text: 'response' } });

        await createTestModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.prompt).toEqual(TEST_PROMPT);
      });

      it('should encode Uint8Array image part to inline base64 data with default mime type', async () => {
        prepareJsonResponse({ content: { type: 'text', text: 'response' } });
        const imageBytes = new Uint8Array([1, 2, 3, 4]);
        const expectedBase64 = Buffer.from(imageBytes).toString('base64');
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image:' },
              {
                type: 'file',
                data: { type: 'data' as const, data: imageBytes },
                mediaType: 'image/jpeg',
              },
            ],
          },
        ];

        await createTestModel().doGenerate({
          prompt: imagePrompt,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const imagePart = requestBody.prompt[0]
          .content[1] as LanguageModelV4FilePart;

        expect(imagePart.type).toBe('file');
        expect(imagePart.data).toEqual({
          type: 'data',
          data: expectedBase64,
        });
        expect(imagePart.mediaType).toBe('image/jpeg');
      });

      it('should encode Uint8Array image part to inline base64 data with specified mime type', async () => {
        prepareJsonResponse({ content: { type: 'text', text: 'response' } });
        const imageBytes = new Uint8Array([5, 6, 7, 8]);
        const expectedBase64 = Buffer.from(imageBytes).toString('base64');
        const mimeType = 'image/png';
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: imageBytes },
                mediaType: mimeType,
              },
            ],
          },
        ];

        await createTestModel().doGenerate({
          prompt: imagePrompt,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const imagePart = requestBody.prompt[0]
          .content[0] as LanguageModelV4FilePart;

        expect(imagePart.type).toBe('file');
        expect(imagePart.data).toEqual({
          type: 'data',
          data: expectedBase64,
        });
        expect(imagePart.mediaType).toBe(mimeType);
      });

      it('should not modify image part with URL', async () => {
        prepareJsonResponse({ content: { type: 'text', text: 'response' } });
        const imageUrl = new URL('https://example.com/image.jpg');
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Image URL:' },
              {
                type: 'file',
                data: { type: 'url' as const, url: imageUrl },
                mediaType: 'image/jpeg',
              },
            ],
          },
        ];

        await createTestModel().doGenerate({
          prompt: imagePrompt,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const imagePart = requestBody.prompt[0]
          .content[1] as LanguageModelV4FilePart;

        expect(imagePart.type).toBe('file');
        expect(imagePart.data).toEqual({
          type: 'url',
          url: imageUrl.toString(),
        });
      });

      it('should handle mixed content types correctly', async () => {
        prepareJsonResponse({ content: { type: 'text', text: 'response' } });
        const imageBytes = new Uint8Array([1, 2, 3, 4]);
        const expectedBase64 = Buffer.from(imageBytes).toString('base64');
        const imageUrl = new URL('https://example.com/image2.png');
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'First text.' },
              {
                type: 'file',
                data: { type: 'data' as const, data: imageBytes },
                mediaType: 'image/gif',
              },
              { type: 'text', text: 'Second text.' },
              {
                type: 'file',
                data: { type: 'url' as const, url: imageUrl },
                mediaType: 'image/png',
              },
            ],
          },
        ];

        await createTestModel().doGenerate({
          prompt: imagePrompt,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const content = requestBody.prompt[0].content;

        expect(content[0]).toEqual({ type: 'text', text: 'First text.' });
        expect(content[1]).toEqual({
          type: 'file',
          data: { type: 'data', data: expectedBase64 },
          mediaType: 'image/gif',
        });
        expect(content[2]).toEqual({ type: 'text', text: 'Second text.' });
        expect(content[3]).toEqual({
          type: 'file',
          data: { type: 'url', url: imageUrl.toString() },
          mediaType: 'image/png',
        });
      });
    });

    it('should handle various error types with proper conversion', async () => {
      const model = createTestModel();

      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid request format',
            type: 'invalid_request_error',
          },
        }),
      };

      try {
        await model.doGenerate({ prompt: TEST_PROMPT });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayInvalidRequestError.isInstance(error)).toBe(true);
        const invalidError = error as GatewayInvalidRequestError;
        expect(invalidError.message).toBe('Invalid request format');
        expect(invalidError.statusCode).toBe(400);
        expect(invalidError.type).toBe('invalid_request_error');
      }

      // Test model not found error
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 404,
        body: JSON.stringify({
          error: {
            message: 'Model xyz not found',
            type: 'model_not_found',
            param: { modelId: 'xyz' },
          },
        }),
      };

      try {
        await model.doGenerate({ prompt: TEST_PROMPT });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayModelNotFoundError.isInstance(error)).toBe(true);
        const modelError = error as GatewayModelNotFoundError;
        expect(modelError.message).toBe('Model xyz not found');
        expect(modelError.statusCode).toBe(404);
        expect(modelError.type).toBe('model_not_found');
        expect(modelError.modelId).toBe('xyz');
      }

      // Test internal server error
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Database connection failed',
            type: 'internal_server_error',
          },
        }),
      };

      try {
        await model.doGenerate({ prompt: TEST_PROMPT });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayInternalServerError.isInstance(error)).toBe(true);
        const serverError = error as GatewayInternalServerError;
        expect(serverError.message).toBe('Database connection failed');
        expect(serverError.statusCode).toBe(500);
        expect(serverError.type).toBe('internal_server_error');
      }
    });

    describe('Gateway error handling for malformed responses', () => {
      it('should include actual response body when APICallError has no data', async () => {
        const malformedResponse = {
          ferror: { message: 'Model not found', type: 'model_not_found' },
        };

        // Mock the server to return malformed response that can't be parsed by AI SDK
        server.urls['https://api.test.com/language-model'].response = {
          type: 'error',
          status: 404,
          body: JSON.stringify(malformedResponse),
        };

        const model = createTestModel();

        try {
          await model.doGenerate({
            prompt: [
              { role: 'user', content: [{ type: 'text', text: 'test' }] },
            ],
          });
          expect.fail('Expected error to be thrown');
        } catch (error) {
          expect(GatewayResponseError.isInstance(error)).toBe(true);
          const gatewayError = error as GatewayResponseError;
          expect(gatewayError.response).toEqual(malformedResponse);
          expect(gatewayError.validationError).toBeDefined();
        }
      });

      it('should use raw response body when JSON parsing fails', async () => {
        const invalidJson = 'invalid json response';

        // Mock the server to return invalid JSON
        server.urls['https://api.test.com/language-model'].response = {
          type: 'error',
          status: 500,
          body: invalidJson,
        };

        const model = createTestModel();

        try {
          await model.doGenerate({
            prompt: [
              { role: 'user', content: [{ type: 'text', text: 'test' }] },
            ],
          });
          expect.fail('Expected error to be thrown');
        } catch (error) {
          expect(GatewayResponseError.isInstance(error)).toBe(true);
          const gatewayError = error as GatewayResponseError;
          expect(gatewayError.response).toBe(invalidJson);
          expect(gatewayError.validationError).toBeDefined();
        }
      });
    });
  });

  describe('doStream', () => {
    function prepareStreamResponse({
      content,
      finish_reason = 'stop',
    }: {
      content: string[];
      finish_reason?: string;
    }) {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          ...content.map(
            text =>
              `data: ${JSON.stringify({
                type: 'text-delta',
                textDelta: text,
              })}\n\n`,
          ),
          `data: ${JSON.stringify({
            type: 'finish',
            finishReason: finish_reason,
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
            },
          })}\n\n`,
        ],
      };
    }

    it('should stream text deltas', async () => {
      prepareStreamResponse({
        content: ['Hello', ', ', 'World!'],
      });

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "textDelta": "Hello",
            "type": "text-delta",
          },
          {
            "textDelta": ", ",
            "type": "text-delta",
          },
          {
            "textDelta": "World!",
            "type": "text-delta",
          },
          {
            "finishReason": "stop",
            "type": "finish",
            "usage": {
              "completion_tokens": 20,
              "prompt_tokens": 10,
            },
          },
        ]
      `);
    });

    it('should pass streaming headers', async () => {
      prepareStreamResponse({
        content: ['Test'],
      });

      await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject({
        'ai-language-model-specification-version': '4',
        'ai-language-model-id': 'test-model',
        'ai-language-model-streaming': 'true',
      });
    });

    it('should remove abortSignal from the streaming request body', async () => {
      prepareStreamResponse({
        content: ['Test content'],
      });

      const controller = new AbortController();
      const signal = controller.signal;

      await createTestModel().doStream({
        prompt: TEST_PROMPT,
        abortSignal: signal,
        includeRawChunks: false,
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody).not.toHaveProperty('abortSignal');
    });

    it('should pass abortSignal to fetch when provided for streaming', async () => {
      prepareStreamResponse({
        content: ['Test content'],
      });

      const mockFetch = vi.fn().mockImplementation(globalThis.fetch);

      const controller = new AbortController();
      const signal = controller.signal;

      await createTestModel({
        fetch: mockFetch,
      }).doStream({
        prompt: TEST_PROMPT,
        abortSignal: signal,
        includeRawChunks: false,
      });

      expect(mockFetch).toHaveBeenCalled();
      const fetchCallArgs = mockFetch.mock.calls[0];
      expect(fetchCallArgs[1].signal).toBe(signal);
    });

    it('should not pass abortSignal to fetch when not provided for streaming', async () => {
      prepareStreamResponse({
        content: ['Test content'],
      });

      const mockFetch = vi.fn().mockImplementation(globalThis.fetch);

      await createTestModel({
        fetch: mockFetch,
      }).doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(mockFetch).toHaveBeenCalled();
      const fetchCallArgs = mockFetch.mock.calls[0];
      expect(fetchCallArgs[1].signal).toBeUndefined();
    });

    it('should include o11y headers in the streaming request', async () => {
      prepareStreamResponse({
        content: ['Test content'],
      });

      const o11yHeaders = {
        'ai-o11y-deployment-id': 'test-deployment',
        'ai-o11y-environment': 'production',
        'ai-o11y-region': 'iad1',
      };

      await createTestModel({ o11yHeaders }).doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const headers = server.calls[0].requestHeaders;
      expect(headers).toMatchObject(o11yHeaders);
    });

    it('should convert API call errors to Gateway errors in streaming', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 429,
        body: JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
          },
        }),
      };

      const model = createTestModel();

      try {
        await model.doStream({ prompt: TEST_PROMPT, includeRawChunks: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayRateLimitError.isInstance(error)).toBe(true);
        const rateLimitError = error as GatewayRateLimitError;
        expect(rateLimitError.message).toBe('Rate limit exceeded');
        expect(rateLimitError.statusCode).toBe(429);
        expect(rateLimitError.type).toBe('rate_limit_exceeded');
      }
    });

    it('should handle authentication errors in streaming', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 401,
        body: JSON.stringify({
          error: {
            message: 'Authentication failed for streaming',
            type: 'authentication_error',
          },
        }),
      };

      const model = createTestModel();

      try {
        await model.doStream({ prompt: TEST_PROMPT, includeRawChunks: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
        const authError = error as GatewayAuthenticationError;
        expect(authError.message).toContain('Invalid API key');
        expect(authError.message).toContain('vercel.com/d?to=');
        expect(authError.statusCode).toBe(401);
        expect(authError.type).toBe('authentication_error');
      }
    });

    it('should handle invalid request errors in streaming', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid streaming request',
            type: 'invalid_request_error',
          },
        }),
      };

      const model = createTestModel();

      try {
        await model.doStream({ prompt: TEST_PROMPT, includeRawChunks: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayInvalidRequestError.isInstance(error)).toBe(true);
        const invalidError = error as GatewayInvalidRequestError;
        expect(invalidError.message).toBe('Invalid streaming request');
        expect(invalidError.statusCode).toBe(400);
        expect(invalidError.type).toBe('invalid_request_error');
      }
    });

    it('should handle malformed error responses in streaming', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'error',
        status: 500,
        body: 'Invalid JSON for streaming',
      };

      const model = createTestModel();

      try {
        await model.doStream({ prompt: TEST_PROMPT, includeRawChunks: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(GatewayResponseError.isInstance(error)).toBe(true);
        const responseError = error as GatewayResponseError;
        expect(responseError.statusCode).toBe(500);
        expect(responseError.type).toBe('response_error');
      }
    });

    describe('Image part encoding', () => {
      it('should not modify prompt without image parts', async () => {
        prepareStreamResponse({ content: ['response'] });

        await createTestModel().doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.prompt).toEqual(TEST_PROMPT);
      });

      it('should encode Uint8Array image part to inline base64 data with default mime type', async () => {
        prepareStreamResponse({ content: ['response'] });
        const imageBytes = new Uint8Array([1, 2, 3, 4]);
        const expectedBase64 = Buffer.from(imageBytes).toString('base64');
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe:' },
              {
                type: 'file',
                data: { type: 'data' as const, data: imageBytes },
                mediaType: 'image/jpeg',
              },
            ],
          },
        ];

        await createTestModel().doStream({
          prompt: imagePrompt,
          includeRawChunks: false,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const imagePart = requestBody.prompt[0]
          .content[1] as LanguageModelV4FilePart;

        expect(imagePart.type).toBe('file');
        expect(imagePart.data).toEqual({
          type: 'data',
          data: expectedBase64,
        });
        expect(imagePart.mediaType).toBe('image/jpeg');
      });

      it('should encode Uint8Array image part to inline base64 data with specified mime type', async () => {
        prepareStreamResponse({ content: ['response'] });
        const imageBytes = new Uint8Array([5, 6, 7, 8]);
        const expectedBase64 = Buffer.from(imageBytes).toString('base64');
        const mimeType = 'image/png';
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe:' },
              {
                type: 'file',
                data: { type: 'data' as const, data: imageBytes },
                mediaType: mimeType,
              },
            ],
          },
        ];

        await createTestModel().doStream({
          prompt: imagePrompt,
          includeRawChunks: false,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const imagePart = requestBody.prompt[0]
          .content[1] as LanguageModelV4FilePart;

        expect(imagePart.type).toBe('file');
        expect(imagePart.data).toEqual({
          type: 'data',
          data: expectedBase64,
        });
        expect(imagePart.mediaType).toBe(mimeType);
      });

      it('should not modify image part with URL', async () => {
        prepareStreamResponse({ content: ['response'] });
        const imageUrl = new URL('https://example.com/image.jpg');
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'URL:' },
              {
                type: 'file',
                data: { type: 'url' as const, url: imageUrl },
                mediaType: 'image/jpeg',
              },
            ],
          },
        ];

        await createTestModel().doStream({
          prompt: imagePrompt,
          includeRawChunks: false,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const imagePart = requestBody.prompt[0]
          .content[1] as LanguageModelV4FilePart;

        expect(imagePart.type).toBe('file');
        expect(imagePart.data).toEqual({
          type: 'url',
          url: imageUrl.toString(),
        });
        expect(imagePart.mediaType).toBe('image/jpeg');
      });

      it('should handle mixed content types correctly for streaming', async () => {
        prepareStreamResponse({ content: ['response'] });
        const imageBytes = new Uint8Array([1, 2, 3, 4]);
        const expectedBase64 = Buffer.from(imageBytes).toString('base64');
        const imageUrl = new URL('https://example.com/image2.png');
        const imagePrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'First text.' },
              {
                type: 'file',
                data: { type: 'data' as const, data: imageBytes },
                mediaType: 'image/gif',
              },
              { type: 'text', text: 'Second text.' },
              {
                type: 'file',
                data: { type: 'url' as const, url: imageUrl },
                mediaType: 'image/png',
              },
            ],
          },
        ];

        await createTestModel().doStream({
          prompt: imagePrompt,
          includeRawChunks: false,
        });

        const requestBody = await server.calls[0].requestBodyJson;
        const content = requestBody.prompt[0].content;

        expect(content[0]).toEqual({ type: 'text', text: 'First text.' });
        expect(content[1]).toEqual({
          type: 'file',
          data: { type: 'data', data: expectedBase64 },
          mediaType: 'image/gif',
        });
        expect(content[2]).toEqual({ type: 'text', text: 'Second text.' });
        expect(content[3]).toEqual({
          type: 'file',
          data: { type: 'url', url: imageUrl.toString() },
          mediaType: 'image/png',
        });
      });
    });

    describe('Error handling', () => {
      it('should not double-wrap existing Gateway errors', async () => {
        // Mock fetch to throw a Gateway error directly
        const existingGatewayError = new GatewayAuthenticationError({
          message: 'Already a Gateway error',
          statusCode: 401,
        });

        const mockFetch = vi.fn().mockRejectedValue(existingGatewayError);
        const model = createTestModel({ fetch: mockFetch });

        try {
          await model.doGenerate({ prompt: TEST_PROMPT });
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          // Should be the same instance, not wrapped
          expect(error).toBe(existingGatewayError);
          expect((error as GatewayAuthenticationError).message).toBe(
            'Already a Gateway error',
          );
        }
      });

      it('should handle network errors gracefully', async () => {
        // Mock fetch to throw a network error
        const networkError = new Error('Network connection failed');
        const mockFetch = vi.fn().mockRejectedValue(networkError);
        const model = createTestModel({ fetch: mockFetch });

        try {
          await model.doGenerate({ prompt: TEST_PROMPT });
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          expect(GatewayResponseError.isInstance(error)).toBe(true);
          const responseError = error as GatewayResponseError;
          expect(responseError.message).toBe(
            'Invalid error response format: Gateway request failed: Network connection failed',
          );
          expect(responseError.cause).toBe(networkError);
        }
      });

      it('should handle network errors gracefully in streaming', async () => {
        // Mock fetch to throw a network error during streaming
        const networkError = new Error('Network connection failed');
        const mockFetch = vi.fn().mockRejectedValue(networkError);
        const model = createTestModel({ fetch: mockFetch });

        try {
          await model.doStream({
            prompt: TEST_PROMPT,
            includeRawChunks: false,
          });
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          expect(GatewayResponseError.isInstance(error)).toBe(true);
          const responseError = error as GatewayResponseError;
          expect(responseError.message).toBe(
            'Invalid error response format: Gateway request failed: Network connection failed',
          );
          expect(responseError.cause).toBe(networkError);
        }
      });

      it('should preserve error cause chain', async () => {
        server.urls['https://api.test.com/language-model'].response = {
          type: 'error',
          status: 401,
          body: JSON.stringify({
            error: {
              message: 'Token expired',
              type: 'authentication_error',
            },
          }),
        };

        const model = createTestModel();

        try {
          await model.doGenerate({ prompt: TEST_PROMPT });
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
          const authError = error as GatewayAuthenticationError;
          expect(authError.cause).toBeDefined();
        }
      });
    });
  });

  describe('raw chunks filtering', () => {
    it('should filter raw chunks based on includeRawChunks option', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"type":"stream-start","warnings":[]}\n\n`,
          `data: {"type":"raw","rawValue":{"id":"test-chunk","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"}}]}}\n\n`,
          `data: {"type":"text-delta","textDelta":"Hello"}\n\n`,
          `data: {"type":"raw","rawValue":{"id":"test-chunk-2","object":"chat.completion.chunk","choices":[{"delta":{"content":" world"}}]}}\n\n`,
          `data: {"type":"text-delta","textDelta":" world"}\n\n`,
          `data: {"type":"finish","finishReason":"stop","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n`,
        ],
      };

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false, // Raw chunks should be filtered out
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "textDelta": "Hello",
            "type": "text-delta",
          },
          {
            "textDelta": " world",
            "type": "text-delta",
          },
          {
            "finishReason": "stop",
            "type": "finish",
            "usage": {
              "completion_tokens": 5,
              "prompt_tokens": 10,
            },
          },
        ]
      `);
    });

    it('should include raw chunks when includeRawChunks is true', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"type":"stream-start","warnings":[]}\n\n`,
          `data: {"type":"raw","rawValue":{"id":"test-chunk","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"}}]}}\n\n`,
          `data: {"type":"text-delta","textDelta":"Hello"}\n\n`,
          `data: {"type":"finish","finishReason":"stop","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n`,
        ],
      };

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: true, // Raw chunks should be included
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "rawValue": {
              "choices": [
                {
                  "delta": {
                    "content": "Hello",
                  },
                },
              ],
              "id": "test-chunk",
              "object": "chat.completion.chunk",
            },
            "type": "raw",
          },
          {
            "textDelta": "Hello",
            "type": "text-delta",
          },
          {
            "finishReason": "stop",
            "type": "finish",
            "usage": {
              "completion_tokens": 5,
              "prompt_tokens": 10,
            },
          },
        ]
      `);
    });
  });

  describe('timestamp conversion', () => {
    it('should convert timestamp strings to Date objects in response-metadata chunks', async () => {
      const timestampString = '2023-12-07T10:30:00.000Z';

      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"type":"stream-start","warnings":[]}\n\n`,
          `data: {"type":"response-metadata","id":"test-id","modelId":"test-model","timestamp":"${timestampString}"}\n\n`,
          `data: {"type":"text-delta","textDelta":"Hello"}\n\n`,
          `data: {"type":"finish","finishReason":"stop","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n`,
        ],
      };

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual({
        type: 'stream-start',
        warnings: [],
      });

      // Check that the response-metadata chunk has timestamp converted to Date
      const responseMetadataChunk = chunks[1] as any;
      expect(responseMetadataChunk).toMatchObject({
        type: 'response-metadata',
        id: 'test-id',
        modelId: 'test-model',
      });
      expect(responseMetadataChunk.timestamp).toBeInstanceOf(Date);
      expect(responseMetadataChunk.timestamp.toISOString()).toBe(
        timestampString,
      );
    });

    it('should not modify timestamp if it is already a Date object', async () => {
      const timestampDate = new Date('2023-12-07T10:30:00.000Z');

      // Use standard stream-chunks format with Date serialized as string, then manually parse
      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"type":"stream-start","warnings":[]}\n\n`,
          `data: {"type":"response-metadata","id":"test-id","modelId":"test-model","timestamp":"${timestampDate.toISOString()}"}\n\n`,
          `data: {"type":"text-delta","textDelta":"Hello"}\n\n`,
          `data: {"type":"finish","finishReason":"stop","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n`,
        ],
      };

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toHaveLength(4);

      // Check that the response-metadata chunk timestamp is converted to Date
      const responseMetadataChunk = chunks[1] as any;
      expect(responseMetadataChunk).toMatchObject({
        type: 'response-metadata',
        id: 'test-id',
        modelId: 'test-model',
      });
      expect(responseMetadataChunk.timestamp).toBeInstanceOf(Date);
    });

    it('should not modify response-metadata chunks without timestamp', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"type":"stream-start","warnings":[]}\n\n`,
          `data: {"type":"response-metadata","id":"test-id","modelId":"test-model"}\n\n`,
          `data: {"type":"text-delta","textDelta":"Hello"}\n\n`,
          `data: {"type":"finish","finishReason":"stop","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n`,
        ],
      };

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toHaveLength(4);

      // Check that the response-metadata chunk without timestamp is unchanged
      const responseMetadataChunk = chunks[1] as any;
      expect(responseMetadataChunk).toEqual({
        type: 'response-metadata',
        id: 'test-id',
        modelId: 'test-model',
      });
      expect(responseMetadataChunk.timestamp).toBeUndefined();
    });

    it('should handle null timestamp values gracefully', async () => {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"type":"stream-start","warnings":[]}\n\n`,
          `data: {"type":"response-metadata","id":"test-id","modelId":"test-model","timestamp":null}\n\n`,
          `data: {"type":"text-delta","textDelta":"Hello"}\n\n`,
          `data: {"type":"finish","finishReason":"stop","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n`,
        ],
      };

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toHaveLength(4);

      // Check that null timestamp is left as null
      const responseMetadataChunk = chunks[1] as any;
      expect(responseMetadataChunk).toEqual({
        type: 'response-metadata',
        id: 'test-id',
        modelId: 'test-model',
        timestamp: null,
      });
    });

    it('should only convert timestamps for response-metadata chunks, not other chunk types', async () => {
      const timestampString = '2023-12-07T10:30:00.000Z';

      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"type":"stream-start","warnings":[]}\n\n`,
          `data: {"type":"text-delta","textDelta":"Hello","timestamp":"${timestampString}"}\n\n`,
          `data: {"type":"finish","finishReason":"stop","usage":{"prompt_tokens":10,"completion_tokens":5},"timestamp":"${timestampString}"}\n\n`,
        ],
      };

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      // Check that timestamps in non-response-metadata chunks are left as strings
      // Note: These chunks don't typically have timestamp properties in the real types,
      // but this test verifies our conversion logic only affects response-metadata chunks
      expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "textDelta": "Hello",
            "timestamp": "2023-12-07T10:30:00.000Z",
            "type": "text-delta",
          },
          {
            "finishReason": "stop",
            "timestamp": "2023-12-07T10:30:00.000Z",
            "type": "finish",
            "usage": {
              "completion_tokens": 5,
              "prompt_tokens": 10,
            },
          },
        ]
      `);
    });
  });

  describe('Provider Options', () => {
    function prepareJsonResponse({
      content = { type: 'text', text: '' },
      usage = {
        prompt_tokens: 4,
        completion_tokens: 30,
      },
      finish_reason = 'stop',
      id = 'test-id',
      created = 1711115037,
      model = 'test-model',
    } = {}) {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'json-value',
        body: {
          id,
          created,
          model,
          content,
          finish_reason,
          usage,
        },
      };
    }

    function prepareStreamResponse({
      content,
      finish_reason = 'stop',
    }: {
      content: string[];
      finish_reason?: string;
    }) {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'stream-chunks',
        chunks: [
          ...content.map(
            text =>
              `data: ${JSON.stringify({
                type: 'text-delta',
                textDelta: text,
              })}\n\n`,
          ),
          `data: ${JSON.stringify({
            type: 'finish',
            finishReason: finish_reason,
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
            },
          })}\n\n`,
        ],
      };
    }

    it('should pass provider routing order for doGenerate', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            order: ['bedrock', 'anthropic'],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { order: ['bedrock', 'anthropic'] },
      });
    });

    it('should pass single provider in order array', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            order: ['openai'],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { order: ['openai'] },
      });
    });

    it('should work without provider options', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      const result = await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toBeUndefined();
      expect(result.content).toEqual({
        type: 'text',
        text: 'Test response',
      });
    });

    it('should pass provider routing order for doStream', async () => {
      prepareStreamResponse({
        content: ['Hello', ' world'],
      });

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            order: ['groq', 'openai'],
          },
        },
      });

      await convertReadableStreamToArray(stream);

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { order: ['groq', 'openai'] },
      });
    });

    it('should validate provider options against schema', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            order: ['anthropic', 'bedrock', 'openai'],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { order: ['anthropic', 'bedrock', 'openai'] },
      });
    });

    it('should pass providerTimeouts for doGenerate', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            providerTimeouts: {
              byok: { openai: 5000, anthropic: 2000 },
            },
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: {
          providerTimeouts: {
            byok: { openai: 5000, anthropic: 2000 },
          },
        },
      });
    });

    it('should pass providerTimeouts for doStream', async () => {
      prepareStreamResponse({
        content: ['Hello', ' world'],
      });

      const { stream } = await createTestModel().doStream({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            providerTimeouts: {
              byok: { anthropic: 3000 },
            },
          },
        },
      });

      await convertReadableStreamToArray(stream);

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: {
          providerTimeouts: {
            byok: { anthropic: 3000 },
          },
        },
      });
    });

    it('should pass zeroDataRetention option', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            zeroDataRetention: true,
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { zeroDataRetention: true },
      });
    });

    it('should pass disallowPromptTraining option', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            disallowPromptTraining: true,
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { disallowPromptTraining: true },
      });
    });

    it('should pass hipaaCompliant option', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            hipaaCompliant: true,
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { hipaaCompliant: true },
      });
    });

    it('should pass both zeroDataRetention and hipaaCompliant options', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            zeroDataRetention: true,
            hipaaCompliant: true,
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { zeroDataRetention: true, hipaaCompliant: true },
      });
    });

    it('should pass quotaEntityId option', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            quotaEntityId: 'entity-123',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { quotaEntityId: 'entity-123' },
      });
    });

    it('should pass quotaEntityId with other options', async () => {
      prepareJsonResponse({
        content: { type: 'text', text: 'Test response' },
      });

      await createTestModel().doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          gateway: {
            quotaEntityId: 'entity-123',
            user: 'user-456',
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.providerOptions).toEqual({
        gateway: { quotaEntityId: 'entity-123', user: 'user-456' },
      });
    });
  });

  describe('file data encoding', () => {
    function prepareResponse() {
      server.urls['https://api.test.com/language-model'].response = {
        type: 'json-value',
        body: {
          id: 'test-id',
          created: 1711115037,
          model: 'test-model',
          content: { type: 'text', text: '' },
          finish_reason: 'stop',
          usage: { prompt_tokens: 4, completion_tokens: 30 },
        },
      };
    }

    it('should base64-encode Uint8Array data in a reasoning-file part', async () => {
      prepareResponse();
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const expectedBase64 = Buffer.from(bytes).toString('base64');
      const prompt: LanguageModelV4Prompt = [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning-file',
              data: { type: 'data', data: bytes },
              mediaType: 'image/png',
            },
          ],
        },
      ];

      await createTestModel().doGenerate({ prompt });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.prompt[0].content[0].data).toEqual({
        type: 'data',
        data: expectedBase64,
      });
    });

    it('should base64-encode Uint8Array data in tool-result file content', async () => {
      prepareResponse();
      const bytes = new Uint8Array([5, 6, 7, 8]);
      const expectedBase64 = Buffer.from(bytes).toString('base64');
      const prompt: LanguageModelV4Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'render',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'file',
                    data: { type: 'data', data: bytes },
                    mediaType: 'image/png',
                  },
                ],
              },
            },
          ],
        },
      ];

      await createTestModel().doGenerate({ prompt });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.prompt[0].content[0].output.value[0].data).toEqual({
        type: 'data',
        data: expectedBase64,
      });
    });

    it('should not modify reasoning-file data that is a URL', async () => {
      prepareResponse();
      const prompt: LanguageModelV4Prompt = [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning-file',
              data: { type: 'url', url: new URL('https://example.com/a.png') },
              mediaType: 'image/png',
            },
          ],
        },
      ];

      await createTestModel().doGenerate({ prompt });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.prompt[0].content[0].data).toEqual({
        type: 'url',
        url: 'https://example.com/a.png',
      });
    });
  });
});
