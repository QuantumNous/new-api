import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createGoogle } from './google-provider';
import { GoogleSpeechModel } from './google-speech-model';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createGoogle({ apiKey: 'test-api-key' });
const model = provider.speech('gemini-2.5-flash-preview-tts');

const url =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

// 8 bytes of raw PCM ([1..8]) base64-encoded.
const PCM_BASE64 = 'AQIDBAUGBwg=';
const PCM_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

const server = createTestServer({
  [url]: {},
});

function dataView(audio: Uint8Array): DataView {
  return new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
}

describe('doGenerate', () => {
  function prepareJsonResponse({
    headers,
    mimeType = 'audio/L16;rate=24000',
    data = PCM_BASE64,
    parts,
  }: {
    headers?: Record<string, string>;
    mimeType?: string;
    data?: string;
    parts?: Array<unknown>;
  } = {}) {
    server.urls[url].response = {
      type: 'json-value',
      headers,
      body: {
        candidates: [
          {
            content: {
              parts: parts ?? [{ inlineData: { mimeType, data } }],
            },
          },
        ],
      },
    };
  }

  it('should send the text and the default voice', async () => {
    prepareJsonResponse();

    await model.doGenerate({ text: 'Hello from the AI SDK!' });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      contents: [{ role: 'user', parts: [{ text: 'Hello from the AI SDK!' }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
  });

  it('should use the provided voice', async () => {
    prepareJsonResponse();

    await model.doGenerate({ text: 'Hello from the AI SDK!', voice: 'Puck' });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
      },
    });
  });

  it('should pass headers', async () => {
    prepareJsonResponse();

    const provider = createGoogle({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.speech('gemini-2.5-flash-preview-tts').doGenerate({
      text: 'Hello from the AI SDK!',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      'content-type': 'application/json',
      'x-goog-api-key': 'test-api-key',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      'ai-sdk/google/0.0.0-test',
    );
  });

  it('should wrap PCM audio in a WAV container by default', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({ text: 'Hello from the AI SDK!' });
    const audio = result.audio as Uint8Array;

    // 44-byte WAV header + 8 bytes PCM payload.
    expect(audio.length).toBe(52);
    expect(Array.from(audio.slice(0, 4))).toEqual([0x52, 0x49, 0x46, 0x46]); // "RIFF"
    expect(Array.from(audio.slice(8, 12))).toEqual([0x57, 0x41, 0x56, 0x45]); // "WAVE"

    const view = dataView(audio);
    expect(view.getUint32(24, true)).toBe(24000); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(16); // bits per sample

    // PCM payload is preserved after the header.
    expect(Array.from(audio.slice(44))).toEqual(Array.from(PCM_BYTES));
  });

  it('should derive the WAV sample rate from the response mime type', async () => {
    prepareJsonResponse({ mimeType: 'audio/L16;rate=16000' });

    const result = await model.doGenerate({ text: 'Hello from the AI SDK!' });
    const audio = result.audio as Uint8Array;

    expect(dataView(audio).getUint32(24, true)).toBe(16000);
  });

  it('should return raw PCM and warn for outputFormat "pcm"', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      outputFormat: 'pcm',
    });

    expect(result.audio).toStrictEqual(PCM_BYTES);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ type: 'unsupported', feature: 'outputFormat' }),
    );
  });

  it('should warn for unsupported speed and language options', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      speed: 1.5,
      language: 'en',
    });

    expect(result.warnings).toContainEqual(
      expect.objectContaining({ type: 'unsupported', feature: 'speed' }),
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ type: 'unsupported', feature: 'language' }),
    );
  });

  it('should prepend instructions to the prompt text', async () => {
    prepareJsonResponse();

    await model.doGenerate({
      text: 'Hello there',
      instructions: 'Say cheerfully',
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      contents: [
        { role: 'user', parts: [{ text: 'Say cheerfully: Hello there' }] },
      ],
    });
  });

  it('should map multi-speaker provider options into speechConfig', async () => {
    prepareJsonResponse();

    const multiSpeakerVoiceConfig = {
      speakerVoiceConfigs: [
        {
          speaker: 'Joe',
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        {
          speaker: 'Jane',
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
      ],
    };

    await model.doGenerate({
      text: 'Joe: Hi. Jane: Hello.',
      providerOptions: { google: { multiSpeakerVoiceConfig } },
    });

    // toStrictEqual proves the single-voice `voiceConfig` is absent.
    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      contents: [{ role: 'user', parts: [{ text: 'Joe: Hi. Jane: Hello.' }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { multiSpeakerVoiceConfig },
      },
    });
  });

  it('should read provider options under `googleVertex` for a Vertex provider', async () => {
    prepareJsonResponse();

    // Vertex reuses this model with a `google.vertex.*` provider name, so it
    // reads provider options under `googleVertex` (like the Vertex language
    // model), not `google`.
    const vertexModel = new GoogleSpeechModel('gemini-2.5-flash-preview-tts', {
      provider: 'google.vertex.speech',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: () => ({ 'x-goog-api-key': 'test-api-key' }),
    });

    const multiSpeakerVoiceConfig = {
      speakerVoiceConfigs: [
        {
          speaker: 'Joe',
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        {
          speaker: 'Jane',
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
      ],
    };

    await vertexModel.doGenerate({
      text: 'Joe: Hi. Jane: Hello.',
      providerOptions: { googleVertex: { multiSpeakerVoiceConfig } },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      contents: [{ role: 'user', parts: [{ text: 'Joe: Hi. Jane: Hello.' }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { multiSpeakerVoiceConfig },
      },
    });
  });

  it('should ignore instructions (with a warning) when multi-speaker is set', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      text: 'Joe: Hi. Jane: Hello.',
      instructions: 'Say cheerfully',
      providerOptions: {
        google: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Joe',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              },
              {
                speaker: 'Jane',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
              },
            ],
          },
        },
      },
    });

    // instructions are NOT prepended to the multi-speaker transcript.
    expect(await server.calls[0].requestBodyJson).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'Joe: Hi. Jane: Hello.' }] }],
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ type: 'unsupported', feature: 'instructions' }),
    );
  });

  it('should expose sample rate and mime type in provider metadata', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({ text: 'Hello from the AI SDK!' });

    expect(result.providerMetadata).toStrictEqual({
      google: { sampleRate: 24000, mimeType: 'audio/L16;rate=24000' },
    });
  });

  it('should return empty audio when no inline data is present', async () => {
    prepareJsonResponse({ parts: [{ text: 'no audio here' }] });

    const result = await model.doGenerate({ text: 'Hello from the AI SDK!' });

    expect(result.audio).toStrictEqual(new Uint8Array(0));
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareJsonResponse({ headers: { 'x-request-id': 'test-request-id' } });

    const testDate = new Date(0);
    const customModel = new GoogleSpeechModel('gemini-2.5-flash-preview-tts', {
      provider: 'google.generative-ai.speech',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: () => ({ 'x-goog-api-key': 'test-api-key' }),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: 'gemini-2.5-flash-preview-tts',
      headers: expect.objectContaining({ 'x-request-id': 'test-request-id' }),
    });
  });

  it('should use the real date when no custom date provider is specified', async () => {
    prepareJsonResponse();

    const beforeDate = new Date();
    const result = await model.doGenerate({ text: 'Hello from the AI SDK!' });
    const afterDate = new Date();

    expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(
      beforeDate.getTime(),
    );
    expect(result.response.timestamp.getTime()).toBeLessThanOrEqual(
      afterDate.getTime(),
    );
    expect(result.response.modelId).toBe('gemini-2.5-flash-preview-tts');
  });

  it('should have no warnings on the happy path', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({ text: 'Hello from the AI SDK!' });

    expect(result.warnings).toEqual([]);
  });
});
