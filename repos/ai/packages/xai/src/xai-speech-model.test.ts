import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { createXai } from './xai-provider';
import { XaiSpeechModel } from './xai-speech-model';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createXai({ apiKey: 'test-api-key' });
const model = provider.speech();
const url = 'https://api.x.ai/v1/tts';

const server = createTestServer({
  [url]: {},
});

describe('XaiSpeechModel', () => {
  it('should expose correct provider and model information', () => {
    expect(model.provider).toBe('xai.speech');
    expect(model.modelId).toBe('');
    expect(model.specificationVersion).toBe('v4');
  });
});

describe('doGenerate', () => {
  function prepareAudioResponse({
    headers,
    contentType = 'audio/mpeg',
  }: {
    headers?: Record<string, string>;
    contentType?: string;
  } = {}) {
    const audio = new Uint8Array([1, 2, 3, 4]);
    server.urls[url].response = {
      type: 'binary',
      headers: {
        'content-type': contentType,
        ...headers,
      },
      body: Buffer.from(audio),
    };
    return audio;
  }

  it('should send text with xAI defaults', async () => {
    prepareAudioResponse();

    await model.doGenerate({ text: 'Hello from the AI SDK!' });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      text: 'Hello from the AI SDK!',
      voice_id: 'eve',
      language: 'auto',
      output_format: { codec: 'mp3' },
    });
    expect(server.calls[0].requestMethod).toBe('POST');
    expect(server.calls[0].requestUrl).toBe(url);
  });

  it('should pass standard speech options', async () => {
    prepareAudioResponse({ contentType: 'audio/wav' });

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
      voice: 'ara',
      language: 'en',
      outputFormat: 'wav',
      speed: 1.2,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      text: 'Hello from the AI SDK!',
      voice_id: 'ara',
      language: 'en',
      output_format: { codec: 'wav' },
      speed: 1.2,
    });
  });

  it.each(['mp3', 'wav', 'pcm', 'mulaw', 'alaw'])(
    'should accept the %s output format',
    async outputFormat => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello from the AI SDK!',
        outputFormat,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        output_format: { codec: outputFormat },
      });
    },
  );

  it('should map provider options onto xAI request fields', async () => {
    prepareAudioResponse();

    await model.doGenerate({
      text: 'Hello from the AI SDK!',
      providerOptions: {
        xai: {
          sampleRate: 44100,
          bitRate: 192000,
          optimizeStreamingLatency: 1,
          textNormalization: true,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      output_format: {
        codec: 'mp3',
        sample_rate: 44100,
        bit_rate: 192000,
      },
      optimize_streaming_latency: 1,
      text_normalization: true,
    });
  });

  it('should warn and use mp3 for unsupported output formats', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      outputFormat: 'flac',
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      output_format: { codec: 'mp3' },
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ type: 'unsupported', feature: 'outputFormat' }),
    );
  });

  it('should warn and ignore bitRate for non-mp3 output', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      outputFormat: 'wav',
      providerOptions: { xai: { bitRate: 192000 } },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody).toMatchObject({
      output_format: { codec: 'wav' },
    });
    expect(requestBody).not.toMatchObject({
      output_format: { bit_rate: expect.any(Number) },
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        type: 'unsupported',
        feature: 'providerOptions',
      }),
    );
  });

  it('should warn when instructions are provided', async () => {
    prepareAudioResponse();

    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
      instructions: 'Speak cheerfully',
    });

    expect(result.warnings).toContainEqual(
      expect.objectContaining({ type: 'unsupported', feature: 'instructions' }),
    );
  });

  it('should pass headers and the xAI user agent', async () => {
    prepareAudioResponse();

    const customProvider = createXai({
      apiKey: 'test-api-key',
      headers: { 'Custom-Provider-Header': 'provider-header-value' },
    });

    await customProvider.speech().doGenerate({
      text: 'Hello from the AI SDK!',
      headers: { 'Custom-Request-Header': 'request-header-value' },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain('ai-sdk/xai/0.0.0-test');
  });

  it('should return binary audio data', async () => {
    const audio = prepareAudioResponse();

    const result = await model.doGenerate({ text: 'Hello from the AI SDK!' });

    expect(result.audio).toStrictEqual(audio);
    expect(result.warnings).toEqual([]);
  });

  it('should include response timestamp, model id, and headers', async () => {
    prepareAudioResponse({ headers: { 'x-request-id': 'test-request-id' } });
    const testDate = new Date(0);
    const customModel = new XaiSpeechModel('', {
      provider: 'xai.speech',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      _internal: { currentDate: () => testDate },
    });

    const result = await customModel.doGenerate({
      text: 'Hello from the AI SDK!',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: '',
      headers: expect.objectContaining({ 'x-request-id': 'test-request-id' }),
    });
  });

  it('should handle API errors', async () => {
    server.urls[url].response = {
      type: 'error',
      status: 400,
      body: JSON.stringify({
        error: {
          message: 'Invalid text',
          type: 'invalid_request_error',
        },
      }),
    };

    await expect(
      model.doGenerate({
        text: 'Hello from the AI SDK!',
      }),
    ).rejects.toMatchObject({
      message: 'Invalid text',
      statusCode: 400,
    });
  });

  it('should use the real date when no custom date provider is specified', async () => {
    prepareAudioResponse();

    const beforeDate = new Date();
    const result = await model.doGenerate({
      text: 'Hello from the AI SDK!',
    });
    const afterDate = new Date();

    expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(
      beforeDate.getTime(),
    );
    expect(result.response.timestamp.getTime()).toBeLessThanOrEqual(
      afterDate.getTime(),
    );
    expect(result.response.modelId).toBe('');
  });
});
