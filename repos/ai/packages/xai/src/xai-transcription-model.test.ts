import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { createXai } from './xai-provider';
import { XaiTranscriptionModel } from './xai-transcription-model';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const audioData = new Uint8Array([1, 2, 3, 4]);
const provider = createXai({ apiKey: 'test-api-key' });
const model = provider.transcription();
const url = 'https://api.x.ai/v1/stt';

const server = createTestServer({
  [url]: {},
});

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readyState = 0;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(
    public url: string | URL,
    public protocols?: string | string[],
    public options?: { headers?: Record<string, string | undefined> },
  ) {
    MockWebSocket.instances.push(this);
  }

  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function prepareJsonResponse(headers?: Record<string, string>) {
  server.urls[url].response = {
    type: 'json-value',
    headers,
    body: {
      text: 'Hello from the AI SDK!',
      language: 'en',
      duration: 2.5,
      words: [
        {
          text: 'Hello',
          start: 0,
          end: 1,
        },
        {
          text: 'from the AI SDK!',
          start: 1,
          end: 2.5,
        },
      ],
    },
  };
}

describe('XaiTranscriptionModel', () => {
  it('should expose correct provider and model information', () => {
    expect(model.provider).toBe('xai.transcription');
    expect(model.modelId).toBe('');
    expect(model.specificationVersion).toBe('v4');
  });
});

describe('doGenerate', () => {
  it('should send a multipart request with the audio file', async () => {
    prepareJsonResponse();

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    const body = await server.calls[0].requestBodyMultipart;
    expect(body!.file).toBeInstanceOf(File);
    expect((body!.file as File).name).toBe('audio.wav');
    expect((body!.file as File).type).toBe('audio/wav');
    expect(server.calls[0].requestMethod).toBe('POST');
    expect(server.calls[0].requestUrl).toBe(url);
  });

  it('should map provider options onto xAI request fields', async () => {
    prepareJsonResponse();

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/pcm',
      providerOptions: {
        xai: {
          audioFormat: 'pcm',
          sampleRate: 16000,
          language: 'en',
          format: true,
          multichannel: true,
          channels: 2,
          diarize: true,
          keyterm: ['AI SDK', 'Grok'],
          fillerWords: true,
        },
      },
    });

    const body = await server.calls[0].requestBodyMultipart;
    expect(body).toMatchObject({
      audio_format: 'pcm',
      sample_rate: '16000',
      language: 'en',
      format: 'true',
      multichannel: 'true',
      channels: '2',
      diarize: 'true',
      keyterm: 'Grok',
      filler_words: 'true',
    });
  });

  it('should append file after all other multipart fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: 'Hello from the AI SDK!',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const customModel = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      fetch: fetchMock as unknown as typeof fetch,
    });

    await customModel.doGenerate({
      audio: audioData,
      mediaType: 'audio/pcm',
      providerOptions: {
        xai: {
          audioFormat: 'pcm',
          sampleRate: 16000,
          language: 'en',
          format: true,
          multichannel: true,
          channels: 2,
          diarize: true,
          keyterm: ['AI SDK', 'Grok'],
          fillerWords: true,
        },
      },
    });

    const request = fetchMock.mock.calls[0][1];
    const body = request.body as FormData;
    expect(Array.from(body.keys())).toEqual([
      'audio_format',
      'sample_rate',
      'language',
      'format',
      'multichannel',
      'channels',
      'diarize',
      'filler_words',
      'keyterm',
      'keyterm',
      'file',
    ]);
  });

  it('should pass headers and the xAI user agent', async () => {
    prepareJsonResponse();

    const customProvider = createXai({
      apiKey: 'test-api-key',
      headers: { 'Custom-Provider-Header': 'provider-header-value' },
    });

    await customProvider.transcription().doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      headers: { 'Custom-Request-Header': 'request-header-value' },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'content-type': expect.stringMatching(
        /^multipart\/form-data; boundary=----formdata-undici-\d+$/,
      ),
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain('ai-sdk/xai/0.0.0-test');
  });

  it('should extract text, segments, language, and duration', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result).toMatchObject({
      text: 'Hello from the AI SDK!',
      language: 'en',
      durationInSeconds: 2.5,
      segments: [
        {
          text: 'Hello',
          startSecond: 0,
          endSecond: 1,
        },
        {
          text: 'from the AI SDK!',
          startSecond: 1,
          endSecond: 2.5,
        },
      ],
      warnings: [],
    });
  });

  it('should include response timestamp, model id, and headers', async () => {
    prepareJsonResponse({
      'x-request-id': 'test-request-id',
      'x-ratelimit-remaining': '123',
    });
    const testDate = new Date(0);
    const customModel = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      _internal: { currentDate: () => testDate },
    });

    const result = await customModel.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: '',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });
  });

  it('should handle missing words, duration, and empty language', async () => {
    server.urls[url].response = {
      type: 'json-value',
      body: {
        text: 'Hello from the AI SDK!',
        language: '',
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result).toMatchObject({
      text: 'Hello from the AI SDK!',
      language: undefined,
      durationInSeconds: undefined,
      segments: [],
      warnings: [],
    });
  });
});

