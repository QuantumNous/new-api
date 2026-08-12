import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GatewayAuthenticationError,
  GatewayError,
  GatewayInternalServerError,
  GatewayInvalidRequestError,
  GatewayRateLimitError,
} from './errors';
import type { GatewayConfig } from './gateway-config';
import { GatewayTranscriptionModel } from './gateway-transcription-model';

const server = createTestServer({
  'https://api.test.com/transcription-model': {},
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

const createTestModel = (
  config: Partial<
    GatewayConfig & { o11yHeaders?: Record<string, string> }
  > = {},
) =>
  new GatewayTranscriptionModel('openai/gpt-4o-transcribe', {
    provider: 'gateway',
    baseURL: 'https://api.test.com',
    headers: () => ({
      Authorization: 'Bearer test-token',
      'ai-gateway-auth-method': 'api-key',
    }),
    fetch: globalThis.fetch,
    o11yHeaders: config.o11yHeaders || {},
    ...config,
  });

const createStreamingTestModel = (
  config: Partial<
    GatewayConfig & {
      o11yHeaders?: Record<string, string>;
      headers?: () => Record<string, string>;
      _internal?: { currentDate?: () => Date };
    }
  > = {},
) =>
  new GatewayTranscriptionModel('openai/gpt-realtime-whisper', {
    provider: 'gateway',
    baseURL: 'https://api.test.com',
    headers: () => ({
      Authorization: 'Bearer test-token',
      'ai-gateway-auth-method': 'api-key',
    }),
    fetch: globalThis.fetch,
    o11yHeaders: {},
    webSocket: MockWebSocket,
    ...config,
  });

describe('GatewayTranscriptionModel', () => {
  function prepareJsonResponse({
    text = 'Hello world',
    headers,
  }: {
    text?: string;
    headers?: Record<string, string>;
  } = {}) {
    server.urls['https://api.test.com/transcription-model'].response = {
      type: 'json-value',
      headers,
      body: { text },
    };
  }

  describe('doGenerate', () => {
    it('should pass headers correctly', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
        headers: { 'Custom-Header': 'test-value' },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        authorization: 'Bearer test-token',
        'custom-header': 'test-value',
        'ai-transcription-model-specification-version': '4',
        'ai-model-id': 'openai/gpt-4o-transcribe',
      });
    });

    it('should include o11y headers', async () => {
      prepareJsonResponse();

      const o11yHeaders = {
        'ai-o11y-deployment-id': 'deployment-1',
        'ai-o11y-environment': 'production',
        'ai-o11y-region': 'iad1',
      } as const;

      await createTestModel({ o11yHeaders }).doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(server.calls[0].requestHeaders).toMatchObject(o11yHeaders);
    });

    it('should base64 encode byte audio in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
        providerOptions: { openai: { language: 'en' } },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        audio: 'AQID',
        mediaType: 'audio/wav',
        providerOptions: { openai: { language: 'en' } },
      });
    });

    it('should pass string audio through in request body', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/mpeg',
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        audio: 'base64-audio',
        mediaType: 'audio/mpeg',
      });
    });

    it('should extract transcript fields and metadata from response', async () => {
      server.urls['https://api.test.com/transcription-model'].response = {
        type: 'json-value',
        headers: { 'x-request-id': 'req-123' },
        body: {
          text: 'Hello world',
          segments: [
            { text: 'Hello', startSecond: 0, endSecond: 0.5 },
            { text: 'world', startSecond: 0.5, endSecond: 1 },
          ],
          language: 'en',
          durationInSeconds: 1,
          warnings: [{ type: 'other', message: 'test warning' }],
          providerMetadata: { gateway: { cost: '0.002' } },
        },
      };

      const result = await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(result).toMatchObject({
        text: 'Hello world',
        segments: [
          { text: 'Hello', startSecond: 0, endSecond: 0.5 },
          { text: 'world', startSecond: 0.5, endSecond: 1 },
        ],
        language: 'en',
        durationInSeconds: 1,
        warnings: [{ type: 'other', message: 'test warning' }],
        providerMetadata: { gateway: { cost: '0.002' } },
      });
      expect(result.response.headers?.['x-request-id']).toBe('req-123');
      expect(result.response.modelId).toBe('openai/gpt-4o-transcribe');
    });

    it('should default optional transcript fields', async () => {
      prepareJsonResponse();

      const result = await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(result.segments).toStrictEqual([]);
      expect(result.language).toBeUndefined();
      expect(result.durationInSeconds).toBeUndefined();
      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe('error handling', () => {
    it('should throw GatewayInvalidRequestError on 400', async () => {
      server.urls['https://api.test.com/transcription-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Invalid audio format',
            type: 'invalid_request_error',
          },
        }),
      };

      await expect(
        createTestModel().doGenerate({
          audio: 'base64-audio',
          mediaType: 'audio/wav',
        }),
      ).rejects.toSatisfy(
        err =>
          GatewayInvalidRequestError.isInstance(err) && err.statusCode === 400,
      );
    });

    it('should throw GatewayInternalServerError on 500', async () => {
      server.urls['https://api.test.com/transcription-model'].response = {
        type: 'error',
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Internal server error',
            type: 'internal_server_error',
          },
        }),
      };

      await expect(
        createTestModel().doGenerate({
          audio: 'base64-audio',
          mediaType: 'audio/wav',
        }),
      ).rejects.toSatisfy(
        err =>
          GatewayInternalServerError.isInstance(err) && err.statusCode === 500,
      );
    });
  });

  describe('URL construction', () => {
    it('should post to /transcription-model endpoint', async () => {
      prepareJsonResponse();

      await createTestModel().doGenerate({
        audio: 'base64-audio',
        mediaType: 'audio/wav',
      });

      expect(server.calls[0].requestUrl).toBe(
        'https://api.test.com/transcription-model',
      );
    });
  });

  describe('doStream', () => {
    beforeEach(() => {
      MockWebSocket.instances = [];
    });

    it('should connect to the ws transcription-model URL with the model id in the query', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      expect(ws.url.toString()).toBe(
        'wss://api.test.com/transcription-model?ai-model-id=openai%2Fgpt-realtime-whisper',
      );

      ws.open();
      await flush();
      ws.message({ type: 'finish', text: '', segments: [] });
      await partsPromise;
    });

    it('should carry auth in the subprotocols', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      void result.stream.cancel();
      expect(MockWebSocket.instances[0].protocols).toEqual([
        'ai-gateway-transcription.v1',
        'ai-gateway-auth.test-token',
      ]);
    });

    it('should carry the team scope in the subprotocols when configured', async () => {
      const model = createStreamingTestModel({
        headers: () => ({
          Authorization: 'Bearer test-token',
          'ai-gateway-auth-method': 'api-key',
          'x-vercel-ai-gateway-team': 'my-team',
        }),
      });

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      void result.stream.cancel();
      expect(MockWebSocket.instances[0].protocols).toEqual([
        'ai-gateway-transcription.v1',
        'ai-gateway-auth.test-token',
        `ai-gateway-team.${Buffer.from('my-team').toString('base64url')}`,
      ]);
    });

    it('should derive the subprotocols from headers case-insensitively', async () => {
      const model = createStreamingTestModel({
        headers: () => ({
          AUTHORIZATION: 'Bearer test-token',
          'ai-gateway-auth-method': 'api-key',
          'X-Vercel-AI-Gateway-Team': 'team1',
        }),
      });

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      void result.stream.cancel();
      expect(MockWebSocket.instances[0].protocols).toEqual([
        'ai-gateway-transcription.v1',
        'ai-gateway-auth.test-token',
        `ai-gateway-team.${Buffer.from('team1').toString('base64url')}`,
      ]);
    });

    it('should pass the resolved headers to header-capable WebSocket implementations', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        headers: { 'Custom-Header': 'test-value' },
      });

      void result.stream.cancel();
      expect(MockWebSocket.instances[0].options?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
        'Custom-Header': 'test-value',
        'ai-transcription-model-specification-version': '4',
        'ai-model-id': 'openai/gpt-realtime-whisper',
      });
    });

    it('should strip undefined header values before passing headers to the WebSocket constructor', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        // `Record<string, string | undefined>` is the documented way to unset
        // a header; header-capable WebSocket implementations like `ws` throw
        // on undefined header values (ERR_HTTP_INVALID_HEADER_VALUE).
        headers: { 'Custom-Header': 'test-value', 'X-Unset-Header': undefined },
      });

      void result.stream.cancel();
      const headers = MockWebSocket.instances[0].options?.headers ?? {};
      expect(headers).not.toHaveProperty('X-Unset-Header');
      expect(Object.values(headers)).not.toContain(undefined);
      expect(headers).toMatchObject({ 'Custom-Header': 'test-value' });
    });

    it('should send the session start frame on open', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        providerOptions: { openai: { language: 'en' } },
        includeRawChunks: true,
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      expect(ws.send).not.toHaveBeenCalled();

      ws.open();
      await flush();

      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'transcription-stream.start',
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        providerOptions: { openai: { language: 'en' } },
        includeRawChunks: true,
      });
      expect(result.request).toEqual({
        body: {
          type: 'transcription-stream.start',
          inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
          providerOptions: { openai: { language: 'en' } },
          includeRawChunks: true,
        },
      });

      ws.message({ type: 'finish', text: '', segments: [] });
      await partsPromise;
    });

    it('should omit optional session start frame keys when undefined', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm' },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: 'transcription-stream.start',
        inputAudioFormat: { type: 'audio/pcm' },
      });

      ws.message({ type: 'finish', text: '', segments: [] });
      await partsPromise;
    });

    it('should split audio chunks larger than the maximum frame size', async () => {
      const model = createStreamingTestModel();
      // 150 KiB chunk => 64 KiB + 64 KiB + 22 KiB frames
      const bigChunk = new Uint8Array(150 * 1024).fill(7);

      const result = await model.doStream({
        audio: convertArrayToReadableStream<Uint8Array | string>([bigChunk]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      const binaryFrames = ws.send.mock.calls
        .map(call => call[0])
        .filter(data => data instanceof Uint8Array) as Uint8Array[];
      expect(binaryFrames.map(frame => frame.length)).toEqual([
        64 * 1024,
        64 * 1024,
        22 * 1024,
      ]);
      expect(
        binaryFrames.reduce((total, frame) => total + frame.length, 0),
      ).toBe(bigChunk.length);

      ws.message({ type: 'finish', text: '', segments: [] });
      await partsPromise;
    });

    it('should send audio as binary frames followed by audio-done', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream<Uint8Array | string>([
          new Uint8Array([1, 2, 3]),
          'BAUG', // base64 for [4, 5, 6]
        ]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      expect(ws.send.mock.calls[1][0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(ws.send.mock.calls[2][0]).toEqual(new Uint8Array([4, 5, 6]));
      expect(JSON.parse(ws.send.mock.calls[3][0])).toEqual({
        type: 'transcription-stream.audio-done',
      });

      ws.message({ type: 'finish', text: '', segments: [] });
      await partsPromise;
    });

    it('should relay stream parts and close the stream on finish', async () => {
      const testDate = new Date(0);
      const model = createStreamingTestModel({
        _internal: { currentDate: () => testDate },
      });

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      ws.message({
        type: 'stream-start',
        warnings: [{ type: 'other', message: 'test warning' }],
      });
      ws.message({ type: 'transcript-delta', id: 'seg-1', delta: 'Hel' });
      ws.message({ type: 'transcript-partial', id: 'seg-1', text: 'Hel' });
      ws.message({ type: 'transcript-final', id: 'seg-1', text: 'Hello' });
      ws.message({ type: 'raw', rawValue: { some: 'chunk' } });
      ws.message({
        type: 'finish',
        text: 'Hello',
        segments: [{ text: 'Hello', startSecond: 0, endSecond: 1 }],
        language: 'en',
      });

      await expect(partsPromise).resolves.toEqual([
        {
          type: 'stream-start',
          warnings: [{ type: 'other', message: 'test warning' }],
        },
        { type: 'transcript-delta', id: 'seg-1', delta: 'Hel' },
        { type: 'transcript-partial', id: 'seg-1', text: 'Hel' },
        { type: 'transcript-final', id: 'seg-1', text: 'Hello' },
        { type: 'raw', rawValue: { some: 'chunk' } },
        {
          type: 'finish',
          text: 'Hello',
          segments: [{ text: 'Hello', startSecond: 0, endSecond: 1 }],
          language: 'en',
        },
      ]);
      expect(ws.close).toHaveBeenCalledWith(1000);
      expect(result.response).toEqual({
        timestamp: testDate,
        modelId: 'openai/gpt-realtime-whisper',
      });
    });

    it('should revive response-metadata timestamps to Date', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      ws.message({
        type: 'response-metadata',
        timestamp: '2026-01-01T00:00:00.000Z',
        modelId: 'openai/gpt-realtime-whisper',
      });
      ws.message({ type: 'finish', text: '', segments: [] });

      const parts = await partsPromise;
      expect(parts[0]).toEqual({
        type: 'response-metadata',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        modelId: 'openai/gpt-realtime-whisper',
      });
    });

    it('should ignore unknown server part types (forward compat)', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      ws.message({ type: 'some-future-part', payload: 42 });
      ws.message({ type: 'transcript-delta', id: 'seg-1', delta: 'Hel' });
      ws.message({ type: 'finish', text: 'Hel', segments: [] });

      await expect(partsPromise).resolves.toEqual([
        { type: 'transcript-delta', id: 'seg-1', delta: 'Hel' },
        { type: 'finish', text: 'Hel', segments: [] },
      ]);
    });

    it('should relay error parts and surface the server message when the socket closes without finish', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const reader = result.stream.getReader();
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      ws.message({ type: 'error', error: { message: 'model overloaded' } });
      await expect(reader.read()).resolves.toEqual({
        done: false,
        value: { type: 'error', error: { message: 'model overloaded' } },
      });

      // the server terminates the socket after an error part
      ws.onclose?.({});
      await expect(reader.read()).rejects.toSatisfy(
        err =>
          GatewayError.isInstance(err) &&
          err.message.includes('model overloaded'),
      );
      expect(ws.close).toHaveBeenCalled();
    });

    it.each([
      ['authentication_error', GatewayAuthenticationError],
      ['invalid_request_error', GatewayInvalidRequestError],
      ['rate_limit_exceeded', GatewayRateLimitError],
    ] as const)(
      'should map %s error parts to the public gateway error class',
      async (errorType, errorClass) => {
        const model = createStreamingTestModel();

        const result = await model.doStream({
          audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
          inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        });

        const partsPromise = convertReadableStreamToArray(result.stream);
        const assertion = expect(partsPromise).rejects.toSatisfy(err =>
          errorClass.isInstance(err),
        );
        const ws = MockWebSocket.instances[0];
        ws.open();
        await flush();

        ws.message({
          type: 'error',
          error: { message: 'request rejected', type: errorType },
        });
        await flush();
        ws.onclose?.({});
        await assertion;
      },
    );

    it('should stop sending audio after a server error part while keeping the stream open until close', async () => {
      const model = createStreamingTestModel();
      let audioCancelled = false;
      const audio = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        cancel() {
          audioCancelled = true;
        },
      });

      const result = await model.doStream({
        audio,
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const reader = result.stream.getReader();
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      ws.message({ type: 'error', error: { message: 'model overloaded' } });
      await expect(reader.read()).resolves.toEqual({
        done: false,
        value: { type: 'error', error: { message: 'model overloaded' } },
      });

      // outbound audio stops on the terminal error part
      await vi.waitFor(() => expect(audioCancelled).toBe(true));
      const audioDoneFrames = ws.send.mock.calls.filter(
        call =>
          typeof call[0] === 'string' &&
          call[0].includes('transcription-stream.audio-done'),
      );
      expect(audioDoneFrames).toHaveLength(0);

      ws.onclose?.({});
      await expect(reader.read()).rejects.toSatisfy(
        err =>
          GatewayError.isInstance(err) &&
          err.message.includes('model overloaded'),
      );
    });

    it('should stringify non-object error part payloads in the terminal error', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      const assertion = expect(partsPromise).rejects.toSatisfy(
        err =>
          GatewayError.isInstance(err) &&
          err.message.includes('model overloaded'),
      );
      ws.message({ type: 'error', error: 'model overloaded' });
      await flush();
      ws.onclose?.({});
      await assertion;
    });

    it('should JSON-stringify object error part payloads without a message in the terminal error', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      const assertion = expect(partsPromise).rejects.toSatisfy(
        err =>
          GatewayError.isInstance(err) &&
          err.message.includes('{"code":"overloaded"}') &&
          !err.message.includes('[object Object]'),
      );
      ws.message({ type: 'error', error: { code: 'overloaded' } });
      await flush();
      ws.onclose?.({});
      await assertion;
    });

    it('should error the stream with the generic message when the socket closes without finish or error part', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      const assertion = expect(partsPromise).rejects.toSatisfy(
        err =>
          GatewayError.isInstance(err) &&
          err.message.includes(
            'AI Gateway transcription stream closed before a finish part was received',
          ),
      );
      ws.onclose?.({});
      await assertion;
    });

    it('should error the stream with a GatewayError on connection errors', async () => {
      const model = createStreamingTestModel();

      const result = await model.doStream({
        audio: convertArrayToReadableStream([new Uint8Array([1, 2, 3])]),
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.onerror?.({});

      await expect(partsPromise).rejects.toSatisfy(
        err =>
          GatewayError.isInstance(err) &&
          err.message.includes(
            'Connection error on AI Gateway transcription stream',
          ),
      );
      expect(ws.close).toHaveBeenCalled();
    });

    it('should cancel the audio stream when the connection fails before open', async () => {
      const model = createStreamingTestModel();

      const audioCancel = vi.fn();
      const audio = new ReadableStream<Uint8Array>({
        cancel: audioCancel,
      });

      const result = await model.doStream({
        audio,
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];

      // handshake failure: onerror fires without the socket ever opening
      const assertion = expect(partsPromise).rejects.toSatisfy(err =>
        GatewayError.isInstance(err),
      );
      ws.onerror?.({});
      await flush();

      await assertion;
      expect(audioCancel).toHaveBeenCalled();
      expect(ws.close).toHaveBeenCalled();
    });

    it('should close the WebSocket and stop reading audio on abort', async () => {
      const model = createStreamingTestModel();
      const abortController = new AbortController();

      let audioCancelled = false;
      const audio = new ReadableStream<Uint8Array>({
        cancel() {
          audioCancelled = true;
        },
      });

      const result = await model.doStream({
        audio,
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        abortSignal: abortController.signal,
      });

      const partsPromise = convertReadableStreamToArray(result.stream);
      const ws = MockWebSocket.instances[0];
      ws.open();
      await flush();

      const abortReason = new Error('user aborted');
      const assertion = expect(partsPromise).rejects.toBe(abortReason);
      abortController.abort(abortReason);
      await flush();

      await assertion;
      expect(ws.close).toHaveBeenCalled();
      expect(audioCancelled).toBe(true);
    });

    it('should close the WebSocket and stop reading audio when the stream is cancelled', async () => {
      const model = createStreamingTestModel();

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
      ws.open();
      await flush();

      await result.stream.cancel();
      await flush();

      expect(ws.close).toHaveBeenCalled();
      expect(audioCancelled).toBe(true);
    });
  });
});

