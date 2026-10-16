import { convertToGroqChatMessages } from './convert-to-groq-chat-messages';
import { describe, it, expect } from 'vitest';

describe('user messages', () => {
  it('should convert messages with image parts', async () => {
    const result = convertToGroqChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: { type: 'data' as const, data: 'AAECAw==' },
            mediaType: 'image/png',
          },
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

  it('should convert messages with image parts from Uint8Array', async () => {
    const result = convertToGroqChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hi' },
          {
            type: 'file',
            data: { type: 'data' as const, data: new Uint8Array([0, 1, 2, 3]) },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "text": "Hi",
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

  it('should convert messages with only a text part to a string content', async () => {
    const result = convertToGroqChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "Hello",
          "role": "user",
        },
      ]
    `);
  });
});

describe('tool calls', () => {
  it('should stringify arguments to tool calls', () => {
    const result = convertToGroqChatMessages([
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
    ]);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "",
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
      ]
    `);
  });

  it('should send reasoning if present', () => {
    const result = convertToGroqChatMessages([
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
    ]);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "",
          "reasoning": "I think the tool will return the correct value.",
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
      ]
    `);
  });

  it('should not include reasoning field when no reasoning content is present', () => {
    const result = convertToGroqChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, how can I help you?' }],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "Hello, how can I help you?",
          "role": "assistant",
        },
      ]
    `);
  });

  it('should throw for file parts with provider references', () => {
    expect(() =>
      convertToGroqChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'reference' as const,
                reference: { groq: 'file-ref-123' },
              },
              mediaType: 'image/png',
            },
          ],
        },
      ]),
    ).toThrow(
      "'file parts with provider references' functionality not supported",
    );
  });
});

describe('top-level-only media type resolution', () => {
  const pngBase64 = 'iVBORw0KGgo=';

  it('passes full image/png through unchanged for inline data', () => {
    const result = convertToGroqChatMessages([
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
    ]);

    expect((result[0].content as unknown[])[0]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${pngBase64}` },
    });
  });

  it('detects image subtype from inline bytes for top-level "image"', () => {
    const result = convertToGroqChatMessages([
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
    ]);

    expect((result[0].content as unknown[])[0]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${pngBase64}` },
    });
  });

  it('passes through URL source for top-level-only image', () => {
    const result = convertToGroqChatMessages([
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
    ]);

    expect((result[0].content as unknown[])[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/x.png' },
    });
  });

  it('normalizes image/* wildcard via detection', () => {
    const result = convertToGroqChatMessages([
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
    ]);

    expect((result[0].content as unknown[])[0]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${pngBase64}` },
    });
  });
});
