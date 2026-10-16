import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createFal } from './fal-provider';
import { FalSpeechModel } from './fal-speech-model';
import { describe, it, expect } from 'vitest';

const provider = createFal({ apiKey: 'test-api-key' });
const model = provider.speech('fal-ai/minimax/speech-02-hd');

const server = createTestServer({
  'https://fal.run/fal-ai/minimax/speech-02-hd': {},
  'https://fal.media/files/test.mp3': {},
});

describe('FalSpeechModel.doGenerate', () => {
  function prepareResponses({
    jsonHeaders,
    audioHeaders,
  }: {
    jsonHeaders?: Record<string, string>;
    audioHeaders?: Record<string, string>;
  } = {}) {
    const audioBuffer = new Uint8Array(100);
    server.urls['https://fal.run/fal-ai/minimax/speech-02-hd'].response = {
      type: 'json-value',
      headers: {
        'content-type': 'application/json',
        ...jsonHeaders,
      },
      body: {
        audio: { url: 'https://fal.media/files/test.mp3' },
        duration_ms: 1234,
      },
    };
    server.urls['https://fal.media/files/test.mp3'].response = {
      type: 'binary',
      headers: {
        'content-type': 'audio/mp3',
        ...audioHeaders,
      },
      body: Buffer.from(audioBuffer),
    };
    return audioBuffer;
  }

  it('should pass text and default output_format', async () => {
    prepareResponses();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      text: 'Hello from the AI SDK!',
      output_format: 'url',
    });
  });

  it('should pass headers', async () => {
    prepareResponses();

    const provider = createFal({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.speech('fal-ai/minimax/speech-02-hd').doGenerate({
      text: 'Hello from the AI SDK!',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Key test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
  });

  it('should return audio data', async () => {
    const audio = prepareResponses();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.audio).toStrictEqual(audio);
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareResponses({ jsonHeaders: { 'x-request-id': 'test-request-id' } });

    const testDate = new Date(0);
    const customModel = new FalSpeechModel('fal-ai/minimax/speech-02-hd', {
      provider: 'fal.speech',
      url: ({ path }) => path,
      headers: () => ({}),
      _internal: { currentDate: () => testDate },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: 'fal-ai/minimax/speech-02-hd',
      headers: expect.objectContaining({ 'x-request-id': 'test-request-id' }),
    });
  });

  it('should include warnings for unsupported settings', async () => {
    prepareResponses();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      language: 'en',
      // invalid outputFormat triggers a warning and defaults to url
      // (we still return audio via URL)
      outputFormat: 'wav',
    });

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
