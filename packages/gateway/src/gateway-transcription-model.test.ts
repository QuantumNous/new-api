import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import {
  GatewayInternalServerError,
  GatewayInvalidRequestError,
} from './errors';
import type { GatewayConfig } from './gateway-config';
import { GatewayTranscriptionModel } from './gateway-transcription-model';

const server = createTestServer({
  'https://api.test.com/transcription-model': {},
});

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) =>
  new GatewayTranscriptionModel('openai/gpt-4o-transcribe', {
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

describe('GatewayTranscriptionModel', () => {
  function prepareJsonResponse({
    text = 'Hello world',
    headers,
  }: {
    text?: string;
    headers?: Record<string, string>;
  } = {}) {
    server.urls['https://api.test.com/transcription-model'].response = {
      type: 'json-value',
      headers,
      body: { text },
    };
  }

  describe('doGenerate', () => {
    it('should pass headers correctly', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
        headers: { 'Custom-Header': 'test-value' },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        authorization: 'Bearer test-token',
        'custom-header': 'test-value',
        'ai-transcription-model-specification-version': '4',
        'ai-model-id': 'openai/gpt-4o-transcribe',
      });
    });

    it('should include o11y headers', async () => {
      prepareJsonResponse();

      const o11yHeaders = {
        'ai-o11y-deployment-id': 'deployment-1',
        'ai-o11y-environment': 'production',
        'ai-o11y-region': 'iad1',
      } as const;

      await createTestModel({ o11yHeaders }).doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(server.calls[0].requestHeaders).toMatchObject(o11yHeaders);
    });

    it('should base64 encode byte audio in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
        providerOptions: { openai: { language: 'en' } },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        audio: 'AQID',
        mediaType: 'audio/wav',
        providerOptions: { openai: { language: 'en' } },
      });
    });

    it('should pass string audio through in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/mpeg',
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        audio: 'base64-audio',
        mediaType: 'audio/mpeg',
      });
    });

    it('should extract transcript fields and metadata from response', async () => {
      server.urls['https://api.test.com/transcription-model'].response = {
        type: 'json-value',
        headers: { 'x-request-id': 'req-123' },
        body: {
          text: 'Hello world',
          segments: [
            { text: 'Hello', startSecond: 0, endSecond: 0.5 },
            { text: 'world', startSecond: 0.5, endSecond: 1 },
          ],
          language: 'en',
          durationInSeconds: 1,
          warnings: [{ type: 'other', message: 'test warning' }],
          providerMetadata: { gateway: { cost: '0.002' } },
        },
      };

      const result = await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(result).toMatchObject({
        text: 'Hello world',
        segments: [
          { text: 'Hello', startSecond: 0, endSecond: 0.5 },
          { text: 'world', startSecond: 0.5, endSecond: 1 },
        ],
        language: 'en',
        durationInSeconds: 1,
        warnings: [{ type: 'other', message: 'test warning' }],
        providerMetadata: { gateway: { cost: '0.002' } },
      });
      expect(result.response.headers?.['x-request-id']).toBe('req-123');
      expect(result.response.modelId).toBe('openai/gpt-4o-transcribe');
    });

    it('should default optional transcript fields', async () => {
      prepareJsonResponse();

      const result = await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(result.segments).toStrictEqual([]);
      expect(result.language).toBeUndefined();
      expect(result.durationInSeconds).toBeUndefined();
      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('error handling', () => {
    it('should throw GatewayInvalidRequestError on 400', async () => {
      server.urls['https://api.test.com/transcription-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid audio format',
            type: 'invalid_request_error',
          },
        }),
      };

      await expect(
        createTestModel().doGenerate({
          audio: 'base64-audio',
          mediaType: 'audio/wav',
        }),
      ).rejects.toSatisfy(
        err =>
          GatewayInvalidRequestError.isInstance(err) && err.statusCode === 400,
      );
    });

    it('should throw GatewayInternalServerError on 500', async () => {
      server.urls['https://api.test.com/transcription-model'].response = {
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
        createTestModel().doGenerate({
          audio: 'base64-audio',
          mediaType: 'audio/wav',
        }),
      ).rejects.toSatisfy(
        err =>
          GatewayInternalServerError.isInstance(err) && err.statusCode === 500,
      );
    });
  });

  describe('URL construction', () => {
    it('should post to /transcription-model endpoint', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(server.calls[0].requestUrl).toBe(
        'https://api.test.com/transcription-model',
      );
    });
  });
});