describe('gateway.experimental_transcription', () => {
  const serverOnlyIt = typeof globalThis.window === 'undefined' ? it : it.skip;
  const MODEL = 'openai/gpt-realtime-whisper';

  serverOnlyIt('creates a transcription model from a model id', async () => {
    const { createGateway } = await import('./gateway-provider');
    const gateway = createGateway({ apiKey: 'vck_test-token' });
    const model = gateway.experimental_transcription(MODEL);
    expect(model.specificationVersion).toBe('v4');
    expect(model.modelId).toBe(MODEL);
    expect(model.provider).toBe('gateway');
  });

  serverOnlyIt(
    'mints a transcription-bound vcst_ client secret and returns it with the wss url',
    async () => {
      const { createGateway } = await import('./gateway-provider');
      let capturedMintUrl = '';
      const fetch = vi.fn(
        async (input: string | URL | Request, _init?: RequestInit) => {
          const url = input instanceof Request ? input.url : input.toString();
          capturedMintUrl = url;
          return new Response(
            JSON.stringify({ token: 'vcst_minted', expiresAt: 1_700_000_060 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        },
      );
      const mintGateway = createGateway({ apiKey: 'vck_test-token', fetch });

      const result = await mintGateway.experimental_transcription.getToken({
        model: MODEL,
        expiresAfterSeconds: 120,
      });

      // Minted token (not the raw key), and the mint hit the v1 route on the
      // gateway origin — not the transcription baseURL path (/v4/ai).
      expect(result.token).toBe('vcst_minted');
      expect(result.expiresAt).toBe(1_700_000_060);
      expect(result.url).toBe(
        'wss://ai-gateway.vercel.sh/v4/ai/transcription-model?ai-model-id=openai%2Fgpt-realtime-whisper',
      );
      expect(capturedMintUrl).toBe(
        'https://ai-gateway.vercel.sh/v1/realtime/client-secrets',
      );

      // The body binds the token to the transcription surface.
      const init = fetch.mock.calls[0]?.[1] as RequestInit;
      expect(JSON.parse(init.body as string)).toMatchObject({
        model: MODEL,
        routeKind: 'transcription',
        expiresIn: 120,
      });
      // Authenticated with the long-lived key.
      const sentHeaders = new Headers(init.headers);
      expect(sentHeaders.get('authorization')).toBe('Bearer vck_test-token');
    },
  );

  serverOnlyIt(
    'tolerates a null expiresAt from the mint endpoint and omits it from the result',
    async () => {
      const { createGateway } = await import('./gateway-provider');
      const fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({ token: 'vcst_minted', expiresAt: null }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      );
      const mintGateway = createGateway({ apiKey: 'vck_test-token', fetch });

      const result = await mintGateway.experimental_transcription.getToken({
        model: MODEL,
      });

      expect(result.token).toBe('vcst_minted');
      expect('expiresAt' in result).toBe(false);
    },
  );

  it('rejects minting (getToken) in browsers — the credential must stay server-side', async () => {
    const { createGateway } = await import('./gateway-provider');
    const gateway = createGateway({ apiKey: 'vck_test-token' });
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
    try {
      await expect(
        gateway.experimental_transcription.getToken({ model: MODEL }),
      ).rejects.toThrow(/must be minted server-side/);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'window', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });
});
