import { convertToOpenAIChatMessages } from './convert-to-openai-chat-messages';
import { describe, it, expect } from 'vitest';

describe('system messages', () => {
  it('should forward system messages', async () => {
    const result = convertToOpenAIChatMessages({
      prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
    });

    expect(result.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
    ]);
  });

  it('should convert system messages to developer messages when requested', async () => {
    const result = convertToOpenAIChatMessages({
      prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
      systemMessageMode: 'developer',
    });

    expect(result.messages).toEqual([
      { role: 'developer', content: 'You are a helpful assistant.' },
    ]);
  });

  it('should add a prompt cache breakpoint to a system message', () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
          providerOptions: {
            openai: { promptCacheBreakpoint: { mode: 'explicit' } },
          },
        },
      ],
    });

    expect(result.messages).toEqual([
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a helpful assistant.',
            prompt_cache_breakpoint: { mode: 'explicit' },
          },
        ],
      },
    ]);
  });

  it('should remove system messages when requested', async () => {
    const result = convertToOpenAIChatMessages({
      prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
      systemMessageMode: 'remove',
    });

    expect(result.messages).toEqual([]);
  });
});

describe('user messages', () => {
  it('should convert messages with only a text part to a string content', async () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    });

    expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('should add prompt cache breakpoints to supported content blocks', () => {
    const promptCacheBreakpoint = { mode: 'explicit' } as const;
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello',
              providerOptions: { openai: { promptCacheBreakpoint } },
            },
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.png'),
              },
              providerOptions: { openai: { promptCacheBreakpoint } },
            },
            {
              type: 'file',
              mediaType: 'audio/wav',
              data: { type: 'data', data: 'AAECAw==' },
              providerOptions: { openai: { promptCacheBreakpoint } },
            },
            {
              type: 'file',
              mediaType: 'application/pdf',
              data: {
                type: 'reference',
                reference: { openai: 'file-pdf-123' },
              },
              providerOptions: { openai: { promptCacheBreakpoint } },
            },
          ],
        },
      ],
    });

    expect(result.messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            prompt_cache_breakpoint: promptCacheBreakpoint,
          },
          {
            type: 'image_url',
            image_url: { url: 'https://example.com/image.png' },
            prompt_cache_breakpoint: promptCacheBreakpoint,
          },
          {
            type: 'input_audio',
            input_audio: { data: 'AAECAw==', format: 'wav' },
            prompt_cache_breakpoint: promptCacheBreakpoint,
          },
          {
            type: 'file',
            file: { file_id: 'file-pdf-123' },
            prompt_cache_breakpoint: promptCacheBreakpoint,
          },
        ],
      },
    ]);
  });

  it('should convert messages with image parts', async () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'data' as const,
                data: Buffer.from([0, 1, 2, 3]).toString('base64'),
              },
            },
          ],
        },
      ],
    });

    expect(result.messages).toEqual([
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

  it('should convert messages with Uint8Array image parts to data URLs', async () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              data: {
                type: 'data' as const,
                data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
              },
            },
          ],
        },
      ],
    });

    expect(result.messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,/9j/4A==' },
          },
        ],
      },
    ]);
  });

  it('should add image detail when specified through extension', async () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'data' as const,
                data: Buffer.from([0, 1, 2, 3]).toString('base64'),
              },
              providerOptions: {
                openai: {
                  imageDetail: 'low',
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,AAECAw==',
              detail: 'low',
            },
          },
        ],
      },
    ]);
  });

  describe('file parts', () => {
    it('should throw for unsupported mime types', () => {
      expect(() =>
        convertToOpenAIChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  data: { type: 'data' as const, data: 'AAECAw==' },
                  mediaType: 'application/something',
                },
              ],
            },
          ],
        }),
      ).toThrow('file part media type application/something');
    });

    it('should throw for URL data', () => {
      expect(() =>
        convertToOpenAIChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  data: {
                    type: 'url' as const,
                    url: new URL('https://example.com/foo.wav'),
                  },
                  mediaType: 'audio/wav',
                },
              ],
            },
          ],
        }),
      ).toThrow('audio file parts with URLs');
    });

    it('should add audio content for audio/wav file parts', () => {
      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: 'AAECAw==' },
                mediaType: 'audio/wav',
              },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: 'AAECAw==', format: 'wav' },
            },
          ],
        },
      ]);
    });

    it('should add audio content for audio/mpeg file parts', () => {
      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: 'AAECAw==' },
                mediaType: 'audio/mpeg',
              },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
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

    it('should add audio content for audio/mp3 file parts', () => {
      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: 'AAECAw==' },
                mediaType: 'audio/mp3', // not official but sometimes used
              },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
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

    it('should convert messages with PDF file parts', async () => {
      const base64Data = 'AQIDBAU='; // Base64 encoding of pdfData

      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data' as const, data: base64Data },
                filename: 'document.pdf',
              },
            ],
          },
        ],
        systemMessageMode: 'system',
      });

      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: 'data:application/pdf;base64,AQIDBAU=',
              },
            },
          ],
        },
      ]);
    });

    it('should convert messages with binary PDF file parts', async () => {
      const data = Uint8Array.from([1, 2, 3, 4, 5]);

      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data' as const, data },
                filename: 'document.pdf',
              },
            ],
          },
        ],
        systemMessageMode: 'system',
      });

      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: 'data:application/pdf;base64,AQIDBAU=',
              },
            },
          ],
        },
      ]);
    });

    it('should convert messages with PDF file parts using provider reference', async () => {
      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: {
                  type: 'reference' as const,
                  reference: { openai: 'file-pdf-12345' },
                },
              },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                file_id: 'file-pdf-12345',
              },
            },
          ],
        },
      ]);
    });

    it('should convert messages with image parts using provider reference', async () => {
      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: {
                  type: 'reference' as const,
                  reference: { openai: 'file-img-12345' },
                },
              },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                file_id: 'file-img-12345',
              },
            },
          ],
        },
      ]);
    });

    it('should throw when provider reference does not contain openai', async () => {
      expect(() =>
        convertToOpenAIChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  mediaType: 'application/pdf',
                  data: {
                    type: 'reference' as const,
                    reference: { anthropic: 'file-xyz' },
                  },
                },
              ],
            },
          ],
        }),
      ).toThrow(
        "No provider reference found for provider 'openai'. Available providers: anthropic",
      );
    });

    it('should use default filename for PDF file parts when not provided', async () => {
      const base64Data = 'AQIDBAU=';

      const result = convertToOpenAIChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data' as const, data: base64Data },
              },
            ],
          },
        ],
        systemMessageMode: 'system',
      });

      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'part-0.pdf',
                file_data: 'data:application/pdf;base64,AQIDBAU=',
              },
            },
          ],
        },
      ]);
    });

    it('should throw error for unsupported file types', async () => {
      const base64Data = 'AQIDBAU=';

      expect(() => {
        convertToOpenAIChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  mediaType: 'text/plain',
                  data: { type: 'data' as const, data: base64Data },
                },
              ],
            },
          ],
          systemMessageMode: 'system',
        });
      }).toThrow('file part media type text/plain');
    });

    it('should throw error for file URLs', async () => {
      expect(() => {
        convertToOpenAIChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
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
          systemMessageMode: 'system',
        });
      }).toThrow('PDF file parts with URLs');
    });

    describe('top-level-only media type resolution', () => {
      const pngBase64 = 'iVBORw0KGgo=';

      it('detects image subtype from inline bytes for top-level "image"', () => {
        const result = convertToOpenAIChatMessages({
          prompt: [
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
          ],
        });
        expect((result.messages[0]!.content as unknown[])[0]).toEqual({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${pngBase64}`,
            detail: undefined,
          },
        });
      });

      it('normalizes image/* wildcard via detection', () => {
        const result = convertToOpenAIChatMessages({
          prompt: [
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
          ],
        });
        expect((result.messages[0]!.content as unknown[])[0]).toEqual({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${pngBase64}`,
            detail: undefined,
          },
        });
      });

      it('passes through URL source for top-level-only image (provider accepts raw URL)', () => {
        const result = convertToOpenAIChatMessages({
          prompt: [
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
          ],
        });
        expect((result.messages[0]!.content as unknown[])[0]).toEqual({
          type: 'image_url',
          image_url: {
            url: 'https://example.com/x.png',
            detail: undefined,
          },
        });
      });

      it('throws for top-level-only application (PDF requires full resolution) with URL source', () => {
        expect(() =>
          convertToOpenAIChatMessages({
            prompt: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    mediaType: 'application',
                    data: {
                      type: 'url' as const,
                      url: new URL('https://example.com/x.pdf'),
                    },
                  },
                ],
              },
            ],
          }),
        ).toThrow(/media type "application".*not passed as inline bytes/);
      });

      it('preserves full image/png pass-through', () => {
        const result = convertToOpenAIChatMessages({
          prompt: [
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
          ],
        });
        expect((result.messages[0]!.content as unknown[])[0]).toEqual({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${pngBase64}`,
            detail: undefined,
          },
        });
      });
    });
  });
});

describe('tool calls', () => {
  it('should add a prompt cache breakpoint to assistant text content', () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Cached assistant content',
              providerOptions: {
                openai: { promptCacheBreakpoint: { mode: 'explicit' } },
              },
            },
          ],
        },
      ],
    });

    expect(result.messages).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Cached assistant content',
            prompt_cache_breakpoint: { mode: 'explicit' },
          },
        ],
        tool_calls: undefined,
      },
    ]);
  });

  it('should add a prompt cache breakpoint to tool text content', () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'cached-tool',
              toolName: 'cached-tool',
              output: {
                type: 'text',
                value: 'Cached tool content',
                providerOptions: {
                  openai: { promptCacheBreakpoint: { mode: 'explicit' } },
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.messages).toEqual([
      {
        role: 'tool',
        content: [
          {
            type: 'text',
            text: 'Cached tool content',
            prompt_cache_breakpoint: { mode: 'explicit' },
          },
        ],
        tool_call_id: 'cached-tool',
      },
    ]);
  });

  it('should stringify arguments to tool calls', () => {
    const result = convertToOpenAIChatMessages({
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
    });

    expect(result.messages).toEqual([
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
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: '' }],
        },
      ],
    });

    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "content": "",
          "role": "assistant",
          "tool_calls": undefined,
        },
      ]
    `);
  });

  it('should default missing tool call input to an empty object', () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'quux',
              toolName: 'thwomp',
              input: undefined,
            },
          ],
        },
      ],
    });

    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "content": null,
          "role": "assistant",
          "tool_calls": [
            {
              "function": {
                "arguments": "{}",
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

  it('should handle different tool output types', () => {
    const result = convertToOpenAIChatMessages({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'text-tool',
              toolName: 'text-tool',
              output: { type: 'text', value: 'Hello world' },
            },
            {
              type: 'tool-result',
              toolCallId: 'error-tool',
              toolName: 'error-tool',
              output: { type: 'error-text', value: 'Something went wrong' },
            },
          ],
        },
      ],
    });

    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "content": "Hello world",
          "role": "tool",
          "tool_call_id": "text-tool",
        },
        {
          "content": "Something went wrong",
          "role": "tool",
          "tool_call_id": "error-tool",
        },
      ]
    `);
  });
});
