import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { CartesiaTranscriptionModel } from './cartesia-transcription-model';
import { createCartesia } from './cartesia-provider';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const audioData = await readFile(path.join(__dirname, 'transcript-test.mp3'));
const provider = createCartesia({ apiKey: 'test-api-key' });
const model = provider.transcription('ink-whisper');

const server = createTestServer({
  'https://api.cartesia.ai/stt': {},
  'https://api.cartesia.ai/access-token': {
    response: {
      type: 'json-value',
      body: { token: 'test-access-token' },
    },
  },
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

  constructor(public url: string | URL) {
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }

  serverClose() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.cartesia.ai/stt'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('doGenerate', () => {
  describe('transcription', () => {
    beforeEach(() => prepareJsonFixtureResponse('cartesia-transcription'));

    it('should pass the model', async () => {
      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(await server.calls[0].requestBodyMultipart).toMatchObject({
        model: 'ink-whisper',
      });
    });

    it('should pass headers', async () => {
      const provider = createCartesia({
        apiKey: 'test-api-key',
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await provider.transcription('ink-whisper').doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        authorization: 'Bearer test-api-key',
        'cartesia-version': expect.any(String),
        'content-type': expect.stringMatching(
          /^multipart\/form-data; boundary=----formdata-undici-\d+$/,
        ),
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/cartesia/0.0.0-test`,
      );
    });

    it('should extract the transcription text', async () => {
      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.text).toMatchInlineSnapshot(
        `"Hello from the Vercel AI SDK."`,
      );
    });

    it('should extract segments, language and duration', async () => {
      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.language).toBe('en');
      expect(result.durationInSeconds).toBe(2.479);
      expect(result.segments[0]).toStrictEqual({
        text: 'Hello',
        startSecond: 0.199,
        endSecond: 0.479,
      });
    });

    it('should pass language and timestamp granularities', async () => {
      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          cartesia: {
            language: 'en',
            timestampGranularities: ['word'],
          },
        },
      });

      const body = await server.calls[0].requestBodyMultipart;
      expect(body!.file).toBeInstanceOf(File);
      const { file: _, ...rest } = body!;
      expect(rest).toMatchObject({
        model: 'ink-whisper',
        language: 'en',
        'timestamp_granularities[]': 'word',
      });
    });
  });

  describe('response metadata', () => {
    it('should include response data with timestamp and modelId', async () => {
      prepareJsonFixtureResponse('cartesia-transcription');

      const testDate = new Date(0);
      const customModel = new CartesiaTranscriptionModel('ink-whisper', {
        provider: 'test-provider',
        url: () => 'https://api.cartesia.ai/stt',
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
      expect(result.response.modelId).toBe('ink-whisper');
    });
  });
});

describe('doStream', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it('streams Ink 2 turn-detected transcription over WebSocket', async () => {
    const testDate = new Date(0);
    const model = new CartesiaTranscriptionModel('ink-2', {
      provider: 'cartesia.transcription',
      url: ({ path }) => `https://api.cartesia.ai${path}`,
      headers: () => ({
        Authorization: 'Bearer test-api-key',
        'Cartesia-Version': '2026-03-01',
      }),
      version: '2026-03-01',
      webSocket: MockWebSocket,
      _internal: { currentDate: () => testDate },
    });

    const result = await model.doStream({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      providerOptions: {
        cartesia: { language: 'en' },
      },
    });

    expect(server.calls[0].requestUrl).toBe(
      'https://api.cartesia.ai/access-token',
    );
    expect(await server.calls[0].requestBodyJson).toEqual({
      grants: { stt: true },
    });
    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'cartesia-version': '2026-03-01',
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];
    expect(ws.url.toString()).toBe(
      'wss://api.cartesia.ai/stt/turns/websocket?model=ink-2&encoding=pcm_s16le&sample_rate=16000&cartesia_version=2026-03-01&access_token=test-access-token',
    );

    ws.open();
    await flush();
    expect(ws.send).toHaveBeenNthCalledWith(1, new Uint8Array([1, 2, 3]));
    expect(JSON.parse(ws.send.mock.calls[1][0])).toEqual({ type: 'close' });

    ws.message({
      type: 'turn.update',
      request_id: 'turn-1',
      transcript: 'Hello',
    });
    ws.message({
      type: 'turn.end',
      request_id: 'turn-1',
      transcript: 'Hello world',
    });
    ws.message({
      type: 'turn.end',
      request_id: 'turn-1',
      transcript: 'How are you?',
    });
    await flush();
    ws.serverClose();

    await expect(partsPromise).resolves.toEqual([
      { type: 'stream-start', warnings: [] },
      {
        type: 'transcript-partial',
        id: 'turn-1',
        text: 'Hello',
      },
      {
        type: 'transcript-final',
        id: 'turn-1',
        text: 'Hello world',
      },
      {
        type: 'transcript-final',
        id: 'turn-1',
        text: 'How are you?',
      },
      {
        type: 'finish',
        text: 'Hello world How are you?',
        segments: [],
        language: 'en',
      },
    ]);
    expect(result.request).toEqual({
      body: 'wss://api.cartesia.ai/stt/turns/websocket?model=ink-2&encoding=pcm_s16le&sample_rate=16000&cartesia_version=2026-03-01',
    });
    expect(result.response).toEqual({
      timestamp: testDate,
      modelId: 'ink-2',
    });
  });

  it('supports manual finalization when turn detection is disabled', async () => {
    const provider = createCartesia({
      apiKey: 'test-api-key',
      webSocket: MockWebSocket,
    });
    const result = await provider.transcription('ink-2').doStream!({
      audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
      inputAudioFormat: { type: 'audio/pcmu', rate: 8000 },
      providerOptions: {
        cartesia: {
          language: 'en',
          streaming: { turnDetection: false },
        },
      },
    });

    const partsPromise = convertReadableStreamToArray(result.stream);
    const ws = MockWebSocket.instances[0];
    expect(ws.url.toString()).toContain(
      'wss://api.cartesia.ai/stt/websocket?model=ink-2&encoding=pcm_mulaw&sample_rate=8000',
    );
    expect(ws.url.toString()).toContain('&language=en');

    ws.open();
    await flush();
    expect(ws.send).toHaveBeenNthCalledWith(2, 'finalize');

    ws.message({
      type: 'transcript',
      request_id: 'request-1',
      text: 'Hello ',
      is_final: true,
      duration: 0.5,
    });
    ws.message({
      type: 'transcript',
      request_id: 'request-1',
      text: 'world',
      is_final: true,
      duration: 0.4,
    });
    ws.message({ type: 'flush_done', request_id: 'request-1' });
    await flush();
    expect(ws.send).toHaveBeenNthCalledWith(3, 'close');
    ws.message({ type: 'done', request_id: 'request-1' });

    expect((await partsPromise).at(-1)).toEqual({
      type: 'finish',
      text: 'Hello world',
      segments: [],
      language: 'en',
      durationInSeconds: 0.9,
    });
  });

  it('rejects unsupported model operations and Ink 2 languages', async () => {
    const provider = createCartesia({
      apiKey: 'test-api-key',
      webSocket: MockWebSocket,
    });

    await expect(
      provider.transcription('ink-whisper').doStream!({
        audio: convertArrayToReadableStream([]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      }),
    ).rejects.toMatchObject({ name: 'AI_UnsupportedFunctionalityError' });

    await expect(
      provider.transcription('ink-2').doGenerate({
        audio: new Uint8Array(),
        mediaType: 'audio/wav',
      }),
    ).rejects.toMatchObject({ name: 'AI_UnsupportedFunctionalityError' });

    await expect(
      provider.transcription('ink-2').doStream!({
        audio: convertArrayToReadableStream([]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        providerOptions: { cartesia: { language: 'es' } },
      }),
    ).rejects.toThrow('currently supports English only');
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('closes the WebSocket and stops reading audio when cancelled', async () => {
    const provider = createCartesia({
      apiKey: 'test-api-key',
      webSocket: MockWebSocket,
    });
    let audioCancelled = false;
    const audio = new ReadableStream<Uint8Array>({
      cancel() {
        audioCancelled = true;
      },
    });
    const result = await provider.transcription('ink-2').doStream!({
      audio,
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });
    const ws = MockWebSocket.instances[0];
    ws.open();
    await flush();

    await result.stream.cancel();
    await flush();

    expect(ws.close).toHaveBeenCalled();
    expect(audioCancelled).toBe(true);
  });

  it('cancels input when the WebSocket constructor fails', async () => {
    let audioCancelled = false;
    const audio = new ReadableStream<Uint8Array>({
      cancel() {
        audioCancelled = true;
      },
    });
    const provider = createCartesia({
      apiKey: 'test-api-key',
      webSocket: class {
        constructor() {
          throw new Error('connection failed');
        }
      } as never,
    });

    const result = await provider.transcription('ink-2').doStream!({
      audio,
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
    });

    await expect(convertReadableStreamToArray(result.stream)).rejects.toThrow(
      'connection failed',
    );
    await flush();
    expect(audioCancelled).toBe(true);
  });
});
