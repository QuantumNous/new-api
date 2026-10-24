import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import {
  GatewayInternalServerError,
  GatewayInvalidRequestError,
} from './errors';
import type { GatewayConfig } from './gateway-config';
import { GatewaySpeechModel } from './gateway-speech-model';

const server = createTestServer({
  'https://api.test.com/speech-model': {},
});

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) =>
  new GatewaySpeechModel('openai/tts-1', {
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

describe('GatewaySpeechModel', () => {
  function prepareJsonResponse({
    audio = 'base64-audio',
    headers,
  }: {
    audio?: string;
    headers?: Record<string, string>;
  } = {}) {
    server.urls['https://api.test.com/speech-model'].response = {
      type: 'json-value',
      headers,
      body: { audio },
    };
  }

  describe('doGenerate', () => {
    it('should pass headers correctly', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        text: 'Hello world',
        headers: { 'Custom-Header': 'test-value' },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        authorization: 'Bearer test-token',
        'custom-header': 'test-value',
        'ai-speech-model-specification-version': '4',
        'ai-model-id': 'openai/tts-1',
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
        text: 'Hello world',
      });

      expect(server.calls[0].requestHeaders).toMatchObject(o11yHeaders);
    });

    it('should send speech options in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        text: 'Hello world',
        voice: 'alloy',
        outputFormat: 'mp3',
        instructions: 'Speak clearly',
        speed: 1.25,
        language: 'en',
        providerOptions: { openai: { style: 'friendly' } },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        text: 'Hello world',
        voice: 'alloy',
        outputFormat: 'mp3',
        instructions: 'Speak clearly',
        speed: 1.25,
        language: 'en',
        providerOptions: { openai: { style: 'friendly' } },
      });
    });

    it('should omit optional speech options when not provided', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({ text: 'Hello world' });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        text: 'Hello world',
      });
    });

    it('should extract audio and metadata from response', async () => {
      server.urls['https://api.test.com/speech-model'].response = {
        type: 'json-value',
        headers: { 'x-request-id': 'req-123' },
        body: {
          audio: 'base64-audio',
          warnings: [{ type: 'other', message: 'test warning' }],
          providerMetadata: { gateway: { cost: '0.002' } },
        },
      };

      const result = await createTestModel().doGenerate({
        text: 'Hello world',
      });

      expect(result.audio).toBe('base64-audio');
      expect(result.warnings).toStrictEqual([
        { type: 'other', message: 'test warning' },
      ]);
      expect(result.providerMetadata).toStrictEqual({
        gateway: { cost: '0.002' },
      });
      expect(result.response.headers?.['x-request-id']).toBe('req-123');
      expect(result.response.modelId).toBe('openai/tts-1');
    });
  });

  describe('error handling', () => {
    it('should throw GatewayInvalidRequestError on 400', async () => {
      server.urls['https://api.test.com/speech-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid text format',
            type: 'invalid_request_error',
          },
        }),
      };

      await expect(
        createTestModel().doGenerate({ text: 'Hello world' }),
      ).rejects.toSatisfy(
        err =>
          GatewayInvalidRequestError.isInstance(err) && err.statusCode === 400,
      );
    });

    it('should throw GatewayInternalServerError on 500', async () => {
      server.urls['https://api.test.com/speech-model'].response = {
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
        createTestModel().doGenerate({ text: 'Hello world' }),
      ).rejects.toSatisfy(
        err =>
          GatewayInternalServerError.isInstance(err) && err.statusCode === 500,
      );
    });
  });

  describe('URL construction', () => {
    it('should post to /speech-model endpoint', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({ text: 'Hello world' });

      expect(server.calls[0].requestUrl).toBe(
        'https://api.test.com/speech-model',
      );
    });
  });
});