describe('doStream', () => {
  it('should require channels when streaming multichannel audio', async () => {
    MockWebSocket.instances = [];

    const result = model.doStream!({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      providerOptions: {
        xai: {
          multichannel: true,
        },
      },
    });

    await expect(result).rejects.toMatchObject({
      name: 'AI_InvalidArgumentError',
      argument: 'providerOptions',
    });
    await expect(result).rejects.toThrow(
      'providerOptions.xai.channels is required when providerOptions.xai.multichannel is true',
    );

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('should stream xAI STT over WebSocket', async () => {
    MockWebSocket.instances = [];
    const testDate = new Date(0);
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
      _internal: { currentDate: () => testDate },
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      providerOptions: {
        xai: {
          language: 'en',
          diarize: true,
          keyterm: ['AI SDK', 'Grok'],
          streaming: {
            interimResults: true,
            endpointing: 500,
            smartTurn: 0.7,
            smartTurnTimeout: 3000,
          },
        },
      },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];
    expect(ws.url.toString()).toBe(
      'wss://api.x.ai/v1/stt?sample_rate=16000&encoding=pcm&language=en&diarize=true&interim_results=true&endpointing=500&smart_turn=0.7&smart_turn_timeout=3000&keyterm=AI+SDK&keyterm=Grok',
    );
    expect(ws.options?.headers).toMatchObject({
      Authorization: 'Bearer test-api-key',
    });
    expect(ws.send).not.toHaveBeenCalled();

    ws.message({ type: 'transcript.created' });
    await flush();

    expect(ws.send).toHaveBeenNthCalledWith(1, new Uint8Array([1, 2, 3]));
    expect(JSON.parse(ws.send.mock.calls[1][0])).toEqual({
      type: 'audio.done',
    });

    ws.message({
      type: 'transcript.partial',
      text: 'Hel',
      is_final: false,
      speech_final: false,
      start: 0,
      duration: 0.5,
    });
    ws.message({
      type: 'transcript.partial',
      text: 'Hello',
      is_final: true,
      speech_final: true,
      start: 0,
      duration: 1,
    });
    ws.message({
      type: 'transcript.done',
      text: 'Hello',
      duration: 1,
    });

    await expect(partsPromise).resolves.toEqual([
      { type: 'stream-start', warnings: [] },
      {
        type: 'transcript-partial',
        id: undefined,
        text: 'Hel',
        startSecond: 0,
        durationInSeconds: 0.5,
        channelIndex: undefined,
      },
      {
        type: 'transcript-final',
        id: undefined,
        text: 'Hello',
        startSecond: 0,
        endSecond: 1,
        channelIndex: undefined,
      },
      {
        type: 'finish',
        text: 'Hello',
        segments: [],
        language: 'en',
        durationInSeconds: 1,
      },
    ]);
    expect(result.response).toEqual({ timestamp: testDate, modelId: '' });
  });

  it('should strip undefined header values before the WebSocket constructor', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      headers: { 'Custom-Header': 'custom-value', 'X-Unset': undefined },
    });

    void result.stream.cancel();
    const headers = MockWebSocket.instances[0].options?.headers ?? {};
    expect(headers).not.toHaveProperty('X-Unset');
    expect(Object.values(headers)).not.toContain(undefined);
    expect(headers).toMatchObject({
      Authorization: 'Bearer test-api-key',
      'Custom-Header': 'custom-value',
    });
  });

  it('should cancel the audio stream when the WebSocket constructor throws', async () => {
    let audioCancelled = false;
    const audio = new ReadableStream<Uint8Array>({
      cancel() {
        audioCancelled = true;
      },
    });
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: class {
        constructor() {
          throw new Error('constructor failed');
        }
      } as never,
    });

    const result = await model.doStream({
      audio,
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    await expect(convertReadableStreamToArray(result.stream)).rejects.toThrow(
      'constructor failed',
    );
    expect(audioCancelled).toBe(true);
  });

  it('should cancel the audio stream when an audio send throws mid-stream', async () => {
    MockWebSocket.instances = [];
    let audioCancelled = false;
    const audio = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
      },
      cancel() {
        audioCancelled = true;
      },
    });
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio,
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    // subscribe before triggering the failure: the stream errors while
    // flushing, and an unsubscribed rejection fails the vitest run
    const assertion = expect(partsPromise).rejects.toThrow('send failed');
    const ws = MockWebSocket.instances[0];
    ws.send.mockImplementation((data: unknown) => {
      if (data instanceof Uint8Array) {
        throw new Error('send failed');
      }
    });

    ws.message({ type: 'transcript.created' });
    await assertion;
    expect(audioCancelled).toBe(true);
  });

  // live API behavior: finals are re-sent (`speech_final` false then true)
  // and `transcript.done` carries an empty `text`.
  it('should emit one transcript-final per utterance and reconstruct the finish text when transcript.done is empty', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    ws.message({ type: 'transcript.created' });
    await flush();

    ws.message({
      type: 'transcript.partial',
      text: 'Hello wor',
      is_final: false,
      speech_final: false,
      start: 0,
      duration: 0.8,
    });
    ws.message({
      type: 'transcript.partial',
      text: 'Hello world.',
      is_final: true,
      speech_final: false,
      start: 0,
      duration: 1,
    });
    ws.message({
      type: 'transcript.partial',
      text: 'Hello world.',
      is_final: true,
      speech_final: true,
      start: 0,
      duration: 1,
    });
    ws.message({ type: 'transcript.done', text: '', duration: 1 });

    const parts = await partsPromise;
    expect(parts.filter(part => part.type === 'transcript-final')).toEqual([
      {
        type: 'transcript-final',
        id: undefined,
        text: 'Hello world.',
        startSecond: 0,
        endSecond: 1,
        channelIndex: undefined,
      },
    ]);
    // the speech_final:false re-send surfaces as a partial:
    expect(
      parts.filter(part => part.type === 'transcript-partial'),
    ).toHaveLength(2);
    expect(parts.at(-1)).toEqual({
      type: 'finish',
      text: 'Hello world.',
      segments: [],
      language: undefined,
      durationInSeconds: 1,
    });
  });

  // live API behavior: `is_final` fragments get merged/re-punctuated by the
  // eventual `speech_final` event, so they are not stable finals.
  it('should treat is_final fragments as partials and use the speech_final text for finish', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    ws.message({ type: 'transcript.created' });
    await flush();

    ws.message({
      type: 'transcript.partial',
      text: 'No',
      is_final: true,
      speech_final: false,
      start: 0,
      duration: 0.5,
    });
    ws.message({
      type: 'transcript.partial',
      text: ", I'm not",
      is_final: true,
      speech_final: false,
      start: 0.5,
      duration: 0.7,
    });
    ws.message({
      type: 'transcript.partial',
      text: "No, I'm not.",
      is_final: true,
      speech_final: true,
      start: 0,
      duration: 1.2,
    });
    ws.message({ type: 'transcript.done', text: '', duration: 1.2 });

    const parts = await partsPromise;
    expect(parts.map(part => part.type)).toEqual([
      'stream-start',
      'transcript-partial',
      'transcript-partial',
      'transcript-final',
      'finish',
    ]);
    expect(parts.at(-1)).toMatchObject({ text: "No, I'm not." });
  });

  it('should fall back to the latest pending text when no speech_final arrived before transcript.done', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    ws.message({ type: 'transcript.created' });
    await flush();

    ws.message({
      type: 'transcript.partial',
      text: 'Hello wor',
      is_final: false,
      speech_final: false,
    });
    ws.message({
      type: 'transcript.partial',
      text: 'Hello world',
      is_final: true,
      speech_final: false,
    });
    ws.message({ type: 'transcript.done', text: '', duration: 1 });

    const parts = await partsPromise;
    expect(parts.at(-1)).toMatchObject({ type: 'finish', text: 'Hello world' });
  });

  it('should join finalized utterances per channel when transcript.done is empty', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    ws.message({ type: 'transcript.created' });
    await flush();

    ws.message({
      type: 'transcript.partial',
      text: 'First utterance.',
      is_final: true,
      speech_final: true,
      start: 0,
      duration: 1,
    });
    ws.message({
      type: 'transcript.partial',
      text: 'Second utterance.',
      is_final: true,
      speech_final: true,
      start: 1,
      duration: 1,
    });
    ws.message({ type: 'transcript.done', text: '', duration: 2 });

    const parts = await partsPromise;
    expect(parts.at(-1)).toMatchObject({
      type: 'finish',
      text: 'First utterance. Second utterance.',
    });
  });

  it('should error the stream with the server message on error events', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    ws.message({ type: 'transcript.created' });
    await flush();

    const assertion = expect(partsPromise).rejects.toThrow(
      'invalid sample_rate',
    );
    ws.message({ type: 'error', message: 'invalid sample_rate' });
    await assertion;

    expect(ws.close).toHaveBeenCalled();
  });

  it('should close the WebSocket and stop reading audio when the stream is cancelled', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    let audioCancelled = false;
    const audio = new ReadableStream<Uint8Array>({
      cancel() {
        audioCancelled = true;
      },
    });

    const result = await model.doStream({
      audio,
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    const ws = MockWebSocket.instances[0];
    ws.message({ type: 'transcript.created' });
    await flush();

    await result.stream.cancel();
    await flush();

    expect(ws.close).toHaveBeenCalled();
    expect(audioCancelled).toBe(true);
  });

  it('should warn on unrecognized inputAudioFormat types', async () => {
    MockWebSocket.instances = [];
    const model = new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/wav' },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    ws.message({ type: 'transcript.created' });
    await flush();
    ws.message({ type: 'transcript.done', text: 'Hello' });

    const parts = await partsPromise;
    expect(parts[0]).toEqual({
      type: 'stream-start',
      warnings: [
        {
          type: 'other',
          message: expect.stringContaining(
            'Unrecognized inputAudioFormat.type "audio/wav"',
          ),
        },
      ],
    });
  });
});
