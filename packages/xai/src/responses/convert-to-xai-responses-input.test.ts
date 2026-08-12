import { describe, expect, it } from 'vitest';
import { convertToXaiResponsesInput } from './convert-to-xai-responses-input';

describe('convertToXaiResponsesInput', () => {
  describe('system messages', () => {
    it('should convert system messages', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [{ role: 'system', content: 'you are a helpful assistant' }],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": "you are a helpful assistant",
            "role": "system",
          },
        ]
      `);
      expect(result.inputWarnings).toEqual([]);
    });
  });

  describe('user messages', () => {
    it('should convert single text part', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "hello",
                "type": "input_text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should concatenate multiple text parts', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'hello ' },
              { type: 'text', text: 'world' },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "hello ",
                "type": "input_text",
              },
              {
                "text": "world",
                "type": "input_text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should convert image file parts with URL', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'what is in this image' },
              {
                type: 'file',
                mediaType: 'image/jpeg',
                data: {
                  type: 'url' as const,
                  url: new URL('https://example.com/image.jpg'),
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
                "text": "what is in this image",
                "type": "input_text",
              },
              {
                "image_url": "https://example.com/image.jpg",
                "type": "input_image",
              },
            ],
            "role": "user",
          },
        ]
      `);
      expect(result.inputWarnings).toEqual([]);
    });

    it('should convert image file parts with base64 data', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'describe this' },
              {
                type: 'file',
                mediaType: 'image/png',
                data: {
                  type: 'data' as const,
                  data: new Uint8Array([1, 2, 3]),
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
                "text": "describe this",
                "type": "input_text",
              },
              {
                "image_url": "data:image/png;base64,AQID",
                "type": "input_image",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should convert non-image file parts with URL to input_file with file_url', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'summarize this PDF' },
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: {
                  type: 'url' as const,
                  url: new URL('https://example.com/document.pdf'),
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
                "text": "summarize this PDF",
                "type": "input_text",
              },
              {
                "file_url": "https://example.com/document.pdf",
                "type": "input_file",
              },
            ],
            "role": "user",
          },
        ]
      `);
      expect(result.inputWarnings).toEqual([]);
    });

    it('should convert text/* file parts with URL to input_file with file_url', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'analyze this CSV' },
              {
                type: 'file',
                mediaType: 'text/csv',
                data: {
                  type: 'url' as const,
                  url: new URL('https://example.com/data.csv'),
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
                "text": "analyze this CSV",
                "type": "input_text",
              },
              {
                "file_url": "https://example.com/data.csv",
                "type": "input_file",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should throw for non-image file parts provided as inline bytes', async () => {
      await expect(
        convertToXaiResponsesInput({
          prompt: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'check this file' },
                {
                  type: 'file',
                  mediaType: 'application/pdf',
                  data: {
                    type: 'data' as const,
                    data: new Uint8Array([1, 2, 3]),
                  },
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow('file part media type application/pdf');
    });
  });

  describe('assistant messages', () => {
    it('should convert text content', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          { role: 'assistant', content: [{ type: 'text', text: 'hi there' }] },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": "hi there",
            "id": undefined,
            "role": "assistant",
          },
        ]
      `);
    });

    it('should handle client-side tool-call parts', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_123',
                toolName: 'weather',
                input: { location: 'sf' },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "arguments": "{"location":"sf"}",
            "call_id": "call_123",
            "id": "call_123",
            "name": "weather",
            "status": "completed",
            "type": "function_call",
          },
        ]
      `);
    });

    it('should handle client-side tool-call parts named like server-side tools', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_ws',
                toolName: 'web_search',
                input: { query: 'latest news' },
              },
            ],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "arguments": "{\"query\":\"latest news\"}",
            "call_id": "call_ws",
            "id": "call_ws",
            "name": "web_search",
            "status": "completed",
            "type": "function_call",
          },
        ]
      `);
    });

    it('should skip server-side tool-call parts', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'ws_123',
                toolName: 'web_search',
                input: {},
                providerExecuted: true,
              },
            ],
          },
        ],
      });

      expect(result.input).toEqual([]);
    });
  });

  describe('tool messages', () => {
    it('should convert tool-result to function_call_output with json', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_123',
                toolName: 'weather',
                output: {
                  type: 'json',
                  value: { temp: 72 },
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
            "output": "{"temp":72}",
            "type": "function_call_output",
          },
        ]
      `);
    });

    it('should handle text output', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_123',
                toolName: 'weather',
                output: {
                  type: 'text',
                  value: 'sunny, 72 degrees',
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
            "output": "sunny, 72 degrees",
            "type": "function_call_output",
          },
        ]
      `);
    });
  });

  describe('multi-turn conversations', () => {
    it('should handle full conversation with client-side tool calls', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'whats the weather' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_123',
                toolName: 'weather',
                input: { location: 'sf' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_123',
                toolName: 'weather',
                output: {
                  type: 'json',
                  value: { temp: 72 },
                },
              },
            ],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'its 72 degrees' }],
          },
        ],
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "whats the weather",
                "type": "input_text",
              },
            ],
            "role": "user",
          },
          {
            "arguments": "{"location":"sf"}",
            "call_id": "call_123",
            "id": "call_123",
            "name": "weather",
            "status": "completed",
            "type": "function_call",
          },
          {
            "call_id": "call_123",
            "output": "{"temp":72}",
            "type": "function_call_output",
          },
          {
            "content": "its 72 degrees",
            "id": undefined,
            "role": "assistant",
          },
        ]
      `);
    });

    it('should handle conversation with server-side tool calls and item references', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'search for ai news' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'ws_123',
                toolName: 'web_search',
                input: {},
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'ws_123',
                toolName: 'web_search',
                output: {
                  type: 'json',
                  value: {},
                },
              },
              { type: 'text', text: 'here are the results' },
            ],
          },
        ],
        store: true,
      });

      expect(result.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "search for ai news",
                "type": "input_text",
              },
            ],
            "role": "user",
          },
          {
            "content": "here are the results",
            "id": undefined,
            "role": "assistant",
          },
        ]
      `);
    });

    it('should round-trip reasoning with encrypted content in multi-turn', async () => {
      const result = await convertToXaiResponsesInput({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the capital of France?' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: 'The user is asking about geography.',
                providerOptions: {
                  xai: {
                    itemId: 'rs_789',
                    reasoningEncryptedContent: 'encrypted_xyz',
                  },
                },
              },
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
          },
          {
            "encrypted_content": "encrypted_xyz",
            "id": "rs_789",
            "status": "completed",
            "summary": [
              {
                "text": "The user is asking about geography.",
                "type": "summary_text",
              },
            ],
            "type": "reasoning",
          },
          {
            "content": "The capital of France is Paris.",
            "id": undefined,
            "role": "assistant",
          },
          {
            "content": [
              {
                "text": "And what about Germany?",
                "type": "input_text",
              },
            ],
            "role": "user",
          },
        ]
      `);
      expect(result.inputWarnings).toEqual([]);
    });
  });

  describe('top-level-only media type resolution', () => {
    const pngBase64 = 'iVBORw0KGgo=';

    it('passes full image/png through unchanged for inline data', async () => {
      const result = await convertToXaiResponsesInput({
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
      const result = await convertToXaiResponsesInput({
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
      const result = await convertToXaiResponsesInput({
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
      const result = await convertToXaiResponsesInput({
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
