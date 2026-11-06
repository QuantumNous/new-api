import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { createMistral } from './mistral-provider';
import { MistralSpeechModel } from './mistral-speech-model';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const modelId = 'voxtral-mini-tts-2603';
const url = 'https://api.mistral.ai/v1/audio/speech';
const provider = createMistral({ apiKey: 'test-api-key' });
const model = provider.speech(modelId);

const server = createTestServer({
  [url]: {},
});

describe('MistralSpeechModel', () => {
  it('should expose correct provider and model information', () => {
    expect(model.provider).toBe('mistral.speech');
    expect(model.modelId).toBe(modelId);
    expect(model.specificationVersion).toBe('v4');
  });

  it('should create speech models through both provider factories', () => {
    expect(provider.speech(modelId)).toBeInstanceOf(MistralSpeechModel);
    expect(provider.speechModel(modelId)).toBeInstanceOf(MistralSpeechModel);
  });
});

describe('doGenerate', () => {
  function prepareJsonResponse({
    audioData = 'SUQzBAAAAAAA',
    headers,
  }: {
    audioData?: string;
    headers?: Record<string, string>;
  } = {}) {
    server.urls[url].response = {
      type: 'json-value',
      headers,
      body: {
        audio_data: audioData,
      },
    };
  }

  it('should send a non-streaming request with default mp3 output', async () => {
    prepareJsonResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: modelId,
      input: 'Hello from the AI SDK!',
      response_format: 'mp3',
      stream: false,
    });
    expect(server.calls[0].requestMethod).toBe('POST');
    expect(server.calls[0].requestUrl).toBe(url);
  });

  it('should map the voice to voice_id', async () => {
    prepareJsonResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
      voice: 'voice-id',
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      voice_id: 'voice-id',
    });
  });

  it('should map refAudio to ref_audio and prefer it over voice', async () => {
    prepareJsonResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
      voice: 'voice-id',
      providerOptions: {
        mistral: {
          refAudio: 'cmVmZXJlbmNlLWF1ZGlv',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: modelId,
      input: 'Hello from the AI SDK!',
      ref_audio: 'cmVmZXJlbmNlLWF1ZGlv',
      response_format: 'mp3',
      stream: false,
    });
  });

  it.each(['pcm', 'wav', 'mp3', 'flac', 'opus'])(
    'should accept the %s output format',
    async outputFormat => {
      prepareJsonResponse();

      await model.doGenerate({
        text: 'Hello from the AI SDK!',
        outputFormat,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        response_format: outputFormat,
      });
    },
  );

  it('should warn and use mp3 for unsupported output formats', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      outputFormat: 'aac',
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      response_format: 'mp3',
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        type: 'unsupported',
        feature: 'outputFormat',
      }),
    );
  });

  it('should warn for unsupported standard speech options', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      instructions: 'Speak cheerfully',
      speed: 1.2,
      language: 'en',
    });

    expect(result.warnings).toEqual([
      expect.objectContaining({
        type: 'unsupported',
        feature: 'instructions',
      }),
      expect.objectContaining({
        type: 'unsupported',
        feature: 'speed',
      }),
      expect.objectContaining({
        type: 'unsupported',
        feature: 'language',
      }),
    ]);
  });

  it('should pass headers and the Mistral user agent', async () => {
    prepareJsonResponse();

    const customProvider = createMistral({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await customProvider.speech(modelId).doGenerate({
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
    });
    expect(server.calls[0].requestUserAgent).toContain(
      'ai-sdk/mistral/0.0.0-test',
    );
  });

  it('should use a custom base URL', async () => {
    const customUrl = 'https://custom.mistral.example/v2/audio/speech';
    const customFetch = vi.fn<typeof globalThis.fetch>(async () => {
      return new Response(JSON.stringify({ audio_data: 'SUQzBAAAAAAA' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const customProvider = createMistral({
      apiKey: 'test-api-key',
      baseURL: 'https://custom.mistral.example/v2/',
      fetch: customFetch,
    });

    await customProvider.speech(modelId).doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(customFetch.mock.calls[0]![0]).toBe(customUrl);
  });

  it('should use a custom fetch implementation', async () => {
    const customFetch = vi.fn<typeof globalThis.fetch>(async () => {
      return new Response(JSON.stringify({ audio_data: 'SUQzBAAAAAAA' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const customProvider = createMistral({
      apiKey: 'test-api-key',
      fetch: customFetch,
    });

    await customProvider.speech(modelId).doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(customFetch).toHaveBeenCalledOnce();
    expect(customFetch.mock.calls[0]![0]).toBe(url);
  });

  it('should return base64 audio data', async () => {
    prepareJsonResponse({ audioData: 'YXVkaW8=' });

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.audio).toBe('YXVkaW8=');
    expect(result.warnings).toEqual([]);
  });

  it('should include response data with timestamp, model id, and headers', async () => {
    prepareJsonResponse({
      headers: { 'x-request-id': 'test-request-id' },
    });
    const testDate = new Date(0);
    const customModel = new MistralSpeechModel(modelId, {
      provider: 'mistral.speech',
      baseURL: 'https://api.mistral.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      _internal: { currentDate: () => testDate },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId,
      headers: expect.objectContaining({
        'x-request-id': 'test-request-id',
      }),
      body: {
        audio_data: 'SUQzBAAAAAAA',
      },
    });
  });

  it('should redact reference audio from request metadata', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      providerOptions: {
        mistral: {
          refAudio: 'sensitive-reference-audio',
        },
      },
    });

    expect(result.request?.body).toBe(
      JSON.stringify({
        model: modelId,
        input: 'Hello from the AI SDK!',
        ref_audio: '[redacted]',
        response_format: 'mp3',
        stream: false,
      }),
    );
    expect(result.request?.body).not.toContain('sensitive-reference-audio');
  });

  it('should redact reference audio from API errors', async () => {
    server.urls[url].response = {
      type: 'error',
      status: 400,
      body: JSON.stringify({
        object: 'error',
        message: 'The request was rejected.',
        type: 'invalid_request_error',
        param: 'ref_audio',
        code: 'invalid_reference_audio',
      }),
    };

    await expect(
      model.doGenerate({
        text: 'Hello from the AI SDK!',
        providerOptions: {
          mistral: {
            refAudio: 'sensitive-reference-audio',
          },
        },
      }),
    ).rejects.toMatchObject({
      message: 'The request was rejected.',
      statusCode: 400,
      requestBodyValues: expect.objectContaining({
        ref_audio: '[redacted]',
      }),
    });
  });

  it('should forward the abort signal', async () => {
    const abortController = new AbortController();
    const customFetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      expect(init?.signal).toBe(abortController.signal);
      return new Response(JSON.stringify({ audio_data: 'YXVkaW8=' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const customProvider = createMistral({
      apiKey: 'test-api-key',
      fetch: customFetch,
    });

    await customProvider.speech(modelId).doGenerate({
      text: 'Hello from the AI SDK!',
      abortSignal: abortController.signal,
    });

    expect(customFetch).toHaveBeenCalledOnce();
  });
});
