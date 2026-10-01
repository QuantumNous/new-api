import { describe, it, expect } from 'vitest';
import { convertToAlibabaChatMessages } from './convert-to-alibaba-chat-messages';
import { CacheControlValidator } from './get-cache-control';

describe('convertToAlibabaChatMessages', () => {
  it('should use array format for single text user message', () => {
    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    });

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

  it('should use array format for multi-part user message with image', () => {
    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'file',
              data: {
                type: 'data' as const,
                data: new Uint8Array([0, 1, 2, 3]),
              },
              mediaType: 'image/png',
            },
          ],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "text": "What is in this image?",
              "type": "text",
            },
            {
              "image_url": {
                "url": "data:image/png;base64,AAECAw==",
              },
              "type": "image_url",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should convert assistant message with tool calls', () => {
    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              input: { location: 'San Francisco' },
            },
          ],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": null,
          "role": "assistant",
          "tool_calls": [
            {
              "function": {
                "arguments": "{"location":"San Francisco"}",
                "name": "get_weather",
              },
              "id": "call-1",
              "type": "function",
            },
          ],
        },
      ]
    `);
  });

  it('should convert tool results', () => {
    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
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

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "{"temperature":72,"condition":"sunny"}",
          "role": "tool",
          "tool_call_id": "call-1",
        },
      ]
    `);
  });

  it('should inject cache control into system message content block', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "You are a helpful assistant.",
              "type": "text",
            },
          ],
          "role": "system",
        },
      ]
    `);
  });

  it('should inject cache control into single text user message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should use part-level cache control for single-part user message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello',
              providerOptions: {
                alibaba: {
                  cacheControl: { type: 'ephemeral' },
                },
              },
            },
          ],
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should prefer part-level over message-level cache control for single-part user message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello',
              providerOptions: {
                alibaba: {
                  cacheControl: { type: 'ephemeral' },
                },
              },
            },
          ],
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'should-not-use' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should use part-level cache control for multi-part user message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'file',
              data: {
                type: 'data' as const,
                data: new Uint8Array([0, 1, 2, 3]),
              },
              mediaType: 'image/png',
              providerOptions: {
                alibaba: {
                  cacheControl: { type: 'ephemeral' },
                },
              },
            },
          ],
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "text": "What is in this image?",
              "type": "text",
            },
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "image_url": {
                "url": "data:image/png;base64,AAECAw==",
              },
              "type": "image_url",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should apply message-level cache control to last part of multi-part user message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'file',
              data: {
                type: 'data' as const,
                data: new Uint8Array([0, 1, 2, 3]),
              },
              mediaType: 'image/png',
            },
          ],
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "text": "What is in this image?",
              "type": "text",
            },
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "image_url": {
                "url": "data:image/png;base64,AAECAw==",
              },
              "type": "image_url",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should inject cache control into assistant message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, how can I help?' }],
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "Hello, how can I help?",
              "type": "text",
            },
          ],
          "role": "assistant",
          "tool_calls": undefined,
        },
      ]
    `);
  });

  it('should inject cache control into single-part tool message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              output: {
                type: 'json',
                value: { temperature: 72, condition: 'sunny' },
              },
            },
          ],
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "{"temperature":72,"condition":"sunny"}",
              "type": "text",
            },
          ],
          "role": "tool",
          "tool_call_id": "call-1",
        },
      ]
    `);
  });

  it('should use part-level cache control for single-part tool message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              output: {
                type: 'json',
                value: { temperature: 72, condition: 'sunny' },
              },
              providerOptions: {
                alibaba: {
                  cacheControl: { type: 'ephemeral' },
                },
              },
            },
          ],
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "{"temperature":72,"condition":"sunny"}",
              "type": "text",
            },
          ],
          "role": "tool",
          "tool_call_id": "call-1",
        },
      ]
    `);
  });

  it('should prefer part-level over message-level cache control for single-part tool message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              output: {
                type: 'json',
                value: { temperature: 72, condition: 'sunny' },
              },
              providerOptions: {
                alibaba: {
                  cacheControl: { type: 'ephemeral' },
                },
              },
            },
          ],
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'should-not-use' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "{"temperature":72,"condition":"sunny"}",
              "type": "text",
            },
          ],
          "role": "tool",
          "tool_call_id": "call-1",
        },
      ]
    `);
  });

  it('should apply message-level cache control to last part of multi-part tool message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              output: {
                type: 'json',
                value: { temperature: 72, condition: 'sunny' },
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'get_time',
              output: {
                type: 'text',
                value: '2:30 PM',
              },
            },
          ],
          providerOptions: {
            alibaba: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "{"temperature":72,"condition":"sunny"}",
          "role": "tool",
          "tool_call_id": "call-1",
        },
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "2:30 PM",
              "type": "text",
            },
          ],
          "role": "tool",
          "tool_call_id": "call-2",
        },
      ]
    `);
  });

  it('should use part-level cache control for multi-part tool message', () => {
    const validator = new CacheControlValidator();

    const result = convertToAlibabaChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              output: {
                type: 'json',
                value: { temperature: 72, condition: 'sunny' },
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'get_time',
              output: {
                type: 'text',
                value: '2:30 PM',
              },
              providerOptions: {
                alibaba: {
                  cacheControl: { type: 'ephemeral' },
                },
              },
            },
          ],
        },
      ],
      cacheControlValidator: validator,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "{"temperature":72,"condition":"sunny"}",
          "role": "tool",
          "tool_call_id": "call-1",
        },
        {
          "content": [
            {
              "cache_control": {
                "type": "ephemeral",
              },
              "text": "2:30 PM",
              "type": "text",
            },
          ],
          "role": "tool",
          "tool_call_id": "call-2",
        },
      ]
    `);
  });

  it('should throw for file parts with provider references', () => {
    expect(() =>
      convertToAlibabaChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: {
                  type: 'reference' as const,
                  reference: { alibaba: 'file-ref-123' },
                },
                mediaType: 'image/png',
              },
            ],
          },
        ],
      }),
    ).toThrow(
      "'file parts with provider references' functionality not supported",
    );
  });

  describe('top-level-only media type resolution', () => {
    const pngBase64 = 'iVBORw0KGgo=';

    it('passes full image/png through unchanged for inline data', () => {
      const result = convertToAlibabaChatMessages({
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

      expect((result[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${pngBase64}` },
      });
    });

    it('detects image subtype from inline bytes for top-level "image"', () => {
      const result = convertToAlibabaChatMessages({
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

      expect((result[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${pngBase64}` },
      });
    });

    it('passes through URL source for top-level-only image', () => {
      const result = convertToAlibabaChatMessages({
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

      expect((result[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/x.png' },
      });
    });

    it('normalizes image/* wildcard via detection', () => {
      const result = convertToAlibabaChatMessages({
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

      expect((result[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${pngBase64}` },
      });
    });
  });
});
