import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { createOpenAI } from '../openai-provider';
import { OpenAITranscriptionModel } from './openai-transcription-model';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const audioData = await readFile(
  path.join(__dirname, 'transcription-test.mp3'),
);
const provider = createOpenAI({ apiKey: 'test-api-key' });
const model = provider.transcription('whisper-1');

const server = createTestServer({
  'https://api.openai.com/v1/audio/transcriptions': {},
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

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.openai.com/v1/audio/transcriptions'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(
        `src/transcription/__fixtures__/${filename}.json`,
        'utf8',
      ),
    ),
  };
}

describe('doGenerate', () => {
  it('should reject gpt-realtime-whisper for non-streaming transcription', async () => {
    await expect(
      provider.transcription('gpt-realtime-whisper').doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      }),
    ).rejects.toBeInstanceOf(UnsupportedFunctionalityError);
  });

  it('should pass the model', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(await server.calls[0].requestBodyMultipart).toMatchObject({
      model: 'whisper-1',
    });
  });

  it('should default whisper-1 to verbose_json response format', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(await server.calls[0].requestBodyMultipart).toMatchObject({
      model: 'whisper-1',
      response_format: 'verbose_json',
    });
    expect(result.durationInSeconds).toBe(36.709999084472656);
  });

  it('should pass headers', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.transcription('whisper-1').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'content-type': expect.stringMatching(
        /^multipart\/form-data; boundary=----formdata-undici-\d+$/,
      ),
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
      'openai-organization': 'test-organization',
      'openai-project': 'test-project',
    });

    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/openai/0.0.0-test`,
    );
  });

  it('should extract the transcription text', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.text).toMatchInlineSnapshot(
      `"Galileo was an American robotic space program that studied the planet Jupiter and its moons, as well as several other solar system bodies."`,
    );
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareJsonFixtureResponse('openai-transcription', {
      'x-request-id': 'test-request-id',
      'x-ratelimit-remaining': '123',
    });

    const testDate = new Date(0);
    const customModel = new OpenAITranscriptionModel('whisper-1', {
      provider: 'test-provider',
      url: () => 'https://api.openai.com/v1/audio/transcriptions',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: 'whisper-1',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });
  });

  it('should use real date when no custom date provider is specified', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    const testDate = new Date(0);
    const customModel = new OpenAITranscriptionModel('whisper-1', {
      provider: 'test-provider',
      url: () => 'https://api.openai.com/v1/audio/transcriptions',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.response.timestamp.getTime()).toEqual(testDate.getTime());
    expect(result.response.modelId).toBe('whisper-1');
  });

  it('should pass response_format when `providerOptions.openai.timestampGranularities` is set', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        openai: {
          timestampGranularities: ['word'],
        },
      },
    });

    const body = await server.calls[0].requestBodyMultipart;
    expect(body!.file).toBeInstanceOf(File);
    const { file: _, ...rest } = body!;
    expect(rest).toMatchInlineSnapshot(`
      {
        "model": "whisper-1",
        "response_format": "verbose_json",
        "temperature": "0",
        "timestamp_granularities[]": "word",
      }
    `);
  });

  it('should not set pass response_format to "verbose_json" when model is "gpt-4o-transcribe"', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    const model = provider.transcription('gpt-4o-transcribe');
    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        openai: {
          timestampGranularities: ['word'],
        },
      },
    });

    const body = await server.calls[0].requestBodyMultipart;
    expect(body!.file).toBeInstanceOf(File);
    const { file: _, ...rest } = body!;
    expect(rest).toMatchInlineSnapshot(`
      {
        "model": "gpt-4o-transcribe",
        "response_format": "json",
        "temperature": "0",
        "timestamp_granularities[]": "word",
      }
    `);
  });

  it('should pass timestamp_granularities when specified', async () => {
    prepareJsonFixtureResponse('openai-transcription');

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        openai: {
          timestampGranularities: ['segment'],
        },
      },
    });

    const body = await server.calls[0].requestBodyMultipart;
    expect(body!.file).toBeInstanceOf(File);
    const { file: _, ...rest } = body!;
    expect(rest).toMatchInlineSnapshot(`
      {
        "model": "whisper-1",
        "response_format": "verbose_json",
        "temperature": "0",
        "timestamp_granularities[]": "segment",
      }
    `);
  });

  it('should work when no words, language, or duration are returned', async () => {
    server.urls['https://api.openai.com/v1/audio/transcriptions'].response = {
      type: 'json-value',
      body: {
        task: 'transcribe',
        text: 'Hello from the Vercel AI SDK!',
        _request_id: 'req_1234',
      },
    };

    const testDate = new Date(0);
    const customModel = new OpenAITranscriptionModel('whisper-1', {
      provider: 'test-provider',
      url: () => 'https://api.openai.com/v1/audio/transcriptions',
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "durationInSeconds": undefined,
        "language": undefined,
        "response": {
          "body": {
            "_request_id": "req_1234",
            "task": "transcribe",
            "text": "Hello from the Vercel AI SDK!",
          },
          "headers": {
            "content-length": "85",
            "content-type": "application/json",
          },
          "modelId": "whisper-1",
          "timestamp": 1970-01-01T00:00:00.000Z,
        },
        "segments": [],
        "text": "Hello from the Vercel AI SDK!",
        "warnings": [],
      }
    `);
  });

  it('should parse segments when provided in response', async () => {
    server.urls['https://api.openai.com/v1/audio/transcriptions'].response = {
      type: 'json-value',
      body: {
        task: 'transcribe',
        text: 'Hello world. How are you?',
        segments: [
          {
            id: 0,
            seek: 0,
            start: 0.0,
            end: 2.5,
            text: 'Hello world.',
            tokens: [1234, 5678],
            temperature: 0.0,
            avg_logprob: -0.5,
            compression_ratio: 1.2,
            no_speech_prob: 0.1,
          },
          {
            id: 1,
            seek: 250,
            start: 2.5,
            end: 5.0,
            text: ' How are you?',
            tokens: [9012, 3456],
            temperature: 0.0,
            avg_logprob: -0.6,
            compression_ratio: 1.1,
            no_speech_prob: 0.05,
          },
        ],
        language: 'en',
        duration: 5.0,
        _request_id: 'req_1234',
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        openai: {
          timestampGranularities: ['segment'],
        },
      },
    });

    expect(result.segments).toMatchInlineSnapshot(`
      [
        {
          "endSecond": 2.5,
          "startSecond": 0,
          "text": "Hello world.",
        },
        {
          "endSecond": 5,
          "startSecond": 2.5,
          "text": " How are you?",
        },
      ]
    `);
    expect(result.text).toBe('Hello world. How are you?');
    expect(result.durationInSeconds).toBe(5.0);
  });

  it('should fallback to words when segments are not available', async () => {
    server.urls['https://api.openai.com/v1/audio/transcriptions'].response = {
      type: 'json-value',
      body: {
        task: 'transcribe',
        text: 'Hello world',
        words: [
          {
            word: 'Hello',
            start: 0.0,
            end: 1.0,
          },
          {
            word: 'world',
            start: 1.0,
            end: 2.0,
          },
        ],
        language: 'en',
        duration: 2.0,
        _request_id: 'req_1234',
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        openai: {
          timestampGranularities: ['word'],
        },
      },
    });

    expect(result.segments).toMatchInlineSnapshot(`
      [
        {
          "endSecond": 1,
          "startSecond": 0,
          "text": "Hello",
        },
        {
          "endSecond": 2,
          "startSecond": 1,
          "text": "world",
        },
      ]
    `);
  });

  it('should handle empty segments array', async () => {
    server.urls['https://api.openai.com/v1/audio/transcriptions'].response = {
      type: 'json-value',
      body: {
        task: 'transcribe',
        text: 'Hello world',
        segments: [],
        language: 'en',
        duration: 2.0,
        _request_id: 'req_1234',
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.segments).toEqual([]);
    expect(result.text).toBe('Hello world');
  });

  it('should handle segments with missing optional fields', async () => {
    server.urls['https://api.openai.com/v1/audio/transcriptions'].response = {
      type: 'json-value',
      body: {
        task: 'transcribe',
        text: 'Test',
        segments: [
          {
            id: 0,
            seek: 0,
            start: 0.0,
            end: 1.0,
            text: 'Test',
            tokens: [1234],
            temperature: 0.0,
            avg_logprob: -0.5,
            compression_ratio: 1.0,
            no_speech_prob: 0.1,
          },
        ],
        _request_id: 'req_1234',
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.segments).toMatchInlineSnapshot(`
      [
        {
          "endSecond": 1,
          "startSecond": 0,
          "text": "Test",
        },
      ]
    `);
    expect(result.language).toBeUndefined();
    expect(result.durationInSeconds).toBeUndefined();
  });
});

