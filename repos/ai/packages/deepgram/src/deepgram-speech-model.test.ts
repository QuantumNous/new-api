import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createDeepgram } from './deepgram-provider';
import { DeepgramSpeechModel } from './deepgram-speech-model';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createDeepgram({ apiKey: 'test-api-key' });
const model = provider.speech('aura-2-helena-en');

const server = createTestServer({
  'https://api.deepgram.com/v1/speak': {},
});

describe('doGenerate', () => {
  function prepareAudioResponse({
    headers,
  }: {
    headers?: Record<string, string>;
  } = {}) {
    const audioBuffer = new Uint8Array(100); // Mock audio data
    server.urls['https://api.deepgram.com/v1/speak'].response = {
      type: 'binary',
      headers: {
        'content-type': 'audio/mp3',
        ...headers,
      },
      body: Buffer.from(audioBuffer),
    };
    return audioBuffer;
  }

  it('should pass the model and text', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      text: 'Hello, welcome to Deepgram!',
    });

    const url = new URL(server.calls[0].requestUrl);
    expect(url.searchParams.get('model')).toBe('aura-2-helena-en');
  });

  it('should pass headers', async () => {
    prepareAudioResponse();

    const provider = createDeepgram({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.speech('aura-2-helena-en').doGenerate({
      text: 'Hello, welcome to Deepgram!',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Token test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });

    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/deepgram/0.0.0-test`,
    );
  });

  it('should pass query parameters for model', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
    });

    const url = new URL(server.calls[0].requestUrl);
    expect(url.searchParams.get('model')).toBe('aura-2-helena-en');
  });

  it('should map outputFormat to encoding/container', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      outputFormat: 'wav',
    });

    const url = new URL(server.calls[0].requestUrl);
    expect(url.searchParams.get('container')).toBe('wav');
    expect(url.searchParams.get('encoding')).toBe('linear16');
  });

  it('should pass provider options', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      providerOptions: {
        deepgram: {
          encoding: 'mp3',
          bitRate: 48000,
          container: 'wav',
          callback: 'https://example.com/callback',
          callbackMethod: 'POST',
          mipOptOut: true,
          tag: 'test-tag',
        },
      },
    });

    const url = new URL(server.calls[0].requestUrl);
    expect(url.searchParams.get('encoding')).toBe('mp3');
    expect(url.searchParams.get('bit_rate')).toBe('48000');
    // mp3 doesn't support container, so it should be removed
    expect(url.searchParams.get('container')).toBeNull();
    expect(url.searchParams.get('callback')).toBe(
      'https://example.com/callback',
    );
    expect(url.searchParams.get('callback_method')).toBe('POST');
    expect(url.searchParams.get('mip_opt_out')).toBe('true');
    expect(url.searchParams.get('tag')).toBe('test-tag');
  });

  it('should handle array tag', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      providerOptions: {
        deepgram: {
          tag: ['tag1', 'tag2'],
        },
      },
    });

    const url = new URL(server.calls[0].requestUrl);
    expect(url.searchParams.get('tag')).toBe('tag1,tag2');
  });

  it('should return audio data', async () => {
    const audio = new Uint8Array(100); // Mock audio data
    prepareAudioResponse({
      headers: {
        'x-request-id': 'test-request-id',
      },
    });

    const result = await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
    });

    expect(result.audio).toStrictEqual(audio);
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareAudioResponse({
      headers: {
        'x-request-id': 'test-request-id',
      },
    });

    const testDate = new Date(0);
    const customModel = new DeepgramSpeechModel('aura-2-helena-en', {
      provider: 'test-provider',
      url: () => 'https://api.deepgram.com/v1/speak',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      text: 'Hello, welcome to Deepgram!',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: 'aura-2-helena-en',
      headers: {
        'content-type': 'audio/mp3',
        'x-request-id': 'test-request-id',
      },
    });
  });

  it('should warn about unsupported voice parameter', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      voice: 'different-voice',
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "Deepgram TTS models embed the voice in the model ID. The voice parameter "different-voice" was ignored. Use the model ID to select a voice (e.g., "aura-2-helena-en").",
          "feature": "voice",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should warn about unsupported speed parameter', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      speed: 1.5,
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "Deepgram TTS REST API does not support speed adjustment. Speed parameter was ignored.",
          "feature": "speed",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should warn about unsupported language parameter', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      language: 'en',
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "Deepgram TTS models are language-specific via the model ID. Language parameter "en" was ignored. Select a model with the appropriate language suffix (e.g., "-en" for English).",
          "feature": "language",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should warn about unsupported instructions parameter', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      instructions: 'Speak slowly',
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "Deepgram TTS REST API does not support instructions. Instructions parameter was ignored.",
          "feature": "instructions",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should include request body in response', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
    });

    expect(result.request?.body).toBe(
      JSON.stringify({ text: 'Hello, welcome to Deepgram!' }),
    );
  });

  it('should clean up incompatible parameters when encoding changes via providerOptions', async () => {
    prepareAudioResponse();

    // Test case 1: outputFormat sets sample_rate, encoding changed to mp3 (fixed sample rate)
    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      outputFormat: 'linear16_16000', // Sets: encoding=linear16, sample_rate=16000
      providerOptions: {
        deepgram: {
          encoding: 'mp3', // Changes encoding to mp3
        },
      },
    });

    const url1 = new URL(server.calls[0].requestUrl);
    expect(url1.searchParams.get('encoding')).toBe('mp3');
    expect(url1.searchParams.get('sample_rate')).toBeNull(); // Should be removed

    // Test case 2: outputFormat sets container for linear16, encoding changed to opus
    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      outputFormat: 'linear16_16000', // Sets: encoding=linear16, container=wav
      providerOptions: {
        deepgram: {
          encoding: 'opus', // Changes encoding to opus
        },
      },
    });

    const url2 = new URL(server.calls[1].requestUrl);
    expect(url2.searchParams.get('encoding')).toBe('opus');
    expect(url2.searchParams.get('container')).toBe('ogg'); // Should be ogg, not wav
    expect(url2.searchParams.get('sample_rate')).toBeNull(); // Should be removed

    // Test case 3: outputFormat sets bit_rate, encoding changed to linear16 (no bitrate support)
    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      outputFormat: 'mp3', // Sets: encoding=mp3
      providerOptions: {
        deepgram: {
          encoding: 'linear16', // Changes encoding to linear16
          bitRate: 48000, // Try to set bitrate
        },
      },
    });

    const url3 = new URL(server.calls[2].requestUrl);
    expect(url3.searchParams.get('encoding')).toBe('linear16');
    expect(url3.searchParams.get('bit_rate')).toBeNull(); // Should be removed
  });

  it('should clean up incompatible parameters when container changes encoding implicitly', async () => {
    prepareAudioResponse();

    // Test case: outputFormat sets sample_rate, container changes encoding to opus
    await model.doGenerate({
      text: 'Hello, welcome to Deepgram!',
      outputFormat: 'linear16_16000', // Sets: encoding=linear16, sample_rate=16000
      providerOptions: {
        deepgram: {
          container: 'ogg', // Changes encoding to opus implicitly
        },
      },
    });

    const callIndex = server.calls.length - 1;
    const url = new URL(server.calls[callIndex].requestUrl);
    expect(url.searchParams.get('encoding')).toBe('opus');
    expect(url.searchParams.get('container')).toBe('ogg');
    expect(url.searchParams.get('sample_rate')).toBeNull(); // Should be removed (opus has fixed sample rate)
  });
});
