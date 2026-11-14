import { convertToOpenResponsesInput } from './convert-to-open-responses-input';
import { describe, it, expect } from 'vitest';

describe('convertToOpenResponsesInput', () => {
  describe('system messages', () => {
    it('should convert a single system message to instructions', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
        ],
      });

      expect(result.instructions).toBe('You are a helpful assistant.');
      expect(result.input).toEqual([]);
    });

    it('should join multiple system messages with newlines', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'system',
            content: 'Always be concise.',
          },
        ],
      });

      expect(result.instructions).toBe(
        'You are a helpful assistant.\nAlways be concise.',
      );
      expect(result.input).toEqual([]);
    });

    it('should return undefined instructions when no system messages', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      });

      expect(result.instructions).toBeUndefined();
    });

    it('should handle system message with user and assistant messages', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hi there!' }],
          },
        ],
      });

      expect(result.instructions).toBe('You are a helpful assistant.');
      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Hello",
                "type": "input_text",
              },
            ],
            "role": "user",
            "type": "message",
          },
          {
            "content": [
              {
                "text": "Hi there!",
                "type": "output_text",
              },
            ],
            "role": "assistant",
            "type": "message",
          },
        ]
      `);
    });
  });

  describe('user messages', () => {
    it('should convert messages with only a text part to a string content', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Hello",
                "type": "input_text",
              },
            ],
            "role": "user",
            "type": "message",
          },
        ]
      `);
    });

    it('should convert image file parts with base64 data to input_image', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: 'ZmFrZS1kYXRh' },
                mediaType: 'image/png',
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "image_url": "data:image/png;base64,ZmFrZS1kYXRh",
                "type": "input_image",
              },
            ],
            "role": "user",
            "type": "message",
          },
        ]
      `);
    });

    it('should convert image file parts with URL data to input_image', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: {
                  type: 'url' as const,
                  url: new URL('https://example.com/image.png'),
                },
                mediaType: 'image/png',
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "image_url": "https://example.com/image.png",
                "type": "input_image",
              },
            ],
            "role": "user",
            "type": "message",
          },
        ]
      `);
    });

    it('should convert PDF file parts with base64 data to input_file', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What does this PDF say?' },
              {
                type: 'file',
                data: { type: 'data' as const, data: 'UERGREFUQQ==' },
                mediaType: 'application/pdf',
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What does this PDF say?",
                "type": "input_text",
              },
              {
                "file_data": "data:application/pdf;base64,UERGREFUQQ==",
                "filename": "data",
                "type": "input_file",
              },
            ],
            "role": "user",
            "type": "message",
          },
        ]
      `);
      expect(result.warnings).toEqual([]);
    });

    it('should convert PDF file parts with URL data to input_file', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: {
                  type: 'url' as const,
                  url: new URL('https://example.com/document.pdf'),
                },
                mediaType: 'application/pdf',
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "file_url": "https://example.com/document.pdf",
                "type": "input_file",
              },
            ],
            "role": "user",
            "type": "message",
          },
        ]
      `);
      expect(result.warnings).toEqual([]);
    });

    it('should use provided filename for non-image file parts', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: 'UERGREFUQQ==' },
                mediaType: 'application/pdf',
                filename: 'report.pdf',
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "file_data": "data:application/pdf;base64,UERGREFUQQ==",
                "filename": "report.pdf",
                "type": "input_file",
              },
            ],
            "role": "user",
            "type": "message",
          },
        ]
      `);
    });
  });

  describe('assistant messages', () => {
    it('should convert messages with only a text part to output_text content', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello from assistant' }],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Hello from assistant",
                "type": "output_text",
              },
            ],
            "role": "assistant",
            "type": "message",
          },
        ]
      `);
    });

    it('should convert messages with multiple text parts', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'First part' },
              { type: 'text', text: 'Second part' },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "First part",
                "type": "output_text",
              },
              {
                "text": "Second part",
                "type": "output_text",
              },
            ],
            "role": "assistant",
            "type": "message",
          },
        ]
      `);
    });
  });

  describe('assistant messages with tool calls', () => {
    it('should convert assistant message with a single tool-call', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_123',
                toolName: 'get_weather',
                input: { location: 'San Francisco' },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "arguments": "{"location":"San Francisco"}",
            "call_id": "call_123",
            "name": "get_weather",
            "type": "function_call",
          },
        ]
      `);
    });

    it('should pass through tool-call string input', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_124',
                toolName: 'get_weather',
                input: '{"location":"Berlin"}',
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "arguments": "{\"location\":\"Berlin\"}",
            "call_id": "call_124",
            "name": "get_weather",
            "type": "function_call",
          },
        ]
      `);
    });

    it('should convert assistant message with text and tool-call', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me check the weather for you.' },
              {
                type: 'tool-call',
                toolCallId: 'call_456',
                toolName: 'get_weather',
                input: { location: 'New York' },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Let me check the weather for you.",
                "type": "output_text",
              },
            ],
            "role": "assistant",
            "type": "message",
          },
          {
            "arguments": "{"location":"New York"}",
            "call_id": "call_456",
            "name": "get_weather",
            "type": "function_call",
          },
        ]
      `);
    });

    it('should convert assistant message with multiple tool-calls', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_001',
                toolName: 'get_weather',
                input: { location: 'Paris' },
              },
              {
                type: 'tool-call',
                toolCallId: 'call_002',
                toolName: 'get_time',
                input: { timezone: 'Europe/Paris' },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "arguments": "{"location":"Paris"}",
            "call_id": "call_001",
            "name": "get_weather",
            "type": "function_call",
          },
          {
            "arguments": "{"timezone":"Europe/Paris"}",
            "call_id": "call_002",
            "name": "get_time",
            "type": "function_call",
          },
        ]
      `);
    });
  });

  describe('tool messages', () => {
    it('should convert tool message with json output', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_123',
                toolName: 'get_weather',
                output: {
                  type: 'json',
                  value: { temperature: 72, condition: 'sunny' },
                },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "call_id": "call_123",
            "output": "{"temperature":72,"condition":"sunny"}",
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should convert tool message with text output', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_456',
                toolName: 'search',
                output: {
                  type: 'text',
                  value: 'Search results: Found 5 items',
                },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "call_id": "call_456",
            "output": "Search results: Found 5 items",
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should convert tool message with error-text output', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_789',
                toolName: 'api_call',
                output: {
                  type: 'error-text',
                  value: 'API request failed: timeout',
                },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "call_id": "call_789",
            "output": "API request failed: timeout",
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should convert tool message with execution-denied output', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_denied',
                toolName: 'dangerous_action',
                output: {
                  type: 'execution-denied',
                  reason: 'User declined the action',
                },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "call_id": "call_denied",
            "output": "User declined the action",
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should convert tool message with content output containing text', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_content',
                toolName: 'multi_output',
                output: {
                  type: 'content',
                  value: [
                    { type: 'text', text: 'First result' },
                    { type: 'text', text: 'Second result' },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "call_id": "call_content",
            "output": [
              {
                "text": "First result",
                "type": "input_text",
              },
              {
                "text": "Second result",
                "type": "input_text",
              },
            ],
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should convert tool message with content output containing image-url', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_image',
                toolName: 'screenshot',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file',
                      data: {
                        type: 'url',
                        url: new URL('https://example.com/image.png'),
                      },
                      mediaType: 'image/png',
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "call_id": "call_image",
            "output": [
              {
                "image_url": "https://example.com/image.png",
                "type": "input_image",
              },
            ],
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should convert tool message with multiple tool results', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_001',
                toolName: 'get_weather',
                output: { type: 'json', value: { temp: 72 } },
              },
              {
                type: 'tool-result',
                toolCallId: 'call_002',
                toolName: 'get_time',
                output: { type: 'text', value: '3:00 PM' },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "call_id": "call_001",
            "output": "{"temp":72}",
            "type": "function_call_output",
          },
          {
            "call_id": "call_002",
            "output": "3:00 PM",
            "type": "function_call_output",
          },
        ]
      `);
    });
  });

  describe('message chains', () => {
    it('should convert user - assistant - user message chain', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the capital of France?' }],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'The capital of France is Paris.' },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'And what about Germany?' }],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the capital of France?",
                "type": "input_text",
              },
            ],
            "role": "user",
            "type": "message",
          },
          {
            "content": [
              {
                "text": "The capital of France is Paris.",
                "type": "output_text",
              },
            ],
            "role": "assistant",
            "type": "message",
          },
          {
            "content": [
              {
                "text": "And what about Germany?",
                "type": "input_text",
              },
            ],
            "role": "user",
            "type": "message",
          },
        ]
      `);
    });

    it('should convert user - assistant (tool call) - tool message chain', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the weather in Tokyo?' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_weather',
                toolName: 'get_weather',
                input: { location: 'Tokyo' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_weather',
                toolName: 'get_weather',
                output: {
                  type: 'json',
                  value: { temperature: 25, condition: 'cloudy' },
                },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "input_text",
              },
            ],
            "role": "user",
            "type": "message",
          },
          {
            "arguments": "{"location":"Tokyo"}",
            "call_id": "call_weather",
            "name": "get_weather",
            "type": "function_call",
          },
          {
            "call_id": "call_weather",
            "output": "{"temperature":25,"condition":"cloudy"}",
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should convert a tool roundtrip with follow-up assistant message', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the weather in Tokyo?' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_weather',
                toolName: 'get_weather',
                input: '{"location":"Tokyo"}',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_weather',
                toolName: 'get_weather',
                output: {
                  type: 'json',
                  value: { temperature: 25, condition: 'cloudy' },
                },
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'It is 25 C and cloudy in Tokyo.',
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the weather in Tokyo?",
                "type": "input_text",
              },
            ],
            "role": "user",
            "type": "message",
          },
          {
            "arguments": "{\"location\":\"Tokyo\"}",
            "call_id": "call_weather",
            "name": "get_weather",
            "type": "function_call",
          },
          {
            "call_id": "call_weather",
            "output": "{"temperature":25,"condition":"cloudy"}",
            "type": "function_call_output",
          },
          {
            "content": [
              {
                "text": "It is 25 C and cloudy in Tokyo.",
                "type": "output_text",
              },
            ],
            "role": "assistant",
            "type": "message",
          },
        ]
      `);
    });
  });

  describe('provider reference', () => {
    it('should throw for file parts with provider references', async () => {
      await expect(
        convertToOpenResponsesInput({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  data: {
                    type: 'reference' as const,
                    reference: { openResponses: 'file-ref-123' },
                  },
                  mediaType: 'image/png',
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow(
        "'file parts with provider references' functionality not supported",
      );
    });
  });

  describe('top-level-only media type resolution', () => {
    const pngBase64 = 'iVBORw0KGgo=';

    it('passes full image/png through unchanged for inline data', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: { type: 'data', data: pngBase64 },
              },
            ],
          },
        ],
      });

      expect((result.input[0] as { content: unknown[] }).content[0]).toEqual({
        type: 'input_image',
        image_url: `data:image/png;base64,${pngBase64}`,
      });
    });

    it('detects image subtype from inline bytes for top-level "image"', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image',
                data: { type: 'data', data: pngBase64 },
              },
            ],
          },
        ],
      });

      expect((result.input[0] as { content: unknown[] }).content[0]).toEqual({
        type: 'input_image',
        image_url: `data:image/png;base64,${pngBase64}`,
      });
    });

    it('passes through URL source for top-level-only image', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image',
                data: {
                  type: 'url',
                  url: new URL('https://example.com/x.png'),
                },
              },
            ],
          },
        ],
      });

      expect((result.input[0] as { content: unknown[] }).content[0]).toEqual({
        type: 'input_image',
        image_url: 'https://example.com/x.png',
      });
    });

    it('normalizes image/* wildcard via detection', async () => {
      const result = await convertToOpenResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/*',
                data: { type: 'data', data: pngBase64 },
              },
            ],
          },
        ],
      });

      expect((result.input[0] as { content: unknown[] }).content[0]).toEqual({
        type: 'input_image',
        image_url: `data:image/png;base64,${pngBase64}`,
      });
    });
  });
});
