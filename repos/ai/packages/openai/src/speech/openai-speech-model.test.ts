import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createOpenAI } from '../openai-provider';
import { OpenAISpeechModel } from './openai-speech-model';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createOpenAI({ apiKey: 'test-api-key' });
const model = provider.speech('tts-1');

const server = createTestServer({
  'https://api.openai.com/v1/audio/speech': {},
});

describe('doGenerate', () => {
  function prepareAudioResponse({
    headers,
    format = 'mp3',
  }: {
    headers?: Record<string, string>;
    format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  } = {}) {
    const audioBuffer = new Uint8Array(100); // Mock audio data
    server.urls['https://api.openai.com/v1/audio/speech'].response = {
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
      model: 'tts-1',
      input: 'Hello from the AI SDK!',
    });
  });

  it('should pass headers', async () => {
    prepareAudioResponse();

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.speech('tts-1').doGenerate({
      text: 'Hello from the AI SDK!',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
      'openai-organization': 'test-organization',
      'openai-project': 'test-project',
    });

    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/openai/0.0.0-test`,
    );
  });

  it('should pass options', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
      voice: 'nova',
      outputFormat: 'opus',
      speed: 1.5,
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: 'tts-1',
      input: 'Hello from the AI SDK!',
      voice: 'nova',
      speed: 1.5,
      response_format: 'opus',
    });
  });

  it('should return audio data with correct content type', async () => {
    const audio = new Uint8Array(100); // Mock audio data
    prepareAudioResponse({
      format: 'opus',
      headers: {
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      outputFormat: 'opus',
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
    const customModel = new OpenAISpeechModel('tts-1', {
      provider: 'test-provider',
      url: () => 'https://api.openai.com/v1/audio/speech',
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
      modelId: 'tts-1',
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
    const customModel = new OpenAISpeechModel('tts-1', {
      provider: 'test-provider',
      url: () => 'https://api.openai.com/v1/audio/speech',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response.timestamp.getTime()).toEqual(testDate.getTime());
    expect(result.response.modelId).toBe('tts-1');
  });

  it('should handle different audio formats', async () => {
    const formats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const;

    for (const format of formats) {
      const audio = prepareAudioResponse({ format });

      const result = await model.doGenerate({
        text: 'Hello from the AI SDK!',
        providerOptions: {
          openai: {
            response_format: format,
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
