import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { describe, expect, it, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { ToolLoopAgent } from '../agent/tool-loop-agent';
import { DirectChatTransport } from './direct-chat-transport';

describe('DirectChatTransport', () => {
  describe('sendMessages', () => {
    let mockModel: MockLanguageModelV4;

    beforeEach(() => {
      mockModel = new MockLanguageModelV4({
        doStream: async () => {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-delta', id: '1', delta: ', ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 3,
                    noCache: 3,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 10,
                    text: 10,
                    reasoning: undefined,
                  },
                },
              },
            ]),
          };
        },
      });
    });

    it('should stream text response from agent', async () => {
      const agent = new ToolLoopAgent({ model: mockModel });
      const transport = new DirectChatTransport({ agent });

      const stream = await transport.sendMessages({
        chatId: 'chat-1',
        messageId: undefined,
        trigger: 'submit-message',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello!' }],
          },
        ],
        abortSignal: undefined,
      });

      const chunks: unknown[] = [];
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Check for text streaming chunks
      const textChunks = chunks.filter(
        (chunk: any) =>
          chunk.type === 'text-start' ||
          chunk.type === 'text-delta' ||
          chunk.type === 'text-end',
      );

      expect(textChunks.length).toBeGreaterThan(0);

      // Check we got text deltas with content
      const textDeltas = chunks.filter(
        (chunk: any) => chunk.type === 'text-delta',
      );
      expect(textDeltas).toMatchObject([
        { type: 'text-delta', delta: 'Hello' },
        { type: 'text-delta', delta: ', ' },
        { type: 'text-delta', delta: 'world!' },
      ]);
    });

    it('should pass abortSignal to agent', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      const mockModelWithCapture = new MockLanguageModelV4({
        doStream: async options => {
          receivedAbortSignal = options.abortSignal;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'test' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          };
        },
      });

      const agent = new ToolLoopAgent({ model: mockModelWithCapture });
      const transport = new DirectChatTransport({ agent });

      const abortController = new AbortController();

      const stream = await transport.sendMessages({
        chatId: 'chat-1',
        messageId: undefined,
        trigger: 'submit-message',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello!' }],
          },
        ],
        abortSignal: abortController.signal,
      });

      // Consume the stream
      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(receivedAbortSignal).toBe(abortController.signal);
    });

    it('should pass agent options to agent', async () => {
      let receivedProviderOptions: unknown;

      const mockModelWithCapture = new MockLanguageModelV4({
        doStream: async options => {
          receivedProviderOptions = options.providerOptions;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'test' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          };
        },
      });

      const agent = new ToolLoopAgent<{ customOption: string }>({
        model: mockModelWithCapture,
        prepareCall: ({ options, ...rest }) => ({
          ...rest,
          providerOptions: { custom: { value: options.customOption } },
        }),
      });

      const transport = new DirectChatTransport({
        agent,
        options: { customOption: 'test-value' },
      });

      const stream = await transport.sendMessages({
        chatId: 'chat-1',
        messageId: undefined,
        trigger: 'submit-message',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello!' }],
          },
        ],
        abortSignal: undefined,
      });

      // Consume the stream
      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(receivedProviderOptions).toMatchObject({
        custom: { value: 'test-value' },
      });
    });

    it('should apply UIMessageStreamOptions', async () => {
      const mockModelWithReasoning = new MockLanguageModelV4({
        doStream: async () => {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'reasoning-start', id: 'r1' },
              { type: 'reasoning-delta', id: 'r1', delta: 'thinking...' },
              { type: 'reasoning-end', id: 'r1' },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'result' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          };
        },
      });

      const agent = new ToolLoopAgent({ model: mockModelWithReasoning });

      // Test with sendReasoning: true
      const transportWithReasoning = new DirectChatTransport({
        agent,
        sendReasoning: true,
      });

      const stream = await transportWithReasoning.sendMessages({
        chatId: 'chat-1',
        messageId: undefined,
        trigger: 'submit-message',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello!' }],
          },
        ],
        abortSignal: undefined,
      });

      const chunks: unknown[] = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // With sendReasoning: true, we should see reasoning chunks
      const reasoningChunks = chunks.filter(
        (chunk: any) =>
          chunk.type === 'reasoning-start' ||
          chunk.type === 'reasoning-delta' ||
          chunk.type === 'reasoning-end',
      );
      expect(reasoningChunks.length).toBeGreaterThan(0);
    });

    it('should convert UI messages to model messages correctly', async () => {
      let receivedPrompt: unknown;

      const mockModelWithCapture = new MockLanguageModelV4({
        doStream: async options => {
          receivedPrompt = options.prompt;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          };
        },
      });

      const agent = new ToolLoopAgent({ model: mockModelWithCapture });
      const transport = new DirectChatTransport({ agent });

      const stream = await transport.sendMessages({
        chatId: 'chat-1',
        messageId: undefined,
        trigger: 'submit-message',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'First message' }],
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Assistant reply' }],
          },
          {
            id: 'msg-3',
            role: 'user',
            parts: [{ type: 'text', text: 'Second message' }],
          },
        ],
        abortSignal: undefined,
      });

      // Consume the stream
      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(receivedPrompt).toMatchObject([
        {
          role: 'user',
          content: [{ type: 'text', text: 'First message' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Assistant reply' }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Second message' }],
        },
      ]);
    });

    it('should throw error for invalid messages', async () => {
      const agent = new ToolLoopAgent({ model: mockModel });
      const transport = new DirectChatTransport({ agent });

      await expect(
        transport.sendMessages({
          chatId: 'chat-1',
          messageId: undefined,
          trigger: 'submit-message',
          messages: [
            {
              // Missing id - invalid message
              role: 'user',
              parts: [{ type: 'text', text: 'Hello!' }],
            },
          ] as any,
          abortSignal: undefined,
        }),
      ).rejects.toThrow();
    });
  });

  describe('reconnectToStream', () => {
    it('should return null', async () => {
      const mockModel = new MockLanguageModelV4({
        doStream: async () => {
          return {
            stream: convertArrayToReadableStream([]),
          };
        },
      });

      const agent = new ToolLoopAgent({ model: mockModel });
      const transport = new DirectChatTransport({ agent });

      const result = await transport.reconnectToStream({
        chatId: 'chat-1',
      });

      expect(result).toBeNull();
    });
  });
});