describe('doStream', () => {
  it('should stream gpt-realtime-whisper using OpenAI realtime transcription', async () => {
    MockWebSocket.instances = [];
    const testDate = new Date(0);
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
      _internal: { currentDate: () => testDate },
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      providerOptions: {
        openai: {
          language: 'en',
          streaming: {
            delay: 'low',
            include: ['item.input_audio_transcription.logprobs'],
          },
        },
      },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];
    expect(ws.url.toString()).toBe(
      'wss://api.openai.com/v1/realtime?intent=transcription',
    );
    expect(ws.protocols).toEqual([
      'realtime',
      'openai-insecure-api-key.test-api-key',
    ]);
    // OpenAI rejects handshakes that send both auth channels:
    expect(Object.keys(ws.options?.headers ?? {})).not.toContain(
      'Authorization',
    );
    expect(Object.keys(ws.options?.headers ?? {})).not.toContain(
      'authorization',
    );

    ws.open();
    await flush();

    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: {
              model: 'gpt-realtime-whisper',
              language: 'en',
              delay: 'low',
            },
            turn_detection: null,
          },
        },
        include: ['item.input_audio_transcription.logprobs'],
      },
    });
    expect(JSON.parse(ws.send.mock.calls[1][0])).toEqual({
      type: 'input_audio_buffer.append',
      audio: 'AQID',
    });
    expect(JSON.parse(ws.send.mock.calls[2][0])).toEqual({
      type: 'input_audio_buffer.commit',
    });

    ws.message({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'item-1',
      delta: 'Hel',
    });
    ws.message({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-1',
      transcript: 'Hello',
    });

    await expect(partsPromise).resolves.toEqual([
      { type: 'stream-start', warnings: [] },
      { type: 'transcript-delta', id: 'item-1', delta: 'Hel' },
      { type: 'transcript-final', id: 'item-1', text: 'Hello' },
      {
        type: 'finish',
        text: 'Hello',
        segments: [],
        language: 'en',
      },
    ]);
    expect(result.response).toEqual({
      timestamp: testDate,
      modelId: 'gpt-realtime-whisper',
    });
  });

  it('should accept dated gpt-realtime-whisper snapshot model IDs', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel(
      'gpt-realtime-whisper-2026-01-01',
      {
        provider: 'test-provider',
        url: ({ path }) => `https://api.openai.com/v1${path}`,
        headers: () => ({ Authorization: 'Bearer test-api-key' }),
        webSocket: MockWebSocket,
      },
    );

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];
    ws.open();
    await flush();

    expect(JSON.parse(ws.send.mock.calls[0][0]).session.audio.input).toEqual(
      expect.objectContaining({
        transcription: expect.objectContaining({
          model: 'gpt-realtime-whisper-2026-01-01',
        }),
      }),
    );

    ws.message({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-1',
      transcript: 'Hello',
    });
    await expect(partsPromise).resolves.toBeDefined();
  });

  it('should strip only the Authorization header and pass other headers to the WebSocket constructor', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({
        Authorization: 'Bearer test-api-key',
        'OpenAI-Organization': 'test-organization',
        'Custom-Header': 'custom-value',
      }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    expect(ws.protocols).toEqual([
      'realtime',
      'openai-insecure-api-key.test-api-key',
    ]);
    expect(ws.options?.headers).toMatchObject({
      'OpenAI-Organization': 'test-organization',
      'Custom-Header': 'custom-value',
    });
    expect(Object.keys(ws.options?.headers ?? {})).not.toContain(
      'Authorization',
    );
    expect(Object.keys(ws.options?.headers ?? {})).not.toContain(
      'authorization',
    );

    ws.open();
    await flush();
    ws.message({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-1',
      transcript: 'Hello',
    });
    await expect(partsPromise).resolves.toBeDefined();
  });

  it('should use only the realtime protocol and pass headers unchanged when there is no Authorization header', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ 'Custom-Header': 'custom-value' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];

    expect(ws.protocols).toEqual(['realtime']);
    expect(ws.options?.headers).toMatchObject({
      'Custom-Header': 'custom-value',
    });

    ws.open();
    await flush();
    ws.message({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-1',
      transcript: 'Hello',
    });
    await expect(partsPromise).resolves.toBeDefined();
  });

  it('should strip undefined header values before the WebSocket constructor', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      headers: { 'Custom-Header': 'custom-value', 'X-Unset': undefined },
    });

    void result.stream.cancel();
    const headers = MockWebSocket.instances[0].options?.headers ?? {};
    expect(headers).not.toHaveProperty('X-Unset');
    expect(Object.values(headers)).not.toContain(undefined);
    expect(headers).toMatchObject({ 'Custom-Header': 'custom-value' });
  });

  it('should cancel the audio stream when the WebSocket constructor throws', async () => {
    let audioCancelled = false;
    const audio = new ReadableStream<Uint8Array>({
      cancel() {
        audioCancelled = true;
      },
    });
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: class {
        constructor() {
          throw new Error('constructor failed');
        }
      } as never,
    });

    const result = await model.doStream({
      audio,
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
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
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio,
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    // subscribe before triggering the failure: the stream errors while
    // flushing, and an unsubscribed rejection fails the vitest run
    const assertion = expect(partsPromise).rejects.toThrow('send failed');
    const ws = MockWebSocket.instances[0];
    ws.send.mockImplementation((data: string) => {
      if (String(data).includes('input_audio_buffer.append')) {
        throw new Error('send failed');
      }
    });

    ws.open();
    await assertion;
    expect(audioCancelled).toBe(true);
  });

  it('should carry mixed-case Authorization headers into the subprotocol and strip them', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ AUTHORIZATION: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    });

    void result.stream.cancel();
    const ws = MockWebSocket.instances[0];
    expect(ws.protocols).toEqual([
      'realtime',
      'openai-insecure-api-key.test-api-key',
    ]);
    expect(
      Object.keys(ws.options?.headers ?? {}).map(key => key.toLowerCase()),
    ).not.toContain('authorization');
  });

  it('should let per-call authorization headers override configuration headers across casings', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ Authorization: 'Bearer config-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      // lowercase scheme + lowercase header key, both case-insensitive
      headers: { authorization: 'bearer per-call-key' },
    });

    void result.stream.cancel();
    const ws = MockWebSocket.instances[0];
    expect(ws.protocols).toEqual([
      'realtime',
      'openai-insecure-api-key.per-call-key',
    ]);
    expect(
      Object.keys(ws.options?.headers ?? {}).map(key => key.toLowerCase()),
    ).not.toContain('authorization');
  });

  it('should warn about unsupported non-streaming provider options', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      providerOptions: {
        openai: {
          prompt: 'context prompt',
          temperature: 0.5,
        },
      },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];
    ws.open();
    await flush();
    ws.message({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-1',
      transcript: 'Hello',
    });

    const parts = await partsPromise;
    expect(parts[0]).toEqual({
      type: 'stream-start',
      warnings: [
        {
          type: 'unsupported',
          feature: 'providerOptions.openai.prompt',
          details: 'OpenAI streaming transcription does not support prompt.',
        },
        {
          type: 'unsupported',
          feature: 'providerOptions.openai.temperature',
          details:
            'OpenAI streaming transcription does not support temperature.',
        },
      ],
    });
  });

  it('should error the stream with the server message on error events', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
      headers: () => ({ Authorization: 'Bearer test-api-key' }),
      webSocket: MockWebSocket,
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];
    ws.open();
    await flush();

    const assertion = expect(partsPromise).rejects.toThrow(
      'invalid session configuration',
    );
    ws.message({
      type: 'error',
      error: { message: 'invalid session configuration' },
    });
    await assertion;

    expect(ws.close).toHaveBeenCalled();
  });

  it('should close the WebSocket and stop reading audio when the stream is cancelled', async () => {
    MockWebSocket.instances = [];
    const model = new OpenAITranscriptionModel('gpt-realtime-whisper', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.openai.com/v1${path}`,
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
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    });

    const ws = MockWebSocket.instances[0];
    ws.open();
    await flush();

    await result.stream.cancel();
    await flush();

    expect(ws.close).toHaveBeenCalled();
    expect(audioCancelled).toBe(true);
  });
});
