import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import type { UIMessageChunk } from '../ui-message-stream/ui-message-chunks';
import { consumeStream } from '../util/consume-stream';
import { convertToModelMessages } from './convert-to-model-messages';
import {
  createStreamingUIMessageState,
  processUIMessageStream,
} from './process-ui-message-stream';
import type { UIMessage } from './ui-messages';

async function recordAssistantMessageFromChunks<
  UI_MESSAGE extends UIMessage = UIMessage,
>(chunks: UIMessageChunk[]): Promise<UI_MESSAGE> {
  const state = createStreamingUIMessageState<UI_MESSAGE>({
    messageId: 'msg-123',
    lastMessage: undefined,
  });

  await consumeStream({
    stream: processUIMessageStream<UI_MESSAGE>({
      stream: convertArrayToReadableStream(chunks),
      runUpdateMessageJob: async job => {
        await job({
          state,
          write: () => {},
        });
      },
      onError: error => {
        throw error;
      },
    }),
  });

  return state.message;
}

describe('convertToModelMessages', () => {
  describe('system message', () => {
    it('should convert a simple system message', async () => {
      const result = await convertToModelMessages([
        {
          role: 'system',
          parts: [{ text: 'System message', type: 'text' }],
        },
      ]);

      expect(result).toEqual([{ role: 'system', content: 'System message' }]);
    });

    it('should convert a system message with provider metadata', async () => {
      const result = await convertToModelMessages([
        {
          role: 'system',
          parts: [
            {
              text: 'System message with metadata',
              type: 'text',
              providerMetadata: { testProvider: { systemSignature: 'abc123' } },
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'system',
          content: 'System message with metadata',
          providerOptions: { testProvider: { systemSignature: 'abc123' } },
        },
      ]);
    });

    it('should merge provider metadata from multiple text parts in system message', async () => {
      const result = await convertToModelMessages([
        {
          role: 'system',
          parts: [
            {
              text: 'Part 1',
              type: 'text',
              providerMetadata: { provider1: { key1: 'value1' } },
            },
            {
              text: ' Part 2',
              type: 'text',
              providerMetadata: { provider2: { key2: 'value2' } },
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'system',
          content: 'Part 1 Part 2',
          providerOptions: {
            provider1: { key1: 'value1' },
            provider2: { key2: 'value2' },
          },
        },
      ]);
    });

    it('should convert a system message with Anthropic cache control metadata', async () => {
      const SYSTEM_PROMPT = 'You are a helpful assistant.';

      const systemMessage = {
        id: 'system',
        role: 'system' as const,
        parts: [
          {
            type: 'text' as const,
            text: SYSTEM_PROMPT,
            providerMetadata: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      };

      const result = await convertToModelMessages([systemMessage]);

      expect(result).toEqual([
        {
          role: 'system',
          content: SYSTEM_PROMPT,
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ]);
    });
  });

  describe('user message', () => {
    it('should convert a simple user message', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [{ text: 'Hello, AI!', type: 'text' }],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Hello, AI!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should convert a simple user message with provider metadata', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [
            {
              text: 'Hello, AI!',
              type: 'text',
              providerMetadata: { testProvider: { signature: '1234567890' } },
            },
          ],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "providerOptions": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "text": "Hello, AI!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should handle user message file parts', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              url: 'https://example.com/image.jpg',
            },
            { type: 'text', text: 'Check this image' },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.jpg'),
              },
            },
            { type: 'text', text: 'Check this image' },
          ],
        },
      ]);
    });

    it('should handle user message file parts with provider metadata', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              url: 'https://example.com/image.jpg',
              providerMetadata: { testProvider: { signature: '1234567890' } },
            },
            { type: 'text', text: 'Check this image' },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.jpg'),
              },
              providerOptions: { testProvider: { signature: '1234567890' } },
            },
            { type: 'text', text: 'Check this image' },
          ],
        },
      ]);
    });

    it('should include filename for user file parts when provided', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              url: 'https://example.com/image.jpg',
              filename: 'image.jpg',
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.jpg'),
              },
              filename: 'image.jpg',
            },
          ],
        },
      ]);
    });

    it('should use providerReference as data for user file parts', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              filename: 'doc.pdf',
              url: 'data:application/pdf;base64,abc',
              providerReference: { openai: 'file-abc123' },
            },
            { type: 'text', text: 'Summarize this' },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              filename: 'doc.pdf',
              data: {
                type: 'reference',
                reference: { openai: 'file-abc123' },
              },
            },
            { type: 'text', text: 'Summarize this' },
          ],
        },
      ]);
    });
  });

  it('should not include filename for user file parts when not provided', async () => {
    const result = await convertToModelMessages([
      {
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'image/jpeg',
            url: 'https://example.com/image.jpg',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image/jpeg',
            data: {
              type: 'url',
              url: new URL('https://example.com/image.jpg'),
            },
          },
        ],
      },
    ]);
  });

  describe('assistant message', () => {
    it('should convert custom assistant parts', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            {
              type: 'custom',
              kind: 'test-provider.compaction',
              providerMetadata: {
                openai: {
                  itemId: 'cmp_123',
                },
              },
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'custom',
              kind: 'test-provider.compaction',
              providerOptions: {
                openai: {
                  itemId: 'cmp_123',
                },
              },
            },
          ],
        },
      ] satisfies ModelMessage[]);
    });

    it('should convert a simple assistant text message', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hello, human!', state: 'done' }],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, human!' }],
        },
      ]);
    });

    it('should convert a simple assistant text message with provider metadata', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Hello, human!',
              state: 'done',
              providerMetadata: { testProvider: { signature: '1234567890' } },
            },
          ],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "providerOptions": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "text": "Hello, human!",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should convert an assistant message with reasoning', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: 'Thinking...',
              providerMetadata: {
                testProvider: {
                  signature: '1234567890',
                },
              },
              state: 'done',
            },
            {
              type: 'reasoning',
              text: 'redacted-data',
              providerMetadata: {
                testProvider: { isRedacted: true },
              },
              state: 'done',
            },
            { type: 'text', text: 'Hello, human!', state: 'done' },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'Thinking...',
              providerOptions: { testProvider: { signature: '1234567890' } },
            },
            {
              type: 'reasoning',
              text: 'redacted-data',
              providerOptions: { testProvider: { isRedacted: true } },
            },
            { type: 'text', text: 'Hello, human!' },
          ],
        },
      ] satisfies ModelMessage[]);
    });

    it('should convert an assistant message with file parts', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            {
              type: 'file',
              mediaType: 'image/png',
              url: 'data:image/png;base64,dGVzdA==',
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'url',
                url: new URL('data:image/png;base64,dGVzdA=='),
              },
            },
          ],
        },
      ] satisfies ModelMessage[]);
    });

    it('should include filename for assistant file parts when provided', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            {
              type: 'file',
              mediaType: 'image/png',
              url: 'data:image/png;base64,dGVzdA==',
              filename: 'test.png',
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'url',
                url: new URL('data:image/png;base64,dGVzdA=='),
              },
              filename: 'test.png',
            },
          ],
        },
      ] as unknown as ModelMessage[]);
    });

    it('should handle assistant message file parts with provider metadata', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            {
              type: 'file',
              mediaType: 'image/png',
              url: 'data:image/png;base64,dGVzdA==',
              providerMetadata: {
                testProvider: { signature: 'test-signature' },
              },
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'url',
                url: new URL('data:image/png;base64,dGVzdA=='),
              },
              providerOptions: {
                testProvider: { signature: 'test-signature' },
              },
            },
          ],
        },
      ] as unknown as ModelMessage[]);
    });

    it('should use providerReference as data for assistant file parts', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              filename: 'doc.pdf',
              url: 'data:application/pdf;base64,xyz',
              providerReference: { anthropic: 'file-xyz789' },
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              filename: 'doc.pdf',
              data: {
                type: 'reference',
                reference: { anthropic: 'file-xyz789' },
              },
            },
          ],
        },
      ] as unknown as ModelMessage[]);
    });

    it('should handle assistant message with tool output available', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'text',
              text: 'Let me calculate that for you.',
              state: 'done',
            },
            {
              type: 'tool-calculator',
              state: 'output-available',
              toolCallId: 'call1',
              input: { operation: 'add', numbers: [1, 2] },
              output: '3',
              callProviderMetadata: {
                testProvider: {
                  signature: '1234567890',
                },
              },
            },
          ],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Let me calculate that for you.",
                "type": "text",
              },
              {
                "input": {
                  "numbers": [
                    1,
                    2,
                  ],
                  "operation": "add",
                },
                "providerExecuted": undefined,
                "providerOptions": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "text",
                  "value": "3",
                },
                "providerOptions": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    describe('tool output error', () => {
      it('should handle assistant message with tool output error that has raw input', async () => {
        const result = await convertToModelMessages([
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'text',
                text: 'Let me calculate that for you.',
                state: 'done',
              },
              {
                type: 'tool-calculator',
                state: 'output-error',
                toolCallId: 'call1',
                errorText: 'Error: Invalid input',
                input: undefined,
                rawInput: { operation: 'add', numbers: [1, 2] },
              },
            ],
          },
        ]);

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Let me calculate that for you.",
                "type": "text",
              },
              {
                "input": {
                  "numbers": [
                    1,
                    2,
                  ],
                  "operation": "add",
                },
                "providerExecuted": undefined,
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "error-text",
                  "value": "Error: Invalid input",
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
      });

      it('should handle assistant message with tool output error that has no raw input', async () => {
        const result = await convertToModelMessages([
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'text',
                text: 'Let me calculate that for you.',
                state: 'done',
              },
              {
                type: 'tool-calculator',
                state: 'output-error',
                toolCallId: 'call1',
                input: { operation: 'add', numbers: [1, 2] },
                errorText: 'Error: Invalid input',
              },
            ],
          },
        ]);

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Let me calculate that for you.",
                "type": "text",
              },
              {
                "input": {
                  "numbers": [
                    1,
                    2,
                  ],
                  "operation": "add",
                },
                "providerExecuted": undefined,
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "error-text",
                  "value": "Error: Invalid input",
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
      });
    });

    it('should handle assistant message with provider-executed tool output available', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'text',
              text: 'Let me calculate that for you.',
              state: 'done',
            },
            {
              type: 'tool-calculator',
              state: 'output-available',
              toolCallId: 'call1',
              input: { operation: 'add', numbers: [1, 2] },
              output: '3',
              providerExecuted: true,
            },
          ],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Let me calculate that for you.",
                "type": "text",
              },
              {
                "input": {
                  "numbers": [
                    1,
                    2,
                  ],
                  "operation": "add",
                },
                "providerExecuted": true,
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-call",
              },
              {
                "output": {
                  "type": "text",
                  "value": "3",
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-result",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should handle assistant message with provider-executed tool output error', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'text',
              text: 'Let me calculate that for you.',
              state: 'done',
            },
            {
              type: 'tool-calculator',
              state: 'output-error',
              toolCallId: 'call1',
              input: { operation: 'add', numbers: [1, 2] },
              errorText: 'Error: Invalid input',
              providerExecuted: true,
            },
          ],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Let me calculate that for you.",
                "type": "text",
              },
              {
                "input": {
                  "numbers": [
                    1,
                    2,
                  ],
                  "operation": "add",
                },
                "providerExecuted": true,
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-call",
              },
              {
                "output": {
                  "type": "error-json",
                  "value": "Error: Invalid input",
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-result",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should propagate provider metadata to provider-executed tool-result', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-calculator',
              state: 'output-available',
              toolCallId: 'call1',
              input: { operation: 'multiply', numbers: [3, 4] },
              output: '12',
              providerExecuted: true,
              callProviderMetadata: {
                testProvider: {
                  executionTime: 75,
                },
              },
            },
          ],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "numbers": [
                    3,
                    4,
                  ],
                  "operation": "multiply",
                },
                "providerExecuted": true,
                "providerOptions": {
                  "testProvider": {
                    "executionTime": 75,
                  },
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-call",
              },
              {
                "output": {
                  "type": "text",
                  "value": "12",
                },
                "providerOptions": {
                  "testProvider": {
                    "executionTime": 75,
                  },
                },
                "toolCallId": "call1",
                "toolName": "calculator",
                "type": "tool-result",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should prefer result provider metadata over call provider metadata for provider-executed tool-result', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-calculator',
              state: 'output-available',
              toolCallId: 'call1',
              input: { operation: 'multiply', numbers: [3, 4] },
              output: '12',
              providerExecuted: true,
              callProviderMetadata: {
                testProvider: {
                  itemId: 'call-item',
                },
              },
              resultProviderMetadata: {
                testProvider: {
                  itemId: 'result-item',
                },
              },
            },
          ],
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call1',
              toolName: 'calculator',
              input: {
                operation: 'multiply',
                numbers: [3, 4],
              },
              providerExecuted: true,
              providerOptions: {
                testProvider: {
                  itemId: 'call-item',
                },
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'call1',
              toolName: 'calculator',
              output: {
                type: 'text',
                value: '12',
              },
              providerOptions: {
                testProvider: {
                  itemId: 'result-item',
                },
              },
            },
          ],
        },
      ]);
    });

    it('should handle assistant message with tool invocations that have multi-part responses', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'text',
              text: 'Let me calculate that for you.',
              state: 'done',
            },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call1',
              input: {},
              output: 'imgbase64',
            },
          ],
        },
      ]);

      expect(result).toMatchSnapshot();
    });

    it('should handle conversation with an assistant message that has empty tool invocations', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [{ type: 'text', text: 'text1' }],
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'text2', state: 'done' }],
        },
      ]);

      expect(result).toMatchSnapshot();
    });

    it('should handle conversation with multiple tool invocations that have step information', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'response', state: 'done' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-1',
              input: { value: 'value-1' },
              output: 'result-1',
            },
            { type: 'step-start' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-2',
              input: { value: 'value-2' },
              output: 'result-2',
            },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-3',
              input: { value: 'value-3' },
              output: 'result-3',
            },
            { type: 'step-start' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-4',
              input: { value: 'value-4' },
              output: 'result-4',
            },
          ],
        },
      ]);

      expect(result).toMatchSnapshot();
    });

    it('should handle conversation with mix of tool invocations and text', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'i am gonna use tool1', state: 'done' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-1',
              input: { value: 'value-1' },
              output: 'result-1',
            },
            { type: 'step-start' },
            {
              type: 'text',
              text: 'i am gonna use tool2 and tool3',
              state: 'done',
            },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-2',
              input: { value: 'value-2' },
              output: 'result-2',
            },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-3',
              input: { value: 'value-3' },
              output: 'result-3',
            },
            { type: 'step-start' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-4',
              input: { value: 'value-4' },
              output: 'result-4',
            },
            { type: 'step-start' },
            { type: 'text', text: 'final response', state: 'done' },
          ],
        },
      ]);

      expect(result).toMatchSnapshot();
    });
  });

  describe('multiple messages', () => {
    it('should handle a conversation with multiple messages', async () => {
      const result = await convertToModelMessages([
        {
          role: 'user',
          parts: [{ type: 'text', text: "What's the weather like?" }],
        },
        {
          role: 'assistant',
          parts: [
            { type: 'text', text: "I'll check that for you.", state: 'done' },
          ],
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Thanks!' }],
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What's the weather like?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "text": "I'll check that for you.",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "text": "Thanks!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should handle conversation with multiple tool invocations and user message at the end', async () => {
      const result = await convertToModelMessages([
        {
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-1',
              input: { value: 'value-1' },
              output: 'result-1',
            },
            { type: 'step-start' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-2',
              input: { value: 'value-2' },
              output: 'result-2',
            },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-3',
              input: { value: 'value-3' },
              output: 'result-3',
            },
            { type: 'step-start' },
            {
              type: 'tool-screenshot',
              state: 'output-available',
              toolCallId: 'call-4',
              input: { value: 'value-4' },
              output: 'result-4',
            },
            { type: 'step-start' },
            { type: 'text', text: 'response', state: 'done' },
          ],
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Thanks!' }],
        },
      ]);

      expect(result).toMatchSnapshot();
    });
  });

  describe('error handling', () => {
    it('should throw an error for unhandled roles', async () => {
      await expect(async () => {
        await convertToModelMessages([
          {
            role: 'unknown' as any,
            parts: [{ text: 'unknown role message', type: 'text' }],
          },
        ]);
      }).rejects.toThrow('Unsupported role: unknown');
    });
  });

  describe('when ignoring incomplete tool calls', () => {
    it('should handle conversation with multiple tool invocations and user message at the end', async () => {
      const result = await convertToModelMessages(
        [
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-screenshot',
                state: 'output-available',
                toolCallId: 'call-1',
                input: { value: 'value-1' },
                output: 'result-1',
              },
              { type: 'step-start' },
              {
                type: 'tool-screenshot',
                state: 'input-streaming',
                toolCallId: 'call-2',
                input: { value: 'value-2' },
              },
              {
                type: 'tool-screenshot',
                state: 'input-available',
                toolCallId: 'call-3',
                input: { value: 'value-3' },
              },
              {
                type: 'dynamic-tool',
                toolName: 'tool-screenshot2',
                state: 'input-available',
                toolCallId: 'call-3',
                input: { value: 'value-3' },
              },
              { type: 'text', text: 'response', state: 'done' },
            ],
          },
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Thanks!' }],
          },
        ],
        { ignoreIncompleteToolCalls: true },
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "value-1",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "text",
                  "value": "result-1",
                },
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
          {
            "content": [
              {
                "text": "response",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "text": "Thanks!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('when converting dynamic tool invocations', () => {
    it('should convert a dynamic tool invocation', async () => {
      const result = await convertToModelMessages(
        [
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'screenshot',
                state: 'output-available',
                toolCallId: 'call-1',
                input: { value: 'value-1' },
                output: 'result-1',
              },
            ],
          },
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Thanks!' }],
          },
        ],
        { ignoreIncompleteToolCalls: true },
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "value-1",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "text",
                  "value": "result-1",
                },
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
          {
            "content": [
              {
                "text": "Thanks!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('when converting provider-executed dynamic tool invocations', () => {
    it('should convert a provider-executed dynamic tool invocation', async () => {
      const result = await convertToModelMessages(
        [
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'screenshot',
                state: 'output-available',
                toolCallId: 'call-1',
                input: { value: 'value-1' },
                output: 'result-1',
                providerExecuted: true,
                callProviderMetadata: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Thanks!' }],
          },
        ],
        { ignoreIncompleteToolCalls: true },
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "value-1",
                },
                "providerExecuted": true,
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                    "key-b": "test-value-2",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-call",
              },
              {
                "output": {
                  "type": "text",
                  "value": "result-1",
                },
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                    "key-b": "test-value-2",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-result",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "text": "Thanks!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should convert a denied provider-executed tool approval request with an execution-denied result', async () => {
      const result = await convertToModelMessages(
        [
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'screenshot',
                state: 'approval-responded',
                toolCallId: 'call-1',
                input: { value: 'value-1' },
                providerExecuted: true,
                callProviderMetadata: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                  },
                },
                approval: {
                  id: 'approval-1',
                  approved: false,
                  reason: 'User denied the request',
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Thanks!' }],
          },
        ],
        { ignoreIncompleteToolCalls: true },
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "value-1",
                },
                "providerExecuted": true,
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": false,
                "providerExecuted": true,
                "reason": "User denied the request",
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "reason": "User denied the request",
                  "type": "execution-denied",
                },
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "screenshot",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
          {
            "content": [
              {
                "text": "Thanks!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('when converting tool approval request responses', () => {
    it('should convert an approved tool approval request (static tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: true,
                id: 'approval-1',
                reason: undefined,
              },
              input: {
                city: 'Tokyo',
              },
              state: 'approval-responded',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": true,
                "providerExecuted": undefined,
                "reason": undefined,
                "type": "tool-approval-response",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should convert an approved tool approval request (dynamic tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: true,
                id: 'approval-1',
                reason: undefined,
              },
              input: {
                city: 'Tokyo',
              },
              state: 'approval-responded',
              toolCallId: 'call-1',
              type: 'dynamic-tool',
              toolName: 'weather',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": true,
                "providerExecuted": undefined,
                "reason": undefined,
                "type": "tool-approval-response",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should preserve automatic approval metadata for approved tool results', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            { type: 'step-start' },
            {
              approval: {
                approved: true,
                id: 'approval-1',
                isAutomatic: true,
                reason: 'trusted internal tool',
              },
              input: {
                city: 'Tokyo',
              },
              output: {
                weather: 'Sunny',
              },
              state: 'output-available',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": true,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": true,
                "providerExecuted": undefined,
                "reason": "trusted internal tool",
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "type": "json",
                  "value": {
                    "weather": "Sunny",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should convert a denied tool approval request and follow up text (static tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: false,
                id: 'approval-1',
                reason: "I don't want to approve this",
              },
              input: {
                city: 'Tokyo',
              },
              state: 'approval-responded',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
            { type: 'step-start' },
            {
              type: 'text',
              text: 'I was not able to retrieve the weather.',
              state: 'done',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": false,
                "providerExecuted": undefined,
                "reason": "I don't want to approve this",
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "reason": "I don't want to approve this",
                  "type": "execution-denied",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
          {
            "content": [
              {
                "text": "I was not able to retrieve the weather.",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should convert a denied tool approval request and follow up text (dynamic tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: false,
                id: 'approval-1',
                reason: "I don't want to approve this",
              },
              input: {
                city: 'Tokyo',
              },
              state: 'approval-responded',
              toolCallId: 'call-1',
              type: 'dynamic-tool',
              toolName: 'weather',
            },
            { type: 'step-start' },
            {
              type: 'text',
              text: 'I was not able to retrieve the weather.',
              state: 'done',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": false,
                "providerExecuted": undefined,
                "reason": "I don't want to approve this",
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "reason": "I don't want to approve this",
                  "type": "execution-denied",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
          {
            "content": [
              {
                "text": "I was not able to retrieve the weather.",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should convert tool output denied (static tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: false,
                id: 'approval-1',
                reason: "I don't want to approve this",
              },
              input: {
                city: 'Tokyo',
              },
              state: 'output-denied',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": false,
                "providerExecuted": undefined,
                "reason": "I don't want to approve this",
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "type": "error-text",
                  "value": "I don't want to approve this",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should convert tool output denied without approval (static tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          role: 'assistant',
          parts: [
            {
              input: {
                city: 'Tokyo',
              },
              state: 'output-denied',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
          ],
        },
      ] as unknown as UIMessage[]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "error-text",
                  "value": "Tool call execution denied.",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should convert tool output denied (dynamic tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: false,
                id: 'approval-1',
                reason: "I don't want to approve this",
              },
              input: {
                city: 'Tokyo',
              },
              state: 'output-denied',
              toolCallId: 'call-1',
              type: 'dynamic-tool',
              toolName: 'weather',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": false,
                "providerExecuted": undefined,
                "reason": "I don't want to approve this",
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "type": "error-text",
                  "value": "I don't want to approve this",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should convert tool output result with approval and follow up text (static tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            { type: 'step-start' },
            {
              approval: {
                approved: true,
                id: 'approval-1',
              },
              input: {
                city: 'Tokyo',
              },
              output: {
                weather: 'Sunny',
                temperature: '20°C',
              },
              state: 'output-available',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
            { type: 'step-start' },
            {
              type: 'text',
              text: 'The weather in Tokyo is sunny.',
              state: 'done',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": true,
                "providerExecuted": undefined,
                "reason": undefined,
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "type": "json",
                  "value": {
                    "temperature": "20°C",
                    "weather": "Sunny",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
          {
            "content": [
              {
                "text": "The weather in Tokyo is sunny.",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should propagate signature from approval to tool-approval-request part', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: true,
                id: 'a1',
                signature: 'test-sig',
              },
              input: {
                city: 'Tokyo',
              },
              state: 'approval-responded',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "a1",
                "isAutomatic": undefined,
                "signature": "test-sig",
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "a1",
                "approved": true,
                "providerExecuted": undefined,
                "reason": undefined,
                "type": "tool-approval-response",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should not include signature in tool-approval-request when approval has no signature', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            {
              type: 'step-start',
            },
            {
              approval: {
                approved: true,
                id: 'a1',
              },
              input: {
                city: 'Tokyo',
              },
              state: 'approval-responded',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
          ],
          role: 'assistant',
        },
      ]);

      const assistantMessage = result.find(m => m.role === 'assistant')!;
      const approvalRequest = (assistantMessage.content as any[]).find(
        (p: any) => p.type === 'tool-approval-request',
      );
      expect(approvalRequest).toBeDefined();
      expect(approvalRequest).not.toHaveProperty('signature');
    });

    it('should convert tool error result with approval and follow up text (static tool)', async () => {
      const result = await convertToModelMessages([
        {
          parts: [
            {
              text: 'What is the weather in Tokyo?',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          parts: [
            { type: 'step-start' },
            {
              approval: {
                approved: true,
                id: 'approval-1',
              },
              input: {
                city: 'Tokyo',
              },
              errorText: 'Error: Fetching weather data failed',
              state: 'output-error',
              toolCallId: 'call-1',
              type: 'tool-weather',
            },
            { type: 'step-start' },
            {
              type: 'text',
              text: 'The weather in Tokyo is sunny.',
              state: 'done',
            },
          ],
          role: 'assistant',
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "approvalId": "approval-1",
                "approved": true,
                "providerExecuted": undefined,
                "reason": undefined,
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "type": "error-text",
                  "value": "Error: Fetching weather data failed",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
          {
            "content": [
              {
                "text": "The weather in Tokyo is sunny.",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('data part conversion', () => {
    describe('in user messages', () => {
      it('should convert data parts to text when converter provided', async () => {
        const result = await convertToModelMessages<
          UIMessage<unknown, { url: { url: string; content: string } }>
        >(
          [
            {
              role: 'user',
              parts: [
                {
                  type: 'data-url',
                  data: { url: 'https://example.com', content: 'Article text' },
                },
              ],
            },
          ],
          {
            convertDataPart: part => ({
              type: 'text',
              text: `\n\n[${part.data.url}]\n${part.data.content}`,
            }),
          },
        );

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "

        [https://example.com]
        Article text",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
      });

      it('should skip data parts when no converter provided', async () => {
        const result = await convertToModelMessages([
          {
            role: 'user',
            parts: [
              { type: 'text', text: 'Hello' },
              { type: 'data-url', data: { url: 'https://example.com' } },
            ],
          },
        ]);

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Hello",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
      });

      it('should selectively convert data parts', async () => {
        const result = await convertToModelMessages<
          UIMessage<
            unknown,
            {
              url: { url: string };
              'ui-state': { enabled: boolean };
            }
          >
        >(
          [
            {
              role: 'user',
              parts: [
                { type: 'data-url', data: { url: 'https://example.com' } },
                { type: 'data-ui-state', data: { enabled: true } },
              ],
            },
          ],
          {
            convertDataPart: part => {
              // Include URLs, skip UI state
              if (part.type === 'data-url') {
                return { type: 'text', text: part.data.url };
              }
            },
          },
        );

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "https://example.com",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
      });

      it('should convert data parts to file parts', async () => {
        const result = await convertToModelMessages<
          UIMessage<
            unknown,
            {
              attachment: { mediaType: string; filename: string; data: string };
            }
          >
        >(
          [
            {
              role: 'user',
              parts: [
                { type: 'text', text: 'Check this file' },
                {
                  type: 'data-attachment',
                  data: {
                    mediaType: 'application/pdf',
                    filename: 'document.pdf',
                    data: 'base64data',
                  },
                },
              ],
            },
          ],
          {
            convertDataPart: part => {
              if (part.type === 'data-attachment') {
                return {
                  type: 'file',
                  mediaType: part.data.mediaType,
                  filename: part.data.filename,
                  data: part.data.data,
                };
              }
            },
          },
        );

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Check this file",
                "type": "text",
              },
              {
                "data": "base64data",
                "filename": "document.pdf",
                "mediaType": "application/pdf",
                "type": "file",
              },
            ],
            "role": "user",
          },
        ]
      `);
      });

      it('should handle multiple data parts of different types', async () => {
        const result = await convertToModelMessages<
          UIMessage<
            never,
            {
              url: { url: string; title: string };
              code: { code: string; language: string };
              note: { text: string };
            }
          >
        >(
          [
            {
              role: 'user',
              parts: [
                { type: 'text', text: 'Review these:' },
                {
                  type: 'data-url',
                  data: { url: 'https://example.com', title: 'Example' },
                },
                {
                  type: 'data-code',
                  data: { code: 'console.log("test")', language: 'javascript' },
                },
                {
                  type: 'data-note',
                  data: { text: 'Internal note' },
                },
              ],
            },
          ],
          {
            convertDataPart: part => {
              switch (part.type) {
                case 'data-url':
                  return {
                    type: 'text',
                    text: `[${part.data.title}](${part.data.url})`,
                  };
                case 'data-code':
                  return {
                    type: 'text',
                    text: `\`\`\`${part.data.language}\n${part.data.code}\n\`\`\``,
                  };
              }
            },
          },
        );

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Review these:",
                "type": "text",
              },
              {
                "text": "[Example](https://example.com)",
                "type": "text",
              },
              {
                "text": "\`\`\`javascript
        console.log("test")
        \`\`\`",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
      });

      it('should work with messages that have no data parts', async () => {
        const result = await convertToModelMessages(
          [
            {
              role: 'user',
              parts: [
                { type: 'text', text: 'Hello' },
                {
                  type: 'file',
                  mediaType: 'image/png',
                  url: 'https://example.com/image.png',
                },
              ],
            },
          ],
          {
            convertDataPart: () => ({ type: 'text', text: 'converted' }),
          },
        );

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
                {
                  "data": {
                    "type": "url",
                    "url": "https://example.com/image.png",
                  },
                  "filename": undefined,
                  "mediaType": "image/png",
                  "type": "file",
                },
              ],
              "role": "user",
            },
          ]
        `);
      });

      it('should preserve order of parts including converted data parts', async () => {
        const result = await convertToModelMessages<
          UIMessage<unknown, { tag: { value: string } }>
        >(
          [
            {
              role: 'user',
              parts: [
                { type: 'text', text: 'First' },
                { type: 'data-tag', data: { value: 'tag1' } },
                { type: 'text', text: 'Second' },
                { type: 'data-tag', data: { value: 'tag2' } },
                { type: 'text', text: 'Third' },
              ],
            },
          ],
          {
            convertDataPart: part => ({
              type: 'text',
              text: `[${part.data.value}]`,
            }),
          },
        );

        expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "First",
                "type": "text",
              },
              {
                "text": "[tag1]",
                "type": "text",
              },
              {
                "text": "Second",
                "type": "text",
              },
              {
                "text": "[tag2]",
                "type": "text",
              },
              {
                "text": "Third",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
      });
    });

    describe('in assistant messages', () => {
      it('should convert data parts to text when converter provided', async () => {
        const result = await convertToModelMessages<
          UIMessage<unknown, { url: { url: string; content: string } }>
        >(
          [
            {
              role: 'assistant',
              parts: [
                {
                  type: 'data-url',
                  data: { url: 'https://example.com', content: 'Article text' },
                },
              ],
            },
          ],
          {
            convertDataPart: part => ({
              type: 'text',
              text: `\n\n[${part.data.url}]\n${part.data.content}`,
            }),
          },
        );

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "

          [https://example.com]
          Article text",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should skip data parts when no converter provided', async () => {
        const result = await convertToModelMessages([
          {
            role: 'assistant',
            parts: [
              { type: 'text', text: 'Hello' },
              { type: 'data-url', data: { url: 'https://example.com' } },
            ],
          },
        ]);

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should not emit empty assistant message for persistent data written before model stream starts', async () => {
        type WeatherUIMessage = UIMessage<
          unknown,
          {
            weather: {
              city: string;
              status: 'loading' | 'success';
              weather?: string;
            };
          }
        >;

        const recordedMessage =
          await recordAssistantMessageFromChunks<WeatherUIMessage>([
            { type: 'start', messageId: 'msg-123' },
            {
              type: 'data-weather',
              id: 'weather-1',
              data: { city: 'San Francisco', status: 'loading' },
            },
            { type: 'start-step' },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'It is sunny.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish-step' },
            { type: 'finish' },
          ]);

        expect(recordedMessage).toMatchInlineSnapshot(`
          {
            "id": "msg-123",
            "metadata": undefined,
            "parts": [
              {
                "data": {
                  "city": "San Francisco",
                  "status": "loading",
                },
                "id": "weather-1",
                "type": "data-weather",
              },
              {
                "type": "step-start",
              },
              {
                "providerMetadata": undefined,
                "state": "done",
                "text": "It is sunny.",
                "type": "text",
              },
            ],
            "role": "assistant",
          }
        `);

        const result = await convertToModelMessages([recordedMessage]);

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "It is sunny.",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should selectively convert data parts', async () => {
        const result = await convertToModelMessages<
          UIMessage<
            unknown,
            {
              url: { url: string };
              'ui-state': { enabled: boolean };
            }
          >
        >(
          [
            {
              role: 'assistant',
              parts: [
                { type: 'data-url', data: { url: 'https://example.com' } },
                { type: 'data-ui-state', data: { enabled: true } },
              ],
            },
          ],
          {
            convertDataPart: part => {
              // Include URLs, skip UI state
              if (part.type === 'data-url') {
                return { type: 'text', text: part.data.url };
              }
            },
          },
        );

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "https://example.com",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should convert data parts to file parts', async () => {
        const result = await convertToModelMessages<
          UIMessage<
            unknown,
            {
              attachment: { mediaType: string; filename: string; data: string };
            }
          >
        >(
          [
            {
              role: 'assistant',
              parts: [
                { type: 'text', text: 'Check this file' },
                {
                  type: 'data-attachment',
                  data: {
                    mediaType: 'application/pdf',
                    filename: 'document.pdf',
                    data: 'base64data',
                  },
                },
              ],
            },
          ],
          {
            convertDataPart: part => {
              if (part.type === 'data-attachment') {
                return {
                  type: 'file',
                  mediaType: part.data.mediaType,
                  filename: part.data.filename,
                  data: part.data.data,
                };
              }
            },
          },
        );

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Check this file",
                  "type": "text",
                },
                {
                  "data": "base64data",
                  "filename": "document.pdf",
                  "mediaType": "application/pdf",
                  "type": "file",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should handle multiple data parts of different types', async () => {
        const result = await convertToModelMessages<
          UIMessage<
            never,
            {
              url: { url: string; title: string };
              code: { code: string; language: string };
              note: { text: string };
            }
          >
        >(
          [
            {
              role: 'assistant',
              parts: [
                { type: 'text', text: 'Review these:' },
                {
                  type: 'data-url',
                  data: { url: 'https://example.com', title: 'Example' },
                },
                {
                  type: 'data-code',
                  data: { code: 'console.log("test")', language: 'javascript' },
                },
                {
                  type: 'data-note',
                  data: { text: 'Internal note' },
                },
              ],
            },
          ],
          {
            convertDataPart: part => {
              switch (part.type) {
                case 'data-url':
                  return {
                    type: 'text',
                    text: `[${part.data.title}](${part.data.url})`,
                  };
                case 'data-code':
                  return {
                    type: 'text',
                    text: `\`\`\`${part.data.language}\n${part.data.code}\n\`\`\``,
                  };
              }
            },
          },
        );

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Review these:",
                  "type": "text",
                },
                {
                  "text": "[Example](https://example.com)",
                  "type": "text",
                },
                {
                  "text": "\`\`\`javascript
          console.log("test")
          \`\`\`",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should work with messages that have no data parts', async () => {
        const result = await convertToModelMessages(
          [
            {
              role: 'assistant',
              parts: [
                { type: 'text', text: 'Hello' },
                {
                  type: 'file',
                  mediaType: 'image/png',
                  url: 'https://example.com/image.png',
                },
              ],
            },
          ],
          {
            convertDataPart: () => ({ type: 'text', text: 'converted' }),
          },
        );

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
                {
                  "data": {
                    "type": "url",
                    "url": "https://example.com/image.png",
                  },
                  "filename": undefined,
                  "mediaType": "image/png",
                  "type": "file",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should preserve order of parts including converted data parts', async () => {
        const result = await convertToModelMessages<
          UIMessage<unknown, { tag: { value: string } }>
        >(
          [
            {
              role: 'assistant',
              parts: [
                { type: 'text', text: 'First' },
                { type: 'data-tag', data: { value: 'tag1' } },
                { type: 'text', text: 'Second' },
                { type: 'data-tag', data: { value: 'tag2' } },
                { type: 'text', text: 'Third' },
              ],
            },
          ],
          {
            convertDataPart: part => ({
              type: 'text',
              text: `[${part.data.value}]`,
            }),
          },
        );

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "First",
                  "type": "text",
                },
                {
                  "text": "[tag1]",
                  "type": "text",
                },
                {
                  "text": "Second",
                  "type": "text",
                },
                {
                  "text": "[tag2]",
                  "type": "text",
                },
                {
                  "text": "Third",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });
  });
});
