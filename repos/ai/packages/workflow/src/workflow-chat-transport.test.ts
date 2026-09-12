/**
 * Tests for WorkflowChatTransport
 *
 * These tests focus on testing the transport's behavior through its options
 * and callback functions rather than complex mocking.
 */
import type { UIMessage } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowChatTransport } from './workflow-chat-transport.js';

describe('WorkflowChatTransport', () => {
  let mockFetch: ReturnType<typeof vi.fn> & typeof fetch;
  let transport: WorkflowChatTransport<UIMessage>;

  beforeEach(() => {
    mockFetch = vi.fn() as ReturnType<typeof vi.fn> & typeof fetch;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default fetch when not provided', () => {
      const transport = new WorkflowChatTransport();
      expect(transport).toBeDefined();
    });

    it('should use custom fetch when provided', () => {
      const customFetch = vi.fn();
      const transport = new WorkflowChatTransport({ fetch: customFetch });
      expect(transport).toBeDefined();
    });

    it('should accept and store callback functions', () => {
      const onChatSendMessage = vi.fn();
      const onChatEnd = vi.fn();
      const prepareSendMessagesRequest = vi.fn();
      const prepareReconnectToStreamRequest = vi.fn();

      const transport = new WorkflowChatTransport({
        onChatSendMessage,
        onChatEnd,
        prepareSendMessagesRequest,
        prepareReconnectToStreamRequest,
      });

      expect(transport).toBeDefined();
    });

    it('should use default maxConsecutiveErrors of 3', () => {
      const transport = new WorkflowChatTransport();
      expect(transport).toBeDefined();
    });

    it('should accept custom maxConsecutiveErrors', () => {
      const transport = new WorkflowChatTransport({
        maxConsecutiveErrors: 5,
      });
      expect(transport).toBeDefined();
    });
  });

  describe('prepareSendMessagesRequest', () => {
    it('should use custom API endpoint when provided', async () => {
      const prepareSendMessagesRequest = vi.fn().mockResolvedValue({
        api: '/custom/chat',
        body: { custom: 'body' },
      });

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        prepareSendMessagesRequest,
      });

      // Mock a successful response with simple stream
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'x-workflow-run-id': 'test-workflow-123' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('data: {"type":"finish"}\n\n'),
            );
            controller.close();
          },
        }),
      });

      const messages = [] as UIMessage[];

      const stream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: 'test-chat',
        messages,
      });

      // Consume the stream to ensure fetch is called
      const reader = stream.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }

      expect(prepareSendMessagesRequest).toHaveBeenCalledWith({
        id: 'test-chat',
        messages,
        requestMetadata: undefined,
        body: undefined,
        credentials: undefined,
        headers: undefined,
        api: '/api/chat',
        trigger: 'submit-message',
        messageId: undefined,
      });

      expect(mockFetch).toHaveBeenCalledWith('/custom/chat', {
        method: 'POST',
        body: JSON.stringify({ custom: 'body' }),
        headers: undefined,
        credentials: undefined,
        signal: undefined,
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      transport = new WorkflowChatTransport({ fetch: mockFetch });
    });

    it('should handle response errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const stream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: 'test-chat',
        messages: [],
      });

      const reader = stream.getReader();
      await expect(reader.read()).rejects.toThrow(
        'Failed to fetch chat: 500 Internal Server Error',
      );
    });
  });

  describe('prepareReconnectToStreamRequest', () => {
    it('should use custom reconnect endpoint', async () => {
      const prepareReconnectToStreamRequest = vi.fn().mockResolvedValue({
        api: '/custom/reconnect',
        headers: { 'X-Custom': 'header' },
      });

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        prepareReconnectToStreamRequest,
      });

      // Mock a successful response with simple stream
      mockFetch.mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('data: {"type":"finish"}\n\n'),
            );
            controller.close();
          },
        }),
      });

      const stream = await transport.reconnectToStream({
        chatId: 'test-chat',
      });

      // Consume the stream
      const reader = stream!.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }

      expect(prepareReconnectToStreamRequest).toHaveBeenCalledWith({
        id: 'test-chat',
        requestMetadata: undefined,
        body: undefined,
        credentials: undefined,
        headers: undefined,
        api: '/api/chat/test-chat/stream',
      });

      expect(mockFetch).toHaveBeenCalledWith('/custom/reconnect?startIndex=0', {
        headers: { 'X-Custom': 'header' },
        credentials: undefined,
        signal: undefined,
      });
    });
  });

  describe('abort signal propagation', () => {
    it('should pass abortSignal to reconnect fetch calls', async () => {
      const controller = new AbortController();

      transport = new WorkflowChatTransport({ fetch: mockFetch });

      mockFetch.mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(streamController) {
            streamController.enqueue(
              new TextEncoder().encode('data: {"type":"finish"}\n\n'),
            );
            streamController.close();
          },
        }),
      });

      const stream = await transport.reconnectToStream({
        chatId: 'test-chat',
        abortSignal: controller.signal,
      });

      const reader = stream!.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat/test-chat/stream?startIndex=0',
        {
          headers: undefined,
          credentials: undefined,
          signal: controller.signal,
        },
      );
    });

    it('should reuse abortSignal for reconnect fetch after sendMessages interruption', async () => {
      const controller = new AbortController();

      transport = new WorkflowChatTransport({ fetch: mockFetch });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({
            'x-workflow-run-id': 'test-workflow-reconnect',
          }),
          body: new ReadableStream({
            start(streamController) {
              streamController.close();
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(streamController) {
              streamController.enqueue(
                new TextEncoder().encode('data: {"type":"finish"}\n\n'),
              );
              streamController.close();
            },
          }),
        });

      const stream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: 'test-chat',
        messages: [],
        abortSignal: controller.signal,
      });

      const reader = stream.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
        headers: undefined,
        credentials: undefined,
        signal: controller.signal,
      });
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/chat/test-workflow-reconnect/stream?startIndex=0',
        {
          headers: undefined,
          credentials: undefined,
          signal: controller.signal,
        },
      );
    });
  });

  describe('positive initialStartIndex', () => {
    function makeSSEStream(...events: string[]) {
      return new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(`data: ${event}\n\n`));
          }
          controller.close();
        },
      });
    }

    it('should adjust chunkIndex so retries resume from the correct position', async () => {
      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: 100,
      });

      // First call: starts at 100, stream disconnects after delivering 0 chunks
      // Second call: retry should resume from startIndex=100 (not 0)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          body: makeSSEStream(), // empty — simulates immediate disconnect
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          body: makeSSEStream('{"type":"finish"}'),
        });

      const stream = await transport.reconnectToStream({
        chatId: 'test-chat',
      });

      const reader = stream!.getReader();
      while (!(await reader.read()).done) {}

      // First call: positive startIndex
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/chat/test-chat/stream?startIndex=100',
        expect.any(Object),
      );
      // Second call: chunkIndex was set to 100, so retry resumes from 100
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/chat/test-chat/stream?startIndex=100',
        expect.any(Object),
      );
    });
  });

  describe('negative initialStartIndex', () => {
    function makeSSEStream(...events: string[]) {
      return new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(`data: ${event}\n\n`));
          }
          controller.close();
        },
      });
    }

    it('should resolve absolute chunkIndex from x-workflow-stream-tail-index header', async () => {
      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -20,
      });

      // First call: stream with tail-index header, closes immediately (simulating
      // a timeout with no data) -> triggers retry at the resolved absolute position
      // Second call: retry completes with finish
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({
            'x-workflow-stream-tail-index': '499',
          }),
          body: makeSSEStream(), // empty — simulates immediate disconnect
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          body: makeSSEStream('{"type":"finish"}'),
        });

      const stream = await transport.reconnectToStream({
        chatId: 'test-chat',
      });

      const reader = stream!.getReader();
      while (!(await reader.read()).done) {}

      // First call: negative startIndex
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/chat/test-chat/stream?startIndex=-20',
        expect.any(Object),
      );
      // Second call: resolved absolute position = max(0, 499 + 1 + (-20)) = 480
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/chat/test-chat/stream?startIndex=480',
        expect.any(Object),
      );
    });

    it('should fall back to startIndex=0 when header is missing', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -10,
      });

      // First call: no tail-index header, closes immediately -> triggers retry
      // Second call: retry should use startIndex=0
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          body: makeSSEStream(), // empty — simulates immediate disconnect
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          body: makeSSEStream('{"type":"finish"}'),
        });

      const stream = await transport.reconnectToStream({
        chatId: 'test-chat',
      });

      const reader = stream!.getReader();
      while (!(await reader.read()).done) {}

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Negative initialStartIndex is configured'),
      );

      // First call: negative startIndex
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/chat/test-chat/stream?startIndex=-10',
        expect.any(Object),
      );
      // Second call: falls back to 0
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/chat/test-chat/stream?startIndex=0',
        expect.any(Object),
      );

      warnSpy.mockRestore();
    });

    it('should fall back to startIndex=0 when header value is not a number', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -5,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({
            'x-workflow-stream-tail-index': 'not-a-number',
          }),
          body: makeSSEStream(),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          body: makeSSEStream('{"type":"finish"}'),
        });

      const stream = await transport.reconnectToStream({
        chatId: 'test-chat',
      });

      const reader = stream!.getReader();
      while (!(await reader.read()).done) {}

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('valid "x-workflow-stream-tail-index"'),
      );

      // Retry falls back to 0
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/chat/test-chat/stream?startIndex=0',
        expect.any(Object),
      );

      warnSpy.mockRestore();
    });
  });

  describe('orphan UI chunk filter on negative startIndex resume', () => {
    function makeSSEStream(...events: string[]) {
      return new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(`data: ${event}\n\n`));
          }
          controller.close();
        },
      });
    }

    async function collect(stream: ReadableStream<unknown>) {
      const reader = stream.getReader();
      const out: unknown[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out.push(value);
      }
      return out;
    }

    it('drops orphan reasoning-delta / reasoning-end when no prior reasoning-start', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -50,
      });

      // Reproduces the exact pattern from vercel/workflow#1835: a resume that
      // lands inside an open reasoning-0 part. The deltas + end for it should
      // be dropped; everything after the next start-step flows through.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-workflow-stream-tail-index': '99' }),
        body: makeSSEStream(
          '{"type":"reasoning-delta","id":"reasoning-0","delta":" space"}',
          '{"type":"reasoning-delta","id":"reasoning-0","delta":"."}',
          '{"type":"reasoning-end","id":"reasoning-0"}',
          '{"type":"finish-step"}',
          '{"type":"start-step"}',
          '{"type":"reasoning-start","id":"reasoning-1"}',
          '{"type":"reasoning-delta","id":"reasoning-1","delta":"hello"}',
          '{"type":"reasoning-end","id":"reasoning-1"}',
          '{"type":"finish"}',
        ),
      });

      const stream = await transport.reconnectToStream({ chatId: 'test-chat' });
      const chunks = (await collect(stream!)) as Array<{ type: string }>;

      expect(chunks.map(c => c.type)).toEqual([
        // orphan reasoning-0 deltas+end dropped
        'finish-step',
        'start-step',
        'reasoning-start',
        'reasoning-delta',
        'reasoning-end',
        'finish',
      ]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dropping orphan UI chunk'),
      );
      // Warning is emitted only once per resume even if multiple chunks drop.
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('drops orphan text-delta and text-end without a prior text-start', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -10,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-workflow-stream-tail-index': '50' }),
        body: makeSSEStream(
          '{"type":"text-delta","id":"text-0","delta":"orphan"}',
          '{"type":"text-end","id":"text-0"}',
          '{"type":"finish"}',
        ),
      });

      const stream = await transport.reconnectToStream({ chatId: 'test-chat' });
      const chunks = (await collect(stream!)) as Array<{ type: string }>;

      expect(chunks.map(c => c.type)).toEqual(['finish']);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('drops orphan tool-input-delta / tool-output-available without a prior tool-input-start', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -10,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-workflow-stream-tail-index': '50' }),
        body: makeSSEStream(
          '{"type":"tool-input-delta","toolCallId":"call_1","inputTextDelta":"x"}',
          '{"type":"tool-output-available","toolCallId":"call_1","output":{}}',
          '{"type":"finish"}',
        ),
      });

      const stream = await transport.reconnectToStream({ chatId: 'test-chat' });
      const chunks = (await collect(stream!)) as Array<{ type: string }>;

      expect(chunks.map(c => c.type)).toEqual(['finish']);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('passes through chunks whose *-start was emitted in the resumed window', async () => {
      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -10,
      });

      // tool-input-start IS in the resumed window, so its later
      // tool-output-available should pass through untouched.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-workflow-stream-tail-index': '50' }),
        body: makeSSEStream(
          '{"type":"tool-input-start","toolCallId":"call_1","toolName":"grep"}',
          '{"type":"tool-input-available","toolCallId":"call_1","toolName":"grep","input":{}}',
          '{"type":"tool-output-available","toolCallId":"call_1","output":{"ok":true}}',
          '{"type":"finish"}',
        ),
      });

      const stream = await transport.reconnectToStream({ chatId: 'test-chat' });
      const chunks = (await collect(stream!)) as Array<{ type: string }>;

      expect(chunks.map(c => c.type)).toEqual([
        'tool-input-start',
        'tool-input-available',
        'tool-output-available',
        'finish',
      ]);
    });

    it('recovers a tool call via a bare tool-input-available (no tool-input-start in the window)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: -10,
      });

      // The resume landed between tool-input-start and tool-input-available.
      // tool-input-available is self-contained (the AI SDK creates the part
      // from it directly), so it establishes the call id and the subsequent
      // tool-output-available must pass through instead of being dropped.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-workflow-stream-tail-index': '50' }),
        body: makeSSEStream(
          '{"type":"tool-input-available","toolCallId":"call_1","toolName":"grep","input":{}}',
          '{"type":"tool-output-available","toolCallId":"call_1","output":{"ok":true}}',
          '{"type":"finish"}',
        ),
      });

      const stream = await transport.reconnectToStream({ chatId: 'test-chat' });
      const chunks = (await collect(stream!)) as Array<{ type: string }>;

      expect(chunks.map(c => c.type)).toEqual([
        'tool-input-available',
        'tool-output-available',
        'finish',
      ]);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('does not activate on positive initialStartIndex (explicit caller choice)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        initialStartIndex: 100,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        body: makeSSEStream(
          '{"type":"reasoning-delta","id":"reasoning-0","delta":"x"}',
          '{"type":"finish"}',
        ),
      });

      const stream = await transport.reconnectToStream({ chatId: 'test-chat' });
      const chunks = (await collect(stream!)) as Array<{ type: string }>;

      // The orphan filter stays off; the stream normalizer repairs the
      // framing instead by synthesizing the missing reasoning-start.
      expect(chunks.map(c => c.type)).toEqual([
        'reasoning-start',
        'reasoning-delta',
        'finish',
      ]);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('does not activate the filter when startIndex is 0 (the default)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        // Default initialStartIndex = 0 → filter inactive.
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        body: makeSSEStream(
          '{"type":"reasoning-delta","id":"reasoning-0","delta":"x"}',
          '{"type":"finish"}',
        ),
      });

      const stream = await transport.reconnectToStream({ chatId: 'test-chat' });
      const chunks = (await collect(stream!)) as Array<{ type: string }>;

      // No orphan filtering; the stream normalizer synthesizes the missing
      // reasoning-start so the consumer still gets a well-formed stream.
      expect(chunks.map(c => c.type)).toEqual([
        'reasoning-start',
        'reasoning-delta',
        'finish',
      ]);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('reconnection error formatting', () => {
    it('should format object errors with JSON instead of [object Object]', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const transport = new WorkflowChatTransport({
        fetch: mockFetch,
        maxConsecutiveErrors: 1,
      });

      // Return a stream that throws a plain-object error on parse
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: new ReadableStream({
          start(controller) {
            // Send malformed data to trigger a parse error
            controller.enqueue(
              new TextEncoder().encode('data: INVALID_JSON\n\n'),
            );
            controller.close();
          },
        }),
      });

      const stream = await transport.reconnectToStream({
        chatId: 'test-chat',
      });

      const reader = stream!.getReader();
      await expect(reader.read()).rejects.toThrow(
        /Failed to reconnect after 1 consecutive errors/,
      );
      // Crucially, the error message should never contain [object Object]
      await expect(
        reader.read().catch((e: Error) => e.message),
      ).resolves.not.toContain?.('[object Object]');

      errorSpy.mockRestore();
    });
  });

  describe('callbacks', () => {
    it('should call onChatSendMessage callback', async () => {
      const onChatSendMessage = vi.fn();

      transport = new WorkflowChatTransport({
        fetch: mockFetch,
        onChatSendMessage,
      });

      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('data: {"type":"finish"}\n\n'),
            );
            controller.close();
          },
        }),
        headers: new Headers({
          'x-request-id': '123',
          'x-workflow-run-id': 'test-workflow-456',
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const messages = [] as UIMessage[];
      const options = {
        trigger: 'submit-message' as const,
        chatId: 'test-chat',
        messages,
      };

      const stream = await transport.sendMessages(options);

      // Consume the stream to ensure callbacks are called
      const reader = stream.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }

      expect(onChatSendMessage).toHaveBeenCalledWith(mockResponse, options);
    });

    it('should call onChatEnd callback when stream ends', async () => {
      const onChatEnd = vi.fn();

      transport = new WorkflowChatTransport({
        fetch: mockFetch,
        onChatEnd,
      });

      // Mock a successful response with a finish chunk
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'x-workflow-run-id': 'test-workflow-789' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('data: {"type":"finish"}\n\n'),
            );
            controller.close();
          },
        }),
      });

      const stream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: 'test-chat',
        messages: [],
      });

      // Consume the stream
      const reader = stream.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }

      // Give some time for the callback to be called
      await vi.advanceTimersByTimeAsync(100);

      expect(onChatEnd).toHaveBeenCalledWith({
        chatId: 'test-chat',
        chunkIndex: expect.any(Number),
      });
    });
  });
});
