import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { LMNTSpeechModel } from './lmnt-speech-model';
import { createLMNT } from './lmnt-provider';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createLMNT({ apiKey: 'test-api-key' });
const model = provider.speech('aurora');

const server = createTestServer({
  'https://api.lmnt.com/v1/ai/speech/bytes': {},
});

describe('doGenerate', () => {
  function prepareAudioResponse({
    headers,
    format = 'mp3',
  }: {
    headers?: Record<string, string>;
    format?: 'aac' | 'mp3' | 'mulaw' | 'raw' | 'wav';
  } = {}) {
    const audioBuffer = new Uint8Array(100); // Mock audio data
    server.urls['https://api.lmnt.com/v1/ai/speech/bytes'].response = {
      type: 'binary',
      headers: {
        'content-type': `audio/${format}`,
        ...headers,
      },
      body: Buffer.from(audioBuffer),
    };
    return audioBuffer;
  }

  it('should pass the model and text', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: 'aurora',
      text: 'Hello from the AI SDK!',
    });
  });

  it('should pass headers', async () => {
    prepareAudioResponse();

    const provider = createLMNT({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.speech('aurora').doGenerate({
      text: 'Hello from the AI SDK!',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      'x-api-key': 'test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/lmnt/0.0.0-test`,
    );
  });

  it('should pass options', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
      voice: 'nova',
      outputFormat: 'mp3',
      speed: 1.5,
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: 'aurora',
      text: 'Hello from the AI SDK!',
      voice: 'nova',
      speed: 1.5,
      response_format: 'mp3',
    });
  });

  it('should return audio data with correct content type', async () => {
    const audio = new Uint8Array(100); // Mock audio data
    prepareAudioResponse({
      format: 'mp3',
      headers: {
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      outputFormat: 'mp3',
    });

    expect(result.audio).toStrictEqual(audio);
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareAudioResponse({
      headers: {
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });

    const testDate = new Date(0);
    const customModel = new LMNTSpeechModel('aurora', {
      provider: 'test-provider',
      url: () => 'https://api.lmnt.com/v1/ai/speech/bytes',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: 'aurora',
      headers: {
        'content-type': 'audio/mp3',
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });
  });

  it('should use real date when no custom date provider is specified', async () => {
    prepareAudioResponse();

    const testDate = new Date(0);
    const customModel = new LMNTSpeechModel('aurora', {
      provider: 'test-provider',
      url: () => 'https://api.lmnt.com/v1/ai/speech/bytes',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response.timestamp.getTime()).toEqual(testDate.getTime());
    expect(result.response.modelId).toBe('aurora');
  });

  it('should handle different audio formats', async () => {
    const formats = ['aac', 'mp3', 'mulaw', 'raw', 'wav'] as const;

    for (const format of formats) {
      const audio = prepareAudioResponse({ format });

      const result = await model.doGenerate({
        text: 'Hello from the AI SDK!',
        providerOptions: {
          lmnt: {
            format,
          },
        },
      });

      expect(result.audio).toStrictEqual(audio);
    }
  });

  it('should include warnings if any are generated', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.warnings).toEqual([]);
  });
});
