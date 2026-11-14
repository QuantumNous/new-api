import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages';
import { describe, it, expect } from 'vitest';

describe('user messages', () => {
  it('should convert messages with only a text part to a string content', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ]);

    expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('should convert messages with image parts', async () => {
    const result = convertToOpenAICompatibleChatMessages([
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
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should convert messages with image parts from Uint8Array', async () => {
    const result = convertToOpenAICompatibleChatMessages([
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

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hi' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should handle URL-based images', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'url' as const,
              url: new URL('https://example.com/image.jpg'),
            },
            mediaType: 'image/*',
          },
        ],
      },
    ]);

    expect(result).toEqual([
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

  it('should convert messages with audio/wav parts', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe this audio' },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from([0, 1, 2, 3]).toString('base64'),
            },
            mediaType: 'audio/wav',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe this audio' },
          {
            type: 'input_audio',
            input_audio: { data: 'AAECAw==', format: 'wav' },
          },
        ],
      },
    ]);
  });

  it('should convert messages with audio/mp3 parts', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: new Uint8Array([0, 1, 2, 3]) },
            mediaType: 'audio/mp3',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: { data: 'AAECAw==', format: 'mp3' },
          },
        ],
      },
    ]);
  });

  it('should convert messages with audio/mpeg parts to mp3 format', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: new Uint8Array([0, 1, 2, 3]) },
            mediaType: 'audio/mpeg',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: { data: 'AAECAw==', format: 'mp3' },
          },
        ],
      },
    ]);
  });

  it('should throw error for audio parts with URLs', async () => {
    expect(() =>
      convertToOpenAICompatibleChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'url' as const,
                url: new URL('https://example.com/audio.wav'),
              },
              mediaType: 'audio/wav',
            },
          ],
        },
      ]),
    ).toThrow("'audio file parts with URLs' functionality not supported");
  });

  it('should throw error for unsupported audio format', async () => {
    expect(() =>
      convertToOpenAICompatibleChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'data' as const,
                data: new Uint8Array([0, 1, 2, 3]),
              },
              mediaType: 'audio/ogg',
            },
          ],
        },
      ]),
    ).toThrow("'audio media type audio/ogg' functionality not supported");
  });

  it('should convert messages with PDF parts', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Summarize this PDF' },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from([0, 1, 2, 3]).toString('base64'),
            },
            mediaType: 'application/pdf',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Summarize this PDF' },
          {
            type: 'file',
            file: {
              filename: 'document.pdf',
              file_data: 'data:application/pdf;base64,AAECAw==',
            },
          },
        ],
      },
    ]);
  });

  it('should convert messages with PDF parts using provided filename', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: new Uint8Array([0, 1, 2, 3]) },
            mediaType: 'application/pdf',
            filename: 'report.pdf',
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
            file: {
              filename: 'report.pdf',
              file_data: 'data:application/pdf;base64,AAECAw==',
            },
          },
        ],
      },
    ]);
  });

  it('should throw error for PDF parts with URLs', async () => {
    expect(() =>
      convertToOpenAICompatibleChatMessages([
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
      ]),
    ).toThrow("'PDF file parts with URLs' functionality not supported");
  });

  it('should convert messages with base64-encoded text/markdown parts', async () => {
    const markdownText = '# Hello World\n\nThis is **markdown** content.';
    const base64Data = btoa(markdownText);

    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Summarize this document' },
          {
            type: 'file',
            data: { type: 'data' as const, data: base64Data },
            mediaType: 'text/markdown',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Summarize this document' },
          {
            type: 'text',
            text: markdownText,
          },
        ],
      },
    ]);
  });

  it('should convert messages with text/plain parts from Uint8Array', async () => {
    const encoder = new TextEncoder();
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: encoder.encode('Plain text content'),
            },
            mediaType: 'text/plain',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Plain text content',
          },
        ],
      },
    ]);
  });

  it('should decode base64 string data for text/* file parts', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from('Plain text content').toString('base64'),
            },
            mediaType: 'text/plain',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Plain text content',
          },
        ],
      },
    ]);
  });

  it('should convert text file URL to string', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'url' as const,
              url: new URL('https://example.com/readme.md'),
            },
            mediaType: 'text/markdown',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'https://example.com/readme.md',
          },
        ],
      },
    ]);
  });

  it('should throw error for unsupported file types', async () => {
    expect(() =>
      convertToOpenAICompatibleChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'data' as const,
                data: new Uint8Array([0, 1, 2, 3]),
              },
              mediaType: 'video/mp4',
            },
          ],
        },
      ]),
    ).toThrow("'file part media type video/mp4' functionality not supported");
  });

  it('should throw error for file parts with provider references', async () => {
    expect(() =>
      convertToOpenAICompatibleChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'reference' as const,
                reference: { openaiCompatible: 'file-123' },
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

describe('tool calls', () => {
  it('should stringify arguments to tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
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

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            type: 'function',
            id: 'quux',
            function: {
              name: 'thwomp',
              arguments: JSON.stringify({ foo: 'bar123' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({ oof: '321rab' }),
        tool_call_id: 'quux',
      },
    ]);
  });

  it('should send empty string content for assistant messages with no tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "",
          "role": "assistant",
          "tool_calls": undefined,
        },
      ]
    `);
  });

  it('should handle text output type in tool results', () => {
    const result = convertToOpenAICompatibleChatMessages([
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
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            type: 'function',
            id: 'call-1',
            function: {
              name: 'getWeather',
              arguments: JSON.stringify({ query: 'weather' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: 'It is sunny today',
        tool_call_id: 'call-1',
      },
    ]);
  });
});

describe('provider-specific metadata merging', () => {
  it('should merge system message metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'system',
        content: 'You are a helpful assistant.',
        providerOptions: {
          openaiCompatible: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'system',
        content: 'You are a helpful assistant.',
        cacheControl: { type: 'ephemeral' },
      },
    ]);
  });

  it('should merge user message content metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: 'Hello',
        cacheControl: { type: 'ephemeral' },
      },
    ]);
  });

  it('should prioritize content-level metadata when merging', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        providerOptions: {
          openaiCompatible: {
            messageLevel: true,
          },
        },
        content: [
          {
            type: 'text',
            text: 'Hello',
            providerOptions: {
              openaiCompatible: {
                contentLevel: true,
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: 'Hello',
        contentLevel: true,
      },
    ]);
  });

  it('should handle tool calls with metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'calculator',
            input: { x: 1, y: 2 },
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call1',
            type: 'function',
            function: {
              name: 'calculator',
              arguments: JSON.stringify({ x: 1, y: 2 }),
            },
            cacheControl: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should handle image content with metadata', async () => {
    const imageUrl = new URL('https://example.com/image.jpg');
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'url' as const, url: imageUrl },
            mediaType: 'image/*',
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl.toString() },
            cacheControl: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should omit non-openaiCompatible metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'system',
        content: 'Hello',
        providerOptions: {
          someOtherProvider: {
            shouldBeIgnored: true,
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'system',
        content: 'Hello',
      },
    ]);
  });

  it('should handle a user message with multiple content parts (text + image)', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello from part 1',
            providerOptions: {
              openaiCompatible: { sentiment: 'positive' },
              leftoverKey: { foo: 'some leftover data' },
            },
          },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from([0, 1, 2, 3]).toString('base64'),
            },
            mediaType: 'image/png',
            providerOptions: {
              openaiCompatible: { alt_text: 'A sample image' },
            },
          },
        ],
        providerOptions: {
          openaiCompatible: { priority: 'high' },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        priority: 'high', // hoisted from message-level providerOptions
        content: [
          {
            type: 'text',
            text: 'Hello from part 1',
            sentiment: 'positive', // hoisted from part-level openaiCompatible
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,AAECAw==',
            },
            alt_text: 'A sample image',
          },
        ],
      },
    ]);
  });

  it('should handle a user message with multiple text parts (flattening disabled)', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      },
    ]);

    // Because there are multiple text parts, the converter won't flatten them
    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      },
    ]);
  });

  it('should handle an assistant message with text plus multiple tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Checking that now...' },
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'searchTool',
            input: { query: 'Weather' },
            providerOptions: {
              openaiCompatible: { function_call_reason: 'user request' },
            },
          },
          { type: 'text', text: 'Almost there...' },
          {
            type: 'tool-call',
            toolCallId: 'call2',
            toolName: 'mapsTool',
            input: { location: 'Paris' },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Checking that now...Almost there...',
        tool_calls: [
          {
            id: 'call1',
            type: 'function',
            function: {
              name: 'searchTool',
              arguments: JSON.stringify({ query: 'Weather' }),
            },
            function_call_reason: 'user request',
          },
          {
            id: 'call2',
            type: 'function',
            function: {
              name: 'mapsTool',
              arguments: JSON.stringify({ location: 'Paris' }),
            },
          },
        ],
      },
    ]);
  });

  it('should handle a single tool role message with multiple tool-result parts', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'tool',
        providerOptions: {
          // this just gets omitted as we prioritize content-level metadata
          openaiCompatible: { responseTier: 'detailed' },
        },
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call123',
            toolName: 'calculator',
            output: { type: 'json', value: { stepOne: 'data chunk 1' } },
          },
          {
            type: 'tool-result',
            toolCallId: 'call123',
            toolName: 'calculator',
            providerOptions: {
              openaiCompatible: { partial: true },
            },
            output: { type: 'json', value: { stepTwo: 'data chunk 2' } },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call123',
        content: JSON.stringify({ stepOne: 'data chunk 1' }),
      },
      {
        role: 'tool',
        tool_call_id: 'call123',
        content: JSON.stringify({ stepTwo: 'data chunk 2' }),
        partial: true,
      },
    ]);
  });

  it('should handle multiple content parts with multiple metadata layers', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        providerOptions: {
          openaiCompatible: { messageLevel: 'global-metadata' },
          leftoverForMessage: { x: 123 },
        },
        content: [
          {
            type: 'text',
            text: 'Part A',
            providerOptions: {
              openaiCompatible: { textPartLevel: 'localized' },
              leftoverForText: { info: 'text leftover' },
            },
          },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from([9, 8, 7, 6]).toString('base64'),
            },
            mediaType: 'image/png',
            providerOptions: {
              openaiCompatible: { imagePartLevel: 'image-data' },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        messageLevel: 'global-metadata',
        content: [
          {
            type: 'text',
            text: 'Part A',
            textPartLevel: 'localized',
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,CQgHBg==',
            },
            imagePartLevel: 'image-data',
          },
        ],
      },
    ]);
  });

  it('should handle different tool metadata vs. message-level metadata', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        providerOptions: {
          openaiCompatible: { globalPriority: 'high' },
        },
        content: [
          { type: 'text', text: 'Initiating tool calls...' },
          {
            type: 'tool-call',
            toolCallId: 'callXYZ',
            toolName: 'awesomeTool',
            input: { param: 'someValue' },
            providerOptions: {
              openaiCompatible: {
                toolPriority: 'critical',
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        globalPriority: 'high',
        content: 'Initiating tool calls...',
        tool_calls: [
          {
            id: 'callXYZ',
            type: 'function',
            function: {
              name: 'awesomeTool',
              arguments: JSON.stringify({ param: 'someValue' }),
            },
            toolPriority: 'critical',
          },
        ],
      },
    ]);
  });

  it('should handle metadata collisions and overwrites in tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        providerOptions: {
          openaiCompatible: {
            cacheControl: { type: 'default' },
            sharedKey: 'assistantLevel',
          },
        },
        content: [
          {
            type: 'tool-call',
            toolCallId: 'collisionToolCall',
            toolName: 'collider',
            input: { num: 42 },
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' }, // overwrites top-level
                sharedKey: 'toolLevel',
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        cacheControl: { type: 'default' },
        sharedKey: 'assistantLevel',
        content: null,
        tool_calls: [
          {
            id: 'collisionToolCall',
            type: 'function',
            function: {
              name: 'collider',
              arguments: JSON.stringify({ num: 42 }),
            },
            cacheControl: { type: 'ephemeral' },
            sharedKey: 'toolLevel',
          },
        ],
      },
    ]);
  });
});

describe('Google Gemini thought signatures (OpenAI compatibility)', () => {
  it('should serialize thought signature to extra_content for single tool call', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'function-call-1',
            toolName: 'check_flight',
            input: { flight: 'AA100' },
            providerOptions: {
              google: {
                thoughtSignature: '<Signature A>',
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'function-call-1',
            type: 'function',
            function: {
              name: 'check_flight',
              arguments: JSON.stringify({ flight: 'AA100' }),
            },
            extra_content: {
              google: {
                thought_signature: '<Signature A>',
              },
            },
          },
        ],
      },
    ]);
  });

  it('should handle sequential tool calls with separate signatures (Turn 1 Step 3 scenario)', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Check flight status for AA100 and book a taxi 2 hours before if delayed.',
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'function-call-1',
            toolName: 'check_flight',
            input: { flight: 'AA100' },
            providerOptions: {
              google: {
                thoughtSignature: '<Signature A>',
              },
            },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'function-call-1',
            toolName: 'check_flight',
            output: {
              type: 'json',
              value: { status: 'delayed', departure_time: '12 PM' },
            },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'function-call-2',
            toolName: 'book_taxi',
            input: { time: '10 AM' },
            providerOptions: {
              google: {
                thoughtSignature: '<Signature B>',
              },
            },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'function-call-2',
            toolName: 'book_taxi',
            output: { type: 'json', value: { booking_status: 'success' } },
          },
        ],
      },
    ]);

    // Verify both signatures are preserved
    expect(result[1]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'function-call-1',
          type: 'function',
          function: {
            name: 'check_flight',
            arguments: JSON.stringify({ flight: 'AA100' }),
          },
          extra_content: {
            google: {
              thought_signature: '<Signature A>',
            },
          },
        },
      ],
    });

    expect(result[3]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'function-call-2',
          type: 'function',
          function: {
            name: 'book_taxi',
            arguments: JSON.stringify({ time: '10 AM' }),
          },
          extra_content: {
            google: {
              thought_signature: '<Signature B>',
            },
          },
        },
      ],
    });
  });

  it('should handle parallel tool calls with signature only on first call', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'function-call-paris',
            toolName: 'get_current_temperature',
            input: { location: 'Paris' },
            providerOptions: {
              google: {
                thoughtSignature: '<Signature A>',
              },
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'function-call-london',
            toolName: 'get_current_temperature',
            input: { location: 'London' },
            // No signature on parallel function call
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'function-call-paris',
            type: 'function',
            function: {
              name: 'get_current_temperature',
              arguments: JSON.stringify({ location: 'Paris' }),
            },
            extra_content: {
              google: {
                thought_signature: '<Signature A>',
              },
            },
          },
          {
            id: 'function-call-london',
            type: 'function',
            function: {
              name: 'get_current_temperature',
              arguments: JSON.stringify({ location: 'London' }),
            },
            // No extra_content for second parallel call
          },
        ],
      },
    ]);
  });

  it('should not include extra_content when no thought signature is present', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'some_tool',
            input: { param: 'value' },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'some_tool',
              arguments: JSON.stringify({ param: 'value' }),
            },
          },
        ],
      },
    ]);
  });
});

describe('top-level-only media type resolution', () => {
  const pngBase64 = 'iVBORw0KGgo=';

  it('passes full image/png through unchanged for inline data', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'data' as const, data: pngBase64 },
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
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image',
            data: { type: 'data' as const, data: pngBase64 },
          },
        ],
      },
    ]);

    expect((result[0].content as unknown[])[0]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${pngBase64}` },
    });
  });

  it('passes through URL source for top-level-only image (provider accepts raw URL)', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image',
            data: {
              type: 'url' as const,
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
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image/*',
            data: { type: 'data' as const, data: pngBase64 },
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
