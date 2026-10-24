import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { HumeSpeechModel } from './hume-speech-model';
import { createHume } from './hume-provider';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createHume({ apiKey: 'test-api-key' });
const model = provider.speech();

const server = createTestServer({
  'https://api.hume.ai/v0/tts/file': {},
});

describe('doGenerate', () => {
  function prepareAudioResponse({
    headers,
    format = 'mp3',
  }: {
    headers?: Record<string, string>;
    format?: 'mp3' | 'pcm' | 'wav';
  } = {}) {
    const audioBuffer = new Uint8Array(100); // Mock audio data
    server.urls['https://api.hume.ai/v0/tts/file'].response = {
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
      utterances: [
        {
          text: 'Hello from the AI SDK!',
          voice: {
            id: 'd8ab67c6-953d-4bd8-9370-8fa53a0f1453',
            provider: 'HUME_AI',
          },
        },
      ],
      format: {
        type: 'mp3',
      },
    });
  });

  it('should pass headers', async () => {
    prepareAudioResponse();

    const provider = createHume({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.speech().doGenerate({
      text: 'Hello from the AI SDK!',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      'x-hume-api-key': 'test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/hume/0.0.0-test`,
    );
  });

  it('should pass options', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
      voice: 'test-voice',
      outputFormat: 'mp3',
      speed: 1.5,
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      utterances: [
        {
          text: 'Hello from the AI SDK!',
          voice: {
            id: 'test-voice',
            provider: 'HUME_AI',
          },
          speed: 1.5,
        },
      ],
      format: {
        type: 'mp3',
      },
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
    const customModel = new HumeSpeechModel('', {
      provider: 'test-provider',
      url: () => 'https://api.hume.ai/v0/tts/file',
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
    const customModel = new HumeSpeechModel('', {
      provider: 'test-provider',
      url: () => 'https://api.hume.ai/v0/tts/file',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response.timestamp.getTime()).toEqual(testDate.getTime());
    expect(result.response.modelId).toBe('');
  });

  it('should handle different audio formats', async () => {
    const formats = ['mp3', 'pcm', 'wav'] as const;

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
