import { convertToXaiChatMessages } from './convert-to-xai-chat-messages';
import { describe, it, expect } from 'vitest';

describe('convertToXaiChatMessages', () => {
  it('should convert simple text messages', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('should convert system messages', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      { role: 'system', content: 'You are a helpful assistant.' },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
    ]);
  });

  it('should convert assistant messages', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      { role: 'assistant', content: [{ type: 'text', text: 'Hello there!' }] },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      { role: 'assistant', content: 'Hello there!', tool_calls: undefined },
    ]);
  });

  it('should convert messages with image parts', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'data' as const, data: Buffer.from([0, 1, 2, 3]) },
          },
        ],
      },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should convert image URLs', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      {
        role: 'user',
        content: [
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
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: 'https://example.com/image.jpg' },
          },
        ],
      },
    ]);
  });

  it('should convert image file parts with provider reference', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: {
              type: 'reference' as const,
              reference: { xai: 'file-abc123', openai: 'file-xyz789' },
            },
          },
        ],
      },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            file: { file_id: 'file-abc123' },
          },
        ],
      },
    ]);
  });

  it('should convert non-image file parts with provider reference', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: {
              type: 'reference' as const,
              reference: { xai: 'file-pdf456' },
            },
          },
        ],
      },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            file: { file_id: 'file-pdf456' },
          },
        ],
      },
    ]);
  });

  it('should throw error when provider reference is missing xai key', () => {
    expect(() => {
      convertToXaiChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'reference' as const,
                reference: { openai: 'file-xyz789' },
              },
            },
          ],
        },
      ]);
    }).toThrow(
      "No provider reference found for provider 'xai'. Available providers: openai",
    );
  });

  it('should throw error for unsupported file types', () => {
    expect(() => {
      convertToXaiChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              data: { type: 'data' as const, data: Buffer.from([0, 1, 2, 3]) },
            },
          ],
        },
      ]);
    }).toThrow('file part media type application/pdf');
  });

  it('should convert tool calls and tool responses', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'weather',
            input: { location: 'Paris' },
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
            output: { type: 'json', value: { temperature: 20 } },
          },
        ],
      },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'weather',
              arguments: '{"location":"Paris"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_123',
        content: '{"temperature":20}',
      },
    ]);
  });

  it('should handle multiple tool calls in one message', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'weather',
            input: { location: 'Paris' },
          },
          {
            type: 'tool-call',
            toolCallId: 'call_456',
            toolName: 'time',
            input: { timezone: 'UTC' },
          },
        ],
      },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'weather',
              arguments: '{"location":"Paris"}',
            },
          },
          {
            id: 'call_456',
            type: 'function',
            function: {
              name: 'time',
              arguments: '{"timezone":"UTC"}',
            },
          },
        ],
      },
    ]);
  });

  it('should handle mixed content with text and tool calls', () => {
    const { messages, warnings } = convertToXaiChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check the weather for you.' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'weather',
            input: { location: 'Paris' },
          },
        ],
      },
    ]);

    expect(warnings).toEqual([]);
    expect(messages).toEqual([
      {
        role: 'assistant',
        content: 'Let me check the weather for you.',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'weather',
              arguments: '{"location":"Paris"}',
            },
          },
        ],
      },
    ]);
  });

  describe('top-level-only media type resolution', () => {
    const pngBase64 = 'iVBORw0KGgo=';

    it('passes full image/png through unchanged for inline data', () => {
      const { messages } = convertToXaiChatMessages([
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

      expect((messages[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${pngBase64}` },
      });
    });

    it('detects image subtype from inline bytes for top-level "image"', () => {
      const { messages } = convertToXaiChatMessages([
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

      expect((messages[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${pngBase64}` },
      });
    });

    it('passes through URL source for top-level-only image', () => {
      const { messages } = convertToXaiChatMessages([
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

      expect((messages[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/x.png' },
      });
    });

    it('normalizes image/* wildcard via detection', () => {
      const { messages } = convertToXaiChatMessages([
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

      expect((messages[0].content as unknown[])[0]).toEqual({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${pngBase64}` },
      });
    });
  });
});
