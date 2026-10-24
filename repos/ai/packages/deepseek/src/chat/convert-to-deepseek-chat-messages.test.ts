import { convertToDeepSeekChatMessages } from './convert-to-deepseek-chat-messages';
import { describe, it, expect } from 'vitest';

describe('convertToDeepSeekChatMessages', () => {
  describe('user messages', () => {
    it('should convert messages with only a text part to a string content', async () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-chat',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "warnings": [],
        }
      `);
    });

    it('should warn about unsupported file parts', async () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from([0, 1, 2, 3]).toString('base64'),
                },
                mediaType: 'image/png',
              },
            ],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-chat',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "warnings": [
            {
              "feature": "user message part type: file",
              "type": "unsupported",
            },
          ],
        }
      `);
    });

    it('should accept top-level-only mediaType without error and not read it (category D)', async () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from([0, 1, 2, 3]).toString('base64'),
                },
                mediaType: 'image',
              },
            ],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-chat',
      });

      expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(JSON.stringify(result.messages)).not.toContain('image');
      expect(JSON.stringify(result.messages)).not.toContain('mediaType');
    });
  });

  describe('tool calls', () => {
    it('should stringify arguments to tool calls', () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                input: { foo: 'bar123' },
                toolCallId: 'quux',
                toolName: 'thwomp',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'quux',
                toolName: 'thwomp',
                output: { type: 'json', value: { oof: '321rab' } },
              },
            ],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-chat',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "",
              "reasoning_content": undefined,
              "role": "assistant",
              "tool_calls": [
                {
                  "function": {
                    "arguments": "{"foo":"bar123"}",
                    "name": "thwomp",
                  },
                  "id": "quux",
                  "type": "function",
                },
              ],
            },
            {
              "content": "{"oof":"321rab"}",
              "role": "tool",
              "tool_call_id": "quux",
            },
          ],
          "warnings": [],
        }
      `);
    });

    it('should handle text output type in tool results', () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                input: { query: 'weather' },
                toolCallId: 'call-1',
                toolName: 'getWeather',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                output: { type: 'text', value: 'It is sunny today' },
              },
            ],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-chat',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "",
              "reasoning_content": undefined,
              "role": "assistant",
              "tool_calls": [
                {
                  "function": {
                    "arguments": "{"query":"weather"}",
                    "name": "getWeather",
                  },
                  "id": "call-1",
                  "type": "function",
                },
              ],
            },
            {
              "content": "It is sunny today",
              "role": "tool",
              "tool_call_id": "call-1",
            },
          ],
          "warnings": [],
        }
      `);
    });

    it('should support reasoning content in tool calls', () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: 'I think the tool will return the correct value.',
              },
              {
                type: 'tool-call',
                input: { foo: 'bar123' },
                toolCallId: 'quux',
                toolName: 'thwomp',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'quux',
                toolName: 'thwomp',
                output: { type: 'json', value: { oof: '321rab' } },
              },
            ],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-chat',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
            {
              "content": "",
              "reasoning_content": "I think the tool will return the correct value.",
              "role": "assistant",
              "tool_calls": [
                {
                  "function": {
                    "arguments": "{"foo":"bar123"}",
                    "name": "thwomp",
                  },
                  "id": "quux",
                  "type": "function",
                },
              ],
            },
            {
              "content": "{"oof":"321rab"}",
              "role": "tool",
              "tool_call_id": "quux",
            },
          ],
          "warnings": [],
        }
      `);
    });

    it('should filter out reasoning content from turns before the last user message', () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: 'I think the tool will return the correct value.',
              },
              {
                type: 'tool-call',
                input: { foo: 'bar123' },
                toolCallId: 'quux',
                toolName: 'thwomp',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'quux',
                toolName: 'thwomp',
                output: { type: 'json', value: { oof: '321rab' } },
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'Goodbye' }],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-chat',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
            {
              "content": "",
              "reasoning_content": undefined,
              "role": "assistant",
              "tool_calls": [
                {
                  "function": {
                    "arguments": "{"foo":"bar123"}",
                    "name": "thwomp",
                  },
                  "id": "quux",
                  "type": "function",
                },
              ],
            },
            {
              "content": "{"oof":"321rab"}",
              "role": "tool",
              "tool_call_id": "quux",
            },
            {
              "content": "Goodbye",
              "role": "user",
            },
          ],
          "warnings": [],
        }
      `);
    });
  });

  describe('deepseek-v4 thinking mode', () => {
    // V4 demands `reasoning_content` on every assistant turn — including ones
    // before the last user message. Stripping it like we do for R1 makes the
    // API reject multi-turn requests with "The `reasoning_content` in the
    // thinking mode must be passed back to the API."
    it('should preserve reasoning_content from prior turns for deepseek-v4', () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: 'I think the tool will return the correct value.',
              },
              {
                type: 'tool-call',
                input: { foo: 'bar123' },
                toolCallId: 'quux',
                toolName: 'thwomp',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'quux',
                toolName: 'thwomp',
                output: { type: 'json', value: { oof: '321rab' } },
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'Goodbye' }],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-v4-pro',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
            {
              "content": "",
              "reasoning_content": "I think the tool will return the correct value.",
              "role": "assistant",
              "tool_calls": [
                {
                  "function": {
                    "arguments": "{"foo":"bar123"}",
                    "name": "thwomp",
                  },
                  "id": "quux",
                  "type": "function",
                },
              ],
            },
            {
              "content": "{"oof":"321rab"}",
              "role": "tool",
              "tool_call_id": "quux",
            },
            {
              "content": "Goodbye",
              "role": "user",
            },
          ],
          "warnings": [],
        }
      `);
    });

    it('should back-fill empty reasoning_content for deepseek-v4 assistant messages with no reasoning part', () => {
      const result = convertToDeepSeekChatMessages({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hi there' }],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'Again' }],
          },
        ],
        responseFormat: undefined,
        modelId: 'deepseek-v4-pro',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
            {
              "content": "Hi there",
              "reasoning_content": "",
              "role": "assistant",
              "tool_calls": undefined,
            },
            {
              "content": "Again",
              "role": "user",
            },
          ],
          "warnings": [],
        }
      `);
    });
  });
});
