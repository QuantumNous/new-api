import { describe, it, expect } from 'vitest';
import type { SharedV4Warning } from '@ai-sdk/provider';
import { createToolNameMapping } from '@ai-sdk/provider-utils';
import { convertToAnthropicPrompt } from './convert-to-anthropic-prompt';
import { CacheControlValidator } from './get-cache-control';

// Create a default identity tool name mapping for tests (no tools = no mapping)
const defaultToolNameMapping = createToolNameMapping({
  tools: [],
  providerToolNames: {},
});

describe('system messages', () => {
  it('should convert a single system message into an anthropic system message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [{ role: 'system', content: 'This is a system message' }],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [],
        system: [{ type: 'text', text: 'This is a system message' }],
      },
      betas: new Set(),
    });
  });

  it('should convert multiple system messages into an anthropic system message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        { role: 'system', content: 'This is a system message' },
        { role: 'system', content: 'This is another system message' },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [],
        system: [
          { type: 'text', text: 'This is a system message' },
          { type: 'text', text: 'This is another system message' },
        ],
      },
      betas: new Set(),
    });
  });

  it('should emit a mid-conversation system message inline and add the beta', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        { role: 'system', content: 'initial' },
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
        { role: 'system', content: 'switch tone' },
        { role: 'user', content: [{ type: 'text', text: 'go' }] },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result.prompt.system).toEqual([{ type: 'text', text: 'initial' }]);
    expect(result.prompt.messages).toContainEqual({
      role: 'system',
      content: [{ type: 'text', text: 'switch tone' }],
    });
    expect(result.betas.has('mid-conversation-system-2026-04-07')).toBe(true);
  });
});

describe('user messages', () => {
  it('should add image parts for UInt8Array images', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'AAECAw==' },
              mediaType: 'image/png',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  data: 'AAECAw==',
                  media_type: 'image/png',
                  type: 'base64',
                },
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  it('should add image parts for URL images', async () => {
    const result = await convertToAnthropicPrompt({
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
              mediaType: 'image/*',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'https://example.com/image.png',
                },
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  describe('top-level-only media type resolution', () => {
    const pngBase64 = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]).toString('base64');
    const pdfBase64 = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]).toString(
      'base64',
    );

    it('detects image subtype from inline bytes for top-level "image"', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: pngBase64 },
                mediaType: 'image',
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });
      expect(result.prompt.messages[0].content[0]).toEqual({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: pngBase64,
        },
      });
    });

    it('normalizes image/* via detection', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: pngBase64 },
                mediaType: 'image/*',
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });
      expect(
        (result.prompt.messages[0].content[0] as any).source.media_type,
      ).toBe('image/png');
    });

    it('passes through URL for top-level-only image (Anthropic accepts URL source)', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: {
                  type: 'url' as const,
                  url: new URL('https://example.com/x.png'),
                },
                mediaType: 'image',
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });
      expect(result.prompt.messages[0].content[0]).toEqual({
        type: 'image',
        source: {
          type: 'url',
          url: 'https://example.com/x.png',
        },
      });
    });

    it('detects PDF subtype from inline bytes for top-level "application"', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: pdfBase64 },
                mediaType: 'application',
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });
      expect(
        (result.prompt.messages[0].content[0] as any).source.media_type,
      ).toBe('application/pdf');
    });

    it('preserves full image/png pass-through', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: pngBase64 },
                mediaType: 'image/png',
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });
      expect(
        (result.prompt.messages[0].content[0] as any).source.media_type,
      ).toBe('image/png');
    });

    it('still routes text/plain inline text through document source', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'text' as const, text: 'hello' },
                mediaType: 'text/plain',
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });
      expect(result.prompt.messages[0].content[0]).toMatchObject({
        type: 'document',
        source: {
          type: 'text',
          media_type: 'text/plain',
          data: 'hello',
        },
      });
    });
  });

  it('should treat URL strings in image file data as URLs, not base64)', async () => {
    const result = await convertToAnthropicPrompt({
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
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'https://example.com/image.png',
                },
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  it('should treat URL strings in PDF file data as URLs, not base64)', async () => {
    const result = await convertToAnthropicPrompt({
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
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'url',
                  url: 'https://example.com/document.pdf',
                },
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(['pdfs-2024-09-25']),
    });
  });

  it('should add PDF file parts for base64 PDFs', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64PDFdata' },
              mediaType: 'application/pdf',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: 'base64PDFdata',
                },
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(['pdfs-2024-09-25']),
    });
  });

  it('should add PDF file parts for URL PDFs', async () => {
    const result = await convertToAnthropicPrompt({
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
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'url',
                  url: 'https://example.com/document.pdf',
                },
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(['pdfs-2024-09-25']),
    });
  });

  it('should add text file parts for text/plain documents', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'data' as const,
                data: Buffer.from('sample text content', 'utf-8').toString(
                  'base64',
                ),
              },
              mediaType: 'text/plain',
              filename: 'sample.txt',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'text',
                  media_type: 'text/plain',
                  data: 'sample text content',
                },
                title: 'sample.txt',
                cache_control: undefined,
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  it('should map inline text file parts to inline text document source', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'text' as const, text: 'inline text content' },
              mediaType: 'text/plain',
              filename: 'inline.txt',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'text',
                  media_type: 'text/plain',
                  data: 'inline text content',
                },
                title: 'inline.txt',
                cache_control: undefined,
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  it('should throw error for unsupported file types', async () => {
    await expect(
      convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data' as const, data: 'base64data' },
                mediaType: 'video/mp4',
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      }),
    ).rejects.toThrow('media type: video/mp4');
  });

  it('should convert messages with image file parts using provider reference', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: {
                type: 'reference' as const,
                reference: { anthropic: 'file-img-12345' },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'file',
                  file_id: 'file-img-12345',
                },
                cache_control: undefined,
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(['files-api-2025-04-14']),
    });
  });

  it('should convert messages with PDF file parts using provider reference', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              data: {
                type: 'reference' as const,
                reference: { anthropic: 'file-pdf-12345' },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'file',
                  file_id: 'file-pdf-12345',
                },
                cache_control: undefined,
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(['files-api-2025-04-14']),
    });
  });

  it('should convert messages with text/plain file parts using provider reference', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'text/plain',
              data: {
                type: 'reference' as const,
                reference: { anthropic: 'file-txt-12345' },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'file',
                  file_id: 'file-txt-12345',
                },
                cache_control: undefined,
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(['files-api-2025-04-14']),
    });
  });

  it('should convert provider referenced file parts to container uploads when requested', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this data.',
            },
            {
              type: 'file',
              mediaType: 'text/csv',
              data: {
                type: 'reference' as const,
                reference: { anthropic: 'file-csv-12345' },
              },
              providerOptions: {
                anthropic: {
                  containerUpload: true,
                },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this data.',
                cache_control: undefined,
              },
              {
                type: 'container_upload',
                file_id: 'file-csv-12345',
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(['files-api-2025-04-14']),
    });
  });

  it('should throw when provider reference does not contain anthropic key', async () => {
    await expect(
      convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: {
                  type: 'reference' as const,
                  reference: { openai: 'file-xyz' },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      }),
    ).rejects.toThrow(
      "No provider reference found for provider 'anthropic'. Available providers: openai",
    );
  });
});

describe('tool messages', () => {
  it('should convert a single tool result into an anthropic user message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'tool-1',
              toolCallId: 'tool-call-1',
              output: {
                type: 'json',
                value: { test: 'This is a tool message' },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-call-1',
                is_error: undefined,
                content: JSON.stringify({ test: 'This is a tool message' }),
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  it('should convert multiple tool results into an anthropic user message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'tool-1',
              toolCallId: 'tool-call-1',
              output: {
                type: 'json',
                value: { test: 'This is a tool message' },
              },
            },
            {
              type: 'tool-result',
              toolName: 'tool-2',
              toolCallId: 'tool-call-2',
              output: { type: 'json', value: { something: 'else' } },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-call-1',
                is_error: undefined,
                content: JSON.stringify({ test: 'This is a tool message' }),
              },
              {
                type: 'tool_result',
                tool_use_id: 'tool-call-2',
                is_error: undefined,
                content: JSON.stringify({ something: 'else' }),
              },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  it('should combine user and tool messages', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'tool-1',
              toolCallId: 'tool-call-1',
              output: {
                type: 'json',
                value: { test: 'This is a tool message' },
              },
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'This is a user message' }],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-call-1',
                is_error: undefined,
                content: JSON.stringify({ test: 'This is a tool message' }),
              },
              { type: 'text', text: 'This is a user message' },
            ],
          },
        ],
        system: undefined,
      },
      betas: new Set(),
    });
  });

  it('should handle tool result with content parts', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'image-generator',
              toolCallId: 'image-gen-1',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'text',
                    text: 'Image generated successfully',
                  },
                  {
                    type: 'file',
                    data: { type: 'data', data: 'AAECAw==' },
                    mediaType: 'image/png',
                  },
                ],
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "content": [
                    {
                      "text": "Image generated successfully",
                      "type": "text",
                    },
                    {
                      "source": {
                        "data": "AAECAw==",
                        "media_type": "image/png",
                        "type": "base64",
                      },
                      "type": "image",
                    },
                  ],
                  "is_error": undefined,
                  "tool_use_id": "image-gen-1",
                  "type": "tool_result",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  it('should handle tool result with PDF content', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'pdf-generator',
              toolCallId: 'pdf-gen-1',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'text',
                    text: 'PDF generated successfully',
                  },
                  {
                    type: 'file',
                    data: {
                      type: 'data',
                      data: 'JVBERi0xLjQKJeLjz9MKNCAwIG9iago=', // Sample PDF base64
                    },
                    mediaType: 'application/pdf',
                  },
                ],
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {
          "pdfs-2024-09-25",
        },
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "content": [
                    {
                      "text": "PDF generated successfully",
                      "type": "text",
                    },
                    {
                      "source": {
                        "data": "JVBERi0xLjQKJeLjz9MKNCAwIG9iago=",
                        "media_type": "application/pdf",
                        "type": "base64",
                      },
                      "type": "document",
                    },
                  ],
                  "is_error": undefined,
                  "tool_use_id": "pdf-gen-1",
                  "type": "tool_result",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  it('should handle tool result with custom tool-reference content for custom tool search', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'searchTools',
              toolCallId: 'search-1',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'custom',
                    providerOptions: {
                      anthropic: {
                        type: 'tool-reference',
                        toolName: 'get_weather',
                      },
                    },
                  },
                  {
                    type: 'custom',
                    providerOptions: {
                      anthropic: {
                        type: 'tool-reference',
                        toolName: 'get_forecast',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "content": [
                    {
                      "tool_name": "get_weather",
                      "type": "tool_reference",
                    },
                    {
                      "tool_name": "get_forecast",
                      "type": "tool_reference",
                    },
                  ],
                  "is_error": undefined,
                  "tool_use_id": "search-1",
                  "type": "tool_result",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  it('should handle tool result with url-based PDF content', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'get-pdf',
              toolCallId: 'get-pdf-1',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'file',
                    data: {
                      type: 'url',
                      url: new URL('https://example.com/document.pdf'),
                    },
                    mediaType: 'application/pdf',
                  },
                ],
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "content": [
                    {
                      "source": {
                        "type": "url",
                        "url": "https://example.com/document.pdf",
                      },
                      "type": "document",
                    },
                  ],
                  "is_error": undefined,
                  "tool_use_id": "get-pdf-1",
                  "type": "tool_result",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  it('should handle tool result with url-based image content', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'image-generator',
              toolCallId: 'image-gen-1',
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
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "content": [
                    {
                      "source": {
                        "type": "url",
                        "url": "https://example.com/image.png",
                      },
                      "type": "image",
                    },
                  ],
                  "is_error": undefined,
                  "tool_use_id": "image-gen-1",
                  "type": "tool_result",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });
});

describe('assistant messages', () => {
  it('should remove trailing whitespace from last assistant message when there is no further user message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'user content' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'assistant content  ' }],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'user content' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'assistant content' }],
          },
        ],
      },
      betas: new Set(),
    });
  });

  it('should remove trailing whitespace from last assistant message with multi-part content when there is no further user message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'user content' }],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'assistant ' },
            { type: 'text', text: 'content  ' },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'user content' }],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'assistant ' },
              { type: 'text', text: 'content' },
            ],
          },
        ],
      },
      betas: new Set(),
    });
  });

  it('should keep trailing whitespace from assistant message when there is a further user message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'user content' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'assistant content  ' }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'user content 2' }],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'user content' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'assistant content  ' }],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'user content 2' }],
          },
        ],
      },
      betas: new Set(),
    });
  });

  it('should combine multiple sequential assistant messages into a single message', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Hi!' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'World' }] },
        { role: 'assistant', content: [{ type: 'text', text: '!' }] },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'Hi!' }] },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'text', text: 'World' },
              { type: 'text', text: '!' },
            ],
          },
        ],
      },
      betas: new Set(),
    });
  });

  it('should convert assistant message reasoning parts with signature into thinking parts when sendReasoning is true', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'I need to count the number of "r"s in the word "strawberry".',
              providerOptions: {
                anthropic: {
                  signature: 'test-signature',
                },
              },
            },
            {
              type: 'text',
              text: 'The word "strawberry" has 2 "r"s.',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'thinking',
                thinking:
                  'I need to count the number of "r"s in the word "strawberry".',
                signature: 'test-signature',
              },
              {
                type: 'text',
                text: 'The word "strawberry" has 2 "r"s.',
              },
            ],
          },
        ],
      },
      betas: new Set(),
    });
    expect(warnings).toEqual([]);
  });

  it('should ignore reasoning parts without signature into thinking parts when sendReasoning is true', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'I need to count the number of "r"s in the word "strawberry".',
            },
            {
              type: 'text',
              text: 'The word "strawberry" has 2 "r"s.',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "text": "The word "strawberry" has 2 "r"s.",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`
      [
        {
          "message": "unsupported reasoning metadata",
          "type": "other",
        },
      ]
    `);
  });

  it('should omit assistant message reasoning parts with signature when sendReasoning is false', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'I need to count the number of "r"s in the word "strawberry".',
              providerOptions: {
                anthropic: {
                  signature: 'test-signature',
                },
              },
            },
            {
              type: 'text',
              text: 'The word "strawberry" has 2 "r"s.',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'The word "strawberry" has 2 "r"s.',
              },
            ],
          },
        ],
      },
      betas: new Set(),
    });
    expect(warnings).toEqual([
      {
        type: 'other',
        message: 'sending reasoning content is disabled for this model',
      },
    ]);
  });

  it('should omit reasoning parts without signature when sendReasoning is false', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'I need to count the number of "r"s in the word "strawberry".',
            },
            {
              type: 'text',
              text: 'The word "strawberry" has 2 "r"s.',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toEqual({
      prompt: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'The word "strawberry" has 2 "r"s.',
              },
            ],
          },
        ],
      },
      betas: new Set(),
    });
    expect(warnings).toEqual([
      {
        type: 'other',
        message: 'sending reasoning content is disabled for this model',
      },
    ]);
  });

  it('should convert anthropic web_search tool call and result parts', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                query: 'San Francisco major news events June 22 2025',
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_011cNtbtzFARKPcAcp7w4nh9',
              toolName: 'web_search',
              type: 'tool-call',
            },
            {
              output: {
                type: 'json',
                value: [
                  {
                    url: 'https://patch.com/california/san-francisco/calendar',
                    title: 'San Francisco Calendar',
                    pageAge: null,
                    encryptedContent: 'encrypted-content',
                    type: 'web_search_result',
                  },
                ],
              },
              toolCallId: 'srvtoolu_011cNtbtzFARKPcAcp7w4nh9',
              toolName: 'web_search',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "id": "srvtoolu_011cNtbtzFARKPcAcp7w4nh9",
                  "input": {
                    "query": "San Francisco major news events June 22 2025",
                  },
                  "name": "web_search",
                  "type": "server_tool_use",
                },
                {
                  "cache_control": undefined,
                  "content": [
                    {
                      "encrypted_content": "encrypted-content",
                      "page_age": null,
                      "title": "San Francisco Calendar",
                      "type": "web_search_result",
                      "url": "https://patch.com/california/san-francisco/calendar",
                    },
                  ],
                  "tool_use_id": "srvtoolu_011cNtbtzFARKPcAcp7w4nh9",
                  "type": "web_search_tool_result",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should move regular tool_use blocks after provider-executed web_search results', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I will save a note and search the web.',
            },
            {
              type: 'tool-call',
              toolCallId: 'toolu_regular',
              toolName: 'saveNote',
              input: {
                note: 'Searching for basketball news',
              },
            },
            {
              type: 'tool-call',
              toolCallId: 'srvtoolu_web_search',
              toolName: 'web_search',
              providerExecuted: true,
              input: {
                query: 'basketball news today',
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'srvtoolu_web_search',
              toolName: 'web_search',
              output: {
                type: 'json',
                value: [
                  {
                    url: 'https://www.nba.com/news',
                    title: 'NBA News',
                    pageAge: '1 hour ago',
                    encryptedContent: 'encrypted-content',
                    type: 'web_search_result',
                  },
                ],
              },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'toolu_regular',
              toolName: 'saveNote',
              output: {
                type: 'json',
                value: {
                  success: true,
                },
              },
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result.prompt.messages).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I will save a note and search the web.',
            cache_control: undefined,
          },
          {
            type: 'server_tool_use',
            id: 'srvtoolu_web_search',
            name: 'web_search',
            input: {
              query: 'basketball news today',
            },
            cache_control: undefined,
          },
          {
            type: 'web_search_tool_result',
            tool_use_id: 'srvtoolu_web_search',
            content: [
              {
                url: 'https://www.nba.com/news',
                title: 'NBA News',
                page_age: '1 hour ago',
                encrypted_content: 'encrypted-content',
                type: 'web_search_result',
              },
            ],
            cache_control: undefined,
          },
          {
            type: 'tool_use',
            id: 'toolu_regular',
            name: 'saveNote',
            input: {
              note: 'Searching for basketball news',
            },
            cache_control: undefined,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_regular',
            content: JSON.stringify({ success: true }),
            is_error: undefined,
          },
        ],
      },
    ]);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should not move regular tool_use blocks across thinking blocks', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'Think before the initial note.',
              providerOptions: {
                anthropic: {
                  signature: 'test-signature-1',
                },
              },
            },
            {
              type: 'tool-call',
              toolCallId: 'toolu_initial',
              toolName: 'saveNote',
              input: {
                note: 'phase 1: initial plan',
              },
            },
            {
              type: 'reasoning',
              text: 'Think before the revised note.',
              providerOptions: {
                anthropic: {
                  signature: 'test-signature-2',
                },
              },
            },
            {
              type: 'tool-call',
              toolCallId: 'toolu_revised',
              toolName: 'saveNote',
              input: {
                note: 'phase 2: revised plan',
              },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'toolu_initial',
              toolName: 'saveNote',
              output: {
                type: 'json',
                value: {
                  success: true,
                },
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'toolu_revised',
              toolName: 'saveNote',
              output: {
                type: 'json',
                value: {
                  success: true,
                },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result.prompt.messages).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking: 'Think before the initial note.',
            signature: 'test-signature-1',
          },
          {
            type: 'tool_use',
            id: 'toolu_initial',
            name: 'saveNote',
            input: {
              note: 'phase 1: initial plan',
            },
            cache_control: undefined,
          },
          {
            type: 'thinking',
            thinking: 'Think before the revised note.',
            signature: 'test-signature-2',
          },
          {
            type: 'tool_use',
            id: 'toolu_revised',
            name: 'saveNote',
            input: {
              note: 'phase 2: revised plan',
            },
            cache_control: undefined,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_initial',
            content: JSON.stringify({ success: true }),
            is_error: undefined,
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_revised',
            content: JSON.stringify({ success: true }),
            is_error: undefined,
          },
        ],
      },
    ]);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should convert anthropic web_search tool call with error result (error-json string)', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                query: 'test query',
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_error1',
              toolName: 'web_search',
              type: 'tool-call',
            },
            {
              output: {
                type: 'error-json',
                value: JSON.stringify({
                  type: 'web_search_tool_result_error',
                  errorCode: 'invalid_tool_input',
                }),
              },
              toolCallId: 'srvtoolu_error1',
              toolName: 'web_search',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "id": "srvtoolu_error1",
                  "input": {
                    "query": "test query",
                  },
                  "name": "web_search",
                  "type": "server_tool_use",
                },
                {
                  "cache_control": undefined,
                  "content": {
                    "error_code": "invalid_tool_input",
                    "type": "web_search_tool_result_error",
                  },
                  "tool_use_id": "srvtoolu_error1",
                  "type": "web_search_tool_result",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should convert anthropic web_search tool call with error result (error-json object)', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                query: 'test query',
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_error2',
              toolName: 'web_search',
              type: 'tool-call',
            },
            {
              output: {
                type: 'error-json',
                value: {
                  type: 'web_search_tool_result_error',
                  errorCode: 'max_uses_exceeded',
                },
              },
              toolCallId: 'srvtoolu_error2',
              toolName: 'web_search',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "id": "srvtoolu_error2",
                  "input": {
                    "query": "test query",
                  },
                  "name": "web_search",
                  "type": "server_tool_use",
                },
                {
                  "cache_control": undefined,
                  "content": {
                    "error_code": "max_uses_exceeded",
                    "type": "web_search_tool_result_error",
                  },
                  "tool_use_id": "srvtoolu_error2",
                  "type": "web_search_tool_result",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should convert anthropic web_fetch tool call and result parts', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                url: 'https://raw.githubusercontent.com/vercel/ai/blob/main/examples/ai-functions/data/ai.pdf',
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_011cNtbtzFARKPcAcp7w4nh9',
              toolName: 'web_fetch',
              type: 'tool-call',
            },
            {
              output: {
                type: 'json',
                value: {
                  type: 'web_fetch_result',
                  url: 'https://raw.githubusercontent.com/vercel/ai/blob/main/examples/ai-functions/data/ai.pdf',
                  retrievedAt: '2025-01-01T00:00:00.000Z',
                  content: {
                    type: 'document',
                    title: 'AI.pdf',
                    citations: { enabled: true },
                    source: {
                      type: 'text',
                      mediaType: 'text/plain',
                      data: 'The PDF says about AI.',
                    },
                  },
                },
              },
              toolCallId: 'srvtoolu_011cNtbtzFARKPcAcp7w4nh9',
              toolName: 'web_fetch',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "id": "srvtoolu_011cNtbtzFARKPcAcp7w4nh9",
                  "input": {
                    "url": "https://raw.githubusercontent.com/vercel/ai/blob/main/examples/ai-functions/data/ai.pdf",
                  },
                  "name": "web_fetch",
                  "type": "server_tool_use",
                },
                {
                  "cache_control": undefined,
                  "content": {
                    "content": {
                      "citations": {
                        "enabled": true,
                      },
                      "source": {
                        "data": "The PDF says about AI.",
                        "media_type": "text/plain",
                        "type": "text",
                      },
                      "title": "AI.pdf",
                      "type": "document",
                    },
                    "retrieved_at": "2025-01-01T00:00:00.000Z",
                    "type": "web_fetch_result",
                    "url": "https://raw.githubusercontent.com/vercel/ai/blob/main/examples/ai-functions/data/ai.pdf",
                  },
                  "tool_use_id": "srvtoolu_011cNtbtzFARKPcAcp7w4nh9",
                  "type": "web_fetch_tool_result",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should convert anthropic web_fetch tool call with error result', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                url: 'https://httpbin.org/status/500',
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_016yTvwN6L1sDdjdPUzPbZRV',
              toolName: 'web_fetch',
              type: 'tool-call',
            },
            {
              output: {
                type: 'error-json',
                value: JSON.stringify({
                  type: 'web_fetch_tool_result_error',
                  errorCode: 'url_not_accessible',
                }),
              },
              toolCallId: 'srvtoolu_016yTvwN6L1sDdjdPUzPbZRV',
              toolName: 'web_fetch',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "id": "srvtoolu_016yTvwN6L1sDdjdPUzPbZRV",
                  "input": {
                    "url": "https://httpbin.org/status/500",
                  },
                  "name": "web_fetch",
                  "type": "server_tool_use",
                },
                {
                  "cache_control": undefined,
                  "content": {
                    "error_code": "url_not_accessible",
                    "type": "web_fetch_tool_result_error",
                  },
                  "tool_use_id": "srvtoolu_016yTvwN6L1sDdjdPUzPbZRV",
                  "type": "web_fetch_tool_result",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should convert anthropic web_fetch tool call with error result as object', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                url: 'https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=193156',
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_01JteKo9VRHDKZ1rdMXywnwD',
              toolName: 'web_fetch',
              type: 'tool-call',
            },
            {
              output: {
                type: 'error-json',
                value: {
                  type: 'web_fetch_tool_result_error',
                  errorCode: 'url_not_allowed',
                },
              },
              toolCallId: 'srvtoolu_01JteKo9VRHDKZ1rdMXywnwD',
              toolName: 'web_fetch',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "id": "srvtoolu_01JteKo9VRHDKZ1rdMXywnwD",
                  "input": {
                    "url": "https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=193156",
                  },
                  "name": "web_fetch",
                  "type": "server_tool_use",
                },
                {
                  "cache_control": undefined,
                  "content": {
                    "error_code": "url_not_allowed",
                    "type": "web_fetch_tool_result_error",
                  },
                  "tool_use_id": "srvtoolu_01JteKo9VRHDKZ1rdMXywnwD",
                  "type": "web_fetch_tool_result",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should convert anthropic web_fetch tool call with error result as malformed string', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                url: 'https://example.com',
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_test123',
              toolName: 'web_fetch',
              type: 'tool-call',
            },
            {
              output: {
                type: 'error-json',
                value: 'not valid json at all',
              },
              toolCallId: 'srvtoolu_test123',
              toolName: 'web_fetch',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result.prompt.messages[0].content[1]).toMatchInlineSnapshot(`
      {
        "cache_control": undefined,
        "content": {
          "error_code": "unavailable",
          "type": "web_fetch_tool_result_error",
        },
        "tool_use_id": "srvtoolu_test123",
        "type": "web_fetch_tool_result",
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should convert anthropic tool_search_tool_regex tool call and result parts', async () => {
    const warnings: SharedV4Warning[] = [];
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              input: {
                pattern: 'weather|forecast',
                limit: 10,
              },
              providerExecuted: true,
              toolCallId: 'srvtoolu_01SACvPAnp6ucMJsstB5qb3f',
              toolName: 'tool_search_tool_regex',
              type: 'tool-call',
            },
            {
              output: {
                type: 'json',
                value: [
                  {
                    type: 'tool_reference',
                    toolName: 'get_weather',
                  },
                ],
              },
              toolCallId: 'srvtoolu_01SACvPAnp6ucMJsstB5qb3f',
              toolName: 'tool_search_tool_regex',
              type: 'tool-result',
            },
          ],
        },
      ],
      sendReasoning: false,
      warnings,
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {},
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "id": "srvtoolu_01SACvPAnp6ucMJsstB5qb3f",
                  "input": {
                    "limit": 10,
                    "pattern": "weather|forecast",
                  },
                  "name": "tool_search_tool_regex",
                  "type": "server_tool_use",
                },
                {
                  "cache_control": undefined,
                  "content": {
                    "tool_references": [
                      {
                        "tool_name": "get_weather",
                        "type": "tool_reference",
                      },
                    ],
                    "type": "tool_search_tool_search_result",
                  },
                  "tool_use_id": "srvtoolu_01SACvPAnp6ucMJsstB5qb3f",
                  "type": "tool_search_tool_result",
                },
              ],
              "role": "assistant",
            },
          ],
          "system": undefined,
        },
      }
    `);
    expect(warnings).toMatchInlineSnapshot(`[]`);
  });

  describe('advisor 20260301 multi-turn round-trip', () => {
    it('should convert advisor server_tool_use + advisor_result back to the API shape', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                input: {},
                providerExecuted: true,
                toolCallId: 'srvtoolu_advisor_abc123',
                toolName: 'advisor',
                type: 'tool-call',
              },
              {
                output: {
                  type: 'json',
                  value: {
                    type: 'advisor_result',
                    text: 'Use a channel-based coordination pattern. Close the input channel first, then wait on a WaitGroup.',
                  },
                },
                toolCallId: 'srvtoolu_advisor_abc123',
                toolName: 'advisor',
                type: 'tool-result',
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "prompt": {
            "messages": [
              {
                "content": [
                  {
                    "cache_control": undefined,
                    "id": "srvtoolu_advisor_abc123",
                    "input": {},
                    "name": "advisor",
                    "type": "server_tool_use",
                  },
                  {
                    "cache_control": undefined,
                    "content": {
                      "text": "Use a channel-based coordination pattern. Close the input channel first, then wait on a WaitGroup.",
                      "type": "advisor_result",
                    },
                    "tool_use_id": "srvtoolu_advisor_abc123",
                    "type": "advisor_tool_result",
                  },
                ],
                "role": "assistant",
              },
            ],
            "system": undefined,
          },
        }
      `);
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should round-trip advisor_redacted_result verbatim across turns', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                input: {},
                providerExecuted: true,
                toolCallId: 'srvtoolu_advisor_redacted',
                toolName: 'advisor',
                type: 'tool-call',
              },
              {
                output: {
                  type: 'json',
                  value: {
                    type: 'advisor_redacted_result',
                    encryptedContent: 'opaque-encrypted-blob-xyz',
                  },
                },
                toolCallId: 'srvtoolu_advisor_redacted',
                toolName: 'advisor',
                type: 'tool-result',
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      // The encrypted blob must round-trip verbatim under the snake_case
      // wire field name `encrypted_content` so the server can decrypt it.
      expect(result.prompt.messages[0].content[1]).toMatchInlineSnapshot(`
        {
          "cache_control": undefined,
          "content": {
            "encrypted_content": "opaque-encrypted-blob-xyz",
            "type": "advisor_redacted_result",
          },
          "tool_use_id": "srvtoolu_advisor_redacted",
          "type": "advisor_tool_result",
        }
      `);
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should convert advisor_tool_result_error back to the API shape', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                input: {},
                providerExecuted: true,
                toolCallId: 'srvtoolu_advisor_err',
                toolName: 'advisor',
                type: 'tool-call',
              },
              {
                output: {
                  type: 'json',
                  value: {
                    type: 'advisor_tool_result_error',
                    errorCode: 'max_uses_exceeded',
                  },
                },
                toolCallId: 'srvtoolu_advisor_err',
                toolName: 'advisor',
                type: 'tool-result',
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result.prompt.messages[0].content[1]).toMatchInlineSnapshot(`
        {
          "cache_control": undefined,
          "content": {
            "error_code": "max_uses_exceeded",
            "type": "advisor_tool_result_error",
          },
          "tool_use_id": "srvtoolu_advisor_err",
          "type": "advisor_tool_result",
        }
      `);
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should preserve multiple advisor turns interleaved with text', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Build a concurrent worker pool in Go with graceful shutdown.',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me consult the advisor on this.' },
              {
                input: {},
                providerExecuted: true,
                toolCallId: 'srvtoolu_advisor_1',
                toolName: 'advisor',
                type: 'tool-call',
              },
              {
                output: {
                  type: 'json',
                  value: {
                    type: 'advisor_result',
                    text: 'Use channels and a WaitGroup.',
                  },
                },
                toolCallId: 'srvtoolu_advisor_1',
                toolName: 'advisor',
                type: 'tool-result',
              },
              {
                type: 'text',
                text: 'Here is the implementation.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Now add a max-in-flight limit of 10.' },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result.prompt.messages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "cache_control": undefined,
                "text": "Build a concurrent worker pool in Go with graceful shutdown.",
                "type": "text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "cache_control": undefined,
                "text": "Let me consult the advisor on this.",
                "type": "text",
              },
              {
                "cache_control": undefined,
                "id": "srvtoolu_advisor_1",
                "input": {},
                "name": "advisor",
                "type": "server_tool_use",
              },
              {
                "cache_control": undefined,
                "content": {
                  "text": "Use channels and a WaitGroup.",
                  "type": "advisor_result",
                },
                "tool_use_id": "srvtoolu_advisor_1",
                "type": "advisor_tool_result",
              },
              {
                "cache_control": undefined,
                "text": "Here is the implementation.",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "cache_control": undefined,
                "text": "Now add a max-in-flight limit of 10.",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should warn (and not emit a result block) when output type is unsupported', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                input: {},
                providerExecuted: true,
                toolCallId: 'srvtoolu_advisor_bad',
                toolName: 'advisor',
                type: 'tool-call',
              },
              {
                output: {
                  type: 'text',
                  value: 'should be json',
                },
                toolCallId: 'srvtoolu_advisor_bad',
                toolName: 'advisor',
                type: 'tool-result',
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      // Only the server_tool_use block is emitted; the result is skipped.
      expect(result.prompt.messages[0].content).toHaveLength(1);
      expect(warnings).toMatchInlineSnapshot(`
        [
          {
            "message": "provider executed tool result output type text for tool advisor is not supported",
            "type": "other",
          },
        ]
      `);
    });
  });

  describe('code_execution 20250522', () => {
    it('should convert anthropic code_execution tool call and result parts', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                input: {
                  code: 'print("Hello, world!")',
                },
                providerExecuted: true,
                toolCallId: 'srvtoolu_01XyZ1234567890',
                toolName: 'code_execution',
                type: 'tool-call',
              },
              {
                output: {
                  type: 'json',
                  value: {
                    type: 'code_execution_result',
                    stdout: 'Hello, world!',
                    stderr: '',
                    return_code: 0,
                  },
                },
                toolCallId: 'srvtoolu_01XyZ1234567890',
                toolName: 'code_execution',
                type: 'tool-result',
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "prompt": {
            "messages": [
              {
                "content": [
                  {
                    "cache_control": undefined,
                    "id": "srvtoolu_01XyZ1234567890",
                    "input": {
                      "code": "print("Hello, world!")",
                    },
                    "name": "code_execution",
                    "type": "server_tool_use",
                  },
                  {
                    "cache_control": undefined,
                    "content": {
                      "content": [],
                      "return_code": 0,
                      "stderr": "",
                      "stdout": "Hello, world!",
                      "type": "code_execution_result",
                    },
                    "tool_use_id": "srvtoolu_01XyZ1234567890",
                    "type": "code_execution_tool_result",
                  },
                ],
                "role": "assistant",
              },
            ],
            "system": undefined,
          },
        }
      `);
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should pass back encrypted_code_execution_result for multi-turn (web_fetch_20260209/web_search_20260209)', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'srvtoolu_webfetch_01',
                toolName: 'web_fetch',
                input: { url: 'https://example.com' },
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'srvtoolu_webfetch_01',
                toolName: 'web_fetch',
                output: {
                  type: 'json',
                  value: {
                    type: 'web_fetch_result',
                    url: 'https://example.com',
                    retrievedAt: '2026-01-01T00:00:00Z',
                    content: {
                      type: 'document',
                      title: 'Example',
                      source: {
                        type: 'text',
                        mediaType: 'text/plain',
                        data: 'hello',
                      },
                    },
                  },
                },
              },
              {
                type: 'tool-call',
                toolCallId: 'srvtoolu_codeexec_01',
                toolName: 'code_execution',
                input: { code: 'print("done")' },
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'srvtoolu_codeexec_01',
                toolName: 'code_execution',
                output: {
                  type: 'json',
                  value: {
                    type: 'encrypted_code_execution_result',
                    encrypted_stdout: 'enc_abc123',
                    stderr: '',
                    return_code: 0,
                    content: [],
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      const assistantMessage = result.prompt.messages[0];
      expect(assistantMessage.role).toBe('assistant');
      const codeExecResult = (assistantMessage.content as any[]).find(
        (c: any) => c.type === 'code_execution_tool_result',
      );
      expect(codeExecResult).toBeDefined();
      expect(codeExecResult.content).toEqual({
        type: 'encrypted_code_execution_result',
        encrypted_stdout: 'enc_abc123',
        stderr: '',
        return_code: 0,
        content: [],
      });
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });
  });

  describe('code_execution 20250825', () => {
    it('should convert anthropic code_execution tool call and result parts', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k',
                toolName: 'code_execution',
                input: {
                  type: 'text_editor_code_execution',
                  command: 'create',
                  path: '/tmp/fibonacci.py',
                  file_text: 'def..',
                },
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k',
                toolName: 'code_execution',
                output: {
                  type: 'json',
                  value: {
                    type: 'text_editor_code_execution_create_result',
                    is_file_update: false,
                  },
                },
              },
              {
                type: 'tool-call',
                toolCallId: 'srvtoolu_0193G3ttnkiTfZASwHQSKc2V',
                toolName: 'code_execution',
                input: {
                  type: 'bash_code_execution',
                  command: 'python /tmp/fibonacci.py',
                },
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'srvtoolu_0193G3ttnkiTfZASwHQSKc2V',
                toolName: 'code_execution',
                output: {
                  type: 'json',
                  value: {
                    type: 'bash_code_execution_result',
                    content: [],
                    stdout: 'The 10th Fibonacci number is: 34\n',
                    stderr: '',
                    return_code: 0,
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "prompt": {
            "messages": [
              {
                "content": [
                  {
                    "cache_control": undefined,
                    "id": "srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k",
                    "input": {
                      "command": "create",
                      "file_text": "def..",
                      "path": "/tmp/fibonacci.py",
                      "type": "text_editor_code_execution",
                    },
                    "name": "text_editor_code_execution",
                    "type": "server_tool_use",
                  },
                  {
                    "cache_control": undefined,
                    "content": {
                      "is_file_update": false,
                      "type": "text_editor_code_execution_create_result",
                    },
                    "tool_use_id": "srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k",
                    "type": "text_editor_code_execution_tool_result",
                  },
                  {
                    "cache_control": undefined,
                    "id": "srvtoolu_0193G3ttnkiTfZASwHQSKc2V",
                    "input": {
                      "command": "python /tmp/fibonacci.py",
                      "type": "bash_code_execution",
                    },
                    "name": "bash_code_execution",
                    "type": "server_tool_use",
                  },
                  {
                    "cache_control": undefined,
                    "content": {
                      "content": [],
                      "return_code": 0,
                      "stderr": "",
                      "stdout": "The 10th Fibonacci number is: 34
        ",
                      "type": "bash_code_execution_result",
                    },
                    "tool_use_id": "srvtoolu_0193G3ttnkiTfZASwHQSKc2V",
                    "type": "bash_code_execution_tool_result",
                  },
                ],
                "role": "assistant",
              },
            ],
            "system": undefined,
          },
        }
      `);
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });
  });

  describe('code_execution 20260120', () => {
    it('should convert anthropic code_execution tool call and result parts', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k',
                toolName: 'code_execution',
                input: {
                  type: 'text_editor_code_execution',
                  command: 'create',
                  path: '/tmp/fibonacci.py',
                  file_text: 'def..',
                },
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k',
                toolName: 'code_execution',
                output: {
                  type: 'json',
                  value: {
                    type: 'text_editor_code_execution_create_result',
                    is_file_update: false,
                  },
                },
              },
              {
                type: 'tool-call',
                toolCallId: 'srvtoolu_0193G3ttnkiTfZASwHQSKc2V',
                toolName: 'code_execution',
                input: {
                  type: 'bash_code_execution',
                  command: 'python /tmp/fibonacci.py',
                },
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'srvtoolu_0193G3ttnkiTfZASwHQSKc2V',
                toolName: 'code_execution',
                output: {
                  type: 'json',
                  value: {
                    type: 'bash_code_execution_result',
                    content: [],
                    stdout: 'The 10th Fibonacci number is: 34\n',
                    stderr: '',
                    return_code: 0,
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "prompt": {
            "messages": [
              {
                "content": [
                  {
                    "cache_control": undefined,
                    "id": "srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k",
                    "input": {
                      "command": "create",
                      "file_text": "def..",
                      "path": "/tmp/fibonacci.py",
                      "type": "text_editor_code_execution",
                    },
                    "name": "text_editor_code_execution",
                    "type": "server_tool_use",
                  },
                  {
                    "cache_control": undefined,
                    "content": {
                      "is_file_update": false,
                      "type": "text_editor_code_execution_create_result",
                    },
                    "tool_use_id": "srvtoolu_01Hq9rR6fZwwDGHkTYRafn7k",
                    "type": "text_editor_code_execution_tool_result",
                  },
                  {
                    "cache_control": undefined,
                    "id": "srvtoolu_0193G3ttnkiTfZASwHQSKc2V",
                    "input": {
                      "command": "python /tmp/fibonacci.py",
                      "type": "bash_code_execution",
                    },
                    "name": "bash_code_execution",
                    "type": "server_tool_use",
                  },
                  {
                    "cache_control": undefined,
                    "content": {
                      "content": [],
                      "return_code": 0,
                      "stderr": "",
                      "stdout": "The 10th Fibonacci number is: 34
        ",
                      "type": "bash_code_execution_result",
                    },
                    "tool_use_id": "srvtoolu_0193G3ttnkiTfZASwHQSKc2V",
                    "type": "bash_code_execution_tool_result",
                  },
                ],
                "role": "assistant",
              },
            ],
            "system": undefined,
          },
        }
      `);
      expect(warnings).toMatchInlineSnapshot(`[]`);
    });
  });

  describe('mcp tool use', () => {
    it('should convert anthropic mcp tool use parts', async () => {
      const warnings: SharedV4Warning[] = [];
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'mcptoolu_01HXPYHs79HH36fBbKHysCrp',
                toolName: 'echo',
                input: {},
                providerExecuted: true,
                providerOptions: {
                  anthropic: { type: 'mcp-tool-use', serverName: 'echo' },
                },
              },
              {
                type: 'tool-result',
                toolCallId: 'mcptoolu_01HXPYHs79HH36fBbKHysCrp',
                toolName: 'echo',
                output: {
                  type: 'json',
                  value: [{ type: 'text', text: 'Tool echo: hello world' }],
                },
                providerOptions: undefined,
              },
              {
                type: 'text',
                text: 'The echo tool responded back with "hello world" - it simply echoed the message I sent to it!',
                providerOptions: undefined,
              },
            ],
            providerOptions: undefined,
          },
        ],
        sendReasoning: false,
        warnings,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "prompt": {
            "messages": [
              {
                "content": [
                  {
                    "cache_control": undefined,
                    "id": "mcptoolu_01HXPYHs79HH36fBbKHysCrp",
                    "input": {},
                    "name": "echo",
                    "server_name": "echo",
                    "type": "mcp_tool_use",
                  },
                  {
                    "cache_control": undefined,
                    "content": [
                      {
                        "text": "Tool echo: hello world",
                        "type": "text",
                      },
                    ],
                    "is_error": false,
                    "tool_use_id": "mcptoolu_01HXPYHs79HH36fBbKHysCrp",
                    "type": "mcp_tool_result",
                  },
                  {
                    "cache_control": undefined,
                    "text": "The echo tool responded back with "hello world" - it simply echoed the message I sent to it!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
            "system": undefined,
          },
        }
      `);
      expect(warnings).toMatchInlineSnapshot(`
        [
          {
            "message": "provider executed tool result for tool echo is not supported",
            "type": "other",
          },
        ]
      `);
    });
  });
});

describe('cache control', () => {
  describe('system message', () => {
    it('should set cache_control on system message with message cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'system',
            content: 'system message',
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [],
          system: [
            {
              type: 'text',
              text: 'system message',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
        betas: new Set(),
      });
    });
  });

  describe('user message', () => {
    it('should set cache_control on user message part with part cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'test',
                providerOptions: {
                  anthropic: {
                    cacheControl: { type: 'ephemeral' },
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'test',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });

    it('should set cache_control on last user message part with message cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'part1' },
              { type: 'text', text: 'part2' },
            ],
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'part1',
                  cache_control: undefined,
                },
                {
                  type: 'text',
                  text: 'part2',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });
  });

  describe('assistant message', () => {
    it('should set cache_control on assistant message text part with part cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'user-content' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'test',
                providerOptions: {
                  anthropic: {
                    cacheControl: { type: 'ephemeral' },
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'user-content' }] },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'test',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });

    it('should set cache_control on assistant tool call part with part cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'user-content' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'test-id',
                toolName: 'test-tool',
                input: { some: 'arg' },
                providerOptions: {
                  anthropic: {
                    cacheControl: { type: 'ephemeral' },
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'user-content' }] },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  name: 'test-tool',
                  id: 'test-id',
                  input: { some: 'arg' },
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });

    it('should set cache_control on last assistant message part with message cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'user-content' }] },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'part1' },
              { type: 'text', text: 'part2' },
            ],
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'user-content' }] },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'part1',
                  cache_control: undefined,
                },
                {
                  type: 'text',
                  text: 'part2',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });
  });

  describe('tool message', () => {
    it('should set cache_control on tool result message part with part cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'test',
                toolCallId: 'test',
                output: { type: 'json', value: { test: 'test' } },
                providerOptions: {
                  anthropic: {
                    cacheControl: { type: 'ephemeral' },
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  content: '{"test":"test"}',
                  is_error: undefined,
                  tool_use_id: 'test',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });

    it('should set cache_control on tool result with output cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'test',
                toolCallId: 'test',
                output: {
                  type: 'text',
                  value: 'test',
                  providerOptions: {
                    anthropic: {
                      cacheControl: { type: 'ephemeral' },
                    },
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  content: 'test',
                  is_error: undefined,
                  tool_use_id: 'test',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });

    it('should set cache_control on tool result with content output cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'test',
                toolCallId: 'test',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'text',
                      text: 'test',
                      providerOptions: {
                        anthropic: {
                          cacheControl: { type: 'ephemeral' },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  content: [{ type: 'text', text: 'test' }],
                  is_error: undefined,
                  tool_use_id: 'test',
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });

    it('should set cache_control on last tool result message part with message cache control', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'test',
                toolCallId: 'part1',
                output: { type: 'json', value: { test: 'part1' } },
              },
              {
                type: 'tool-result',
                toolName: 'test',
                toolCallId: 'part2',
                output: { type: 'json', value: { test: 'part2' } },
              },
            ],
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'part1',
                  content: '{"test":"part1"}',
                  is_error: undefined,
                  cache_control: undefined,
                },
                {
                  type: 'tool_result',
                  tool_use_id: 'part2',
                  content: '{"test":"part2"}',
                  is_error: undefined,
                  cache_control: { type: 'ephemeral' },
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });
    });
  });

  describe('cache control validation', () => {
    it('should reject cache_control on thinking blocks', async () => {
      const warnings: SharedV4Warning[] = [];
      const cacheControlValidator = new CacheControlValidator();
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: 'thinking content',
                providerOptions: {
                  anthropic: {
                    signature: 'test-sig',
                    cacheControl: { type: 'ephemeral' },
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings,
        cacheControlValidator,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result).toEqual({
        prompt: {
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'thinking',
                  thinking: 'thinking content',
                  signature: 'test-sig',
                },
              ],
            },
          ],
        },
        betas: new Set(),
      });

      expect(cacheControlValidator.getWarnings()).toMatchInlineSnapshot(`
        [
          {
            "details": "cache_control cannot be set on thinking block. It will be ignored.",
            "feature": "cache_control on non-cacheable context",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should reject cache_control on redacted thinking blocks', async () => {
      const warnings: SharedV4Warning[] = [];
      const cacheControlValidator = new CacheControlValidator();
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: 'redacted',
                providerOptions: {
                  anthropic: {
                    redactedData: 'abc123',
                    cacheControl: { type: 'ephemeral' },
                  },
                },
              },
            ],
          },
        ],
        sendReasoning: true,
        warnings,
        cacheControlValidator,
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result.prompt.messages[0].content[0]).not.toHaveProperty(
        'cache_control',
      );

      expect(cacheControlValidator.getWarnings()).toMatchInlineSnapshot(`
        [
          {
            "details": "cache_control cannot be set on redacted thinking block. It will be ignored.",
            "feature": "cache_control on non-cacheable context",
            "type": "unsupported",
          },
        ]
      `);
    });
  });

  it('should limit cache breakpoints to 4', async () => {
    const warnings: SharedV4Warning[] = [];
    const cacheControlValidator = new CacheControlValidator();
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'system',
          content: 'system 1',
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        {
          role: 'system',
          content: 'system 2',
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'user 1',
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral' } },
              },
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'assistant 1',
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral' } },
              },
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'user 2 (should be rejected)',
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral' } },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings,
      cacheControlValidator,
      toolNameMapping: defaultToolNameMapping,
    });

    // First 4 should have cache_control
    expect(result.prompt.system?.[0].cache_control).toEqual({
      type: 'ephemeral',
    });
    expect(result.prompt.system?.[1].cache_control).toEqual({
      type: 'ephemeral',
    });
    expect(result.prompt.messages[0].content[0].cache_control).toEqual({
      type: 'ephemeral',
    });
    expect(result.prompt.messages[1].content[0].cache_control).toEqual({
      type: 'ephemeral',
    });

    // 5th should be rejected
    expect(result.prompt.messages[2].content[0].cache_control).toBeUndefined();

    // Should have warning about exceeding limit
    expect(cacheControlValidator.getWarnings()).toMatchInlineSnapshot(`
      [
        {
          "details": "Maximum 4 cache breakpoints exceeded (found 5). This breakpoint will be ignored.",
          "feature": "cacheControl breakpoint limit",
          "type": "unsupported",
        },
      ]
    `);
  });
});

describe('citations', () => {
  it('should not include citations by default', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64PDFdata' },
              mediaType: 'application/pdf',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {
          "pdfs-2024-09-25",
        },
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "source": {
                    "data": "base64PDFdata",
                    "media_type": "application/pdf",
                    "type": "base64",
                  },
                  "title": undefined,
                  "type": "document",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  it('should include citations when enabled on file part', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64PDFdata' },
              mediaType: 'application/pdf',
              providerOptions: {
                anthropic: {
                  citations: { enabled: true },
                },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {
          "pdfs-2024-09-25",
        },
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "citations": {
                    "enabled": true,
                  },
                  "source": {
                    "data": "base64PDFdata",
                    "media_type": "application/pdf",
                    "type": "base64",
                  },
                  "title": undefined,
                  "type": "document",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  it('should include custom title and context when provided', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64PDFdata' },
              mediaType: 'application/pdf',
              filename: 'original-name.pdf',
              providerOptions: {
                anthropic: {
                  title: 'Custom Document Title',
                  context: 'This is metadata about the document',
                  citations: { enabled: true },
                },
              },
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {
          "pdfs-2024-09-25",
        },
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "citations": {
                    "enabled": true,
                  },
                  "context": "This is metadata about the document",
                  "source": {
                    "data": "base64PDFdata",
                    "media_type": "application/pdf",
                    "type": "base64",
                  },
                  "title": "Custom Document Title",
                  "type": "document",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  it('should handle multiple documents with consistent citation settings', async () => {
    const result = await convertToAnthropicPrompt({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64PDFdata1' },
              mediaType: 'application/pdf',
              filename: 'doc1.pdf',
              providerOptions: {
                anthropic: {
                  citations: { enabled: true },
                  title: 'Custom Title 1',
                },
              },
            },
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64PDFdata2' },
              mediaType: 'application/pdf',
              filename: 'doc2.pdf',
              providerOptions: {
                anthropic: {
                  citations: { enabled: true },
                  title: 'Custom Title 2',
                  context: 'Additional context for document 2',
                },
              },
            },
            {
              type: 'text',
              text: 'Analyze both documents',
            },
          ],
        },
      ],
      sendReasoning: true,
      warnings: [],
      toolNameMapping: defaultToolNameMapping,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {
          "pdfs-2024-09-25",
        },
        "prompt": {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "citations": {
                    "enabled": true,
                  },
                  "source": {
                    "data": "base64PDFdata1",
                    "media_type": "application/pdf",
                    "type": "base64",
                  },
                  "title": "Custom Title 1",
                  "type": "document",
                },
                {
                  "cache_control": undefined,
                  "citations": {
                    "enabled": true,
                  },
                  "context": "Additional context for document 2",
                  "source": {
                    "data": "base64PDFdata2",
                    "media_type": "application/pdf",
                    "type": "base64",
                  },
                  "title": "Custom Title 2",
                  "type": "document",
                },
                {
                  "cache_control": undefined,
                  "text": "Analyze both documents",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        },
      }
    `);
  });

  describe('message sequences', () => {
    it('should convert user-assistant-tool-assistant-user message sequence with multiple tool calls', async () => {
      const result = await convertToAnthropicPrompt({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'weather for berlin, london and paris' },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'I will use the weather tool to get the weather for berlin, london and paris',
              },
              {
                type: 'tool-call',
                toolName: 'weather',
                toolCallId: 'weather-call-1',
                input: { location: 'berlin' },
              },
              {
                type: 'tool-call',
                toolName: 'weather',
                toolCallId: 'weather-call-2',
                input: { location: 'london' },
              },
              {
                type: 'tool-call',
                toolName: 'weather',
                toolCallId: 'weather-call-3',
                input: { location: 'paris' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'weather',
                toolCallId: 'weather-call-1',
                output: {
                  type: 'json',
                  value: { weather: 'sunny' },
                },
              },
              {
                type: 'tool-result',
                toolName: 'weather',
                toolCallId: 'weather-call-2',
                output: {
                  type: 'json',
                  value: { weather: 'cloudy' },
                },
              },
              {
                type: 'tool-result',
                toolName: 'weather',
                toolCallId: 'weather-call-3',
                output: {
                  type: 'json',
                  value: { weather: 'rainy' },
                },
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'The weather for berlin is sunny, the weather for london is cloudy, and the weather for paris is rainy',
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'and for new york?' }],
          },
        ],
        sendReasoning: true,
        warnings: [],
        toolNameMapping: defaultToolNameMapping,
      });

      expect(result.prompt).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": [
                {
                  "cache_control": undefined,
                  "text": "weather for berlin, london and paris",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "cache_control": undefined,
                  "text": "I will use the weather tool to get the weather for berlin, london and paris",
                  "type": "text",
                },
                {
                  "cache_control": undefined,
                  "id": "weather-call-1",
                  "input": {
                    "location": "berlin",
                  },
                  "name": "weather",
                  "type": "tool_use",
                },
                {
                  "cache_control": undefined,
                  "id": "weather-call-2",
                  "input": {
                    "location": "london",
                  },
                  "name": "weather",
                  "type": "tool_use",
                },
                {
                  "cache_control": undefined,
                  "id": "weather-call-3",
                  "input": {
                    "location": "paris",
                  },
                  "name": "weather",
                  "type": "tool_use",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "cache_control": undefined,
                  "content": "{"weather":"sunny"}",
                  "is_error": undefined,
                  "tool_use_id": "weather-call-1",
                  "type": "tool_result",
                },
                {
                  "cache_control": undefined,
                  "content": "{"weather":"cloudy"}",
                  "is_error": undefined,
                  "tool_use_id": "weather-call-2",
                  "type": "tool_result",
                },
                {
                  "cache_control": undefined,
                  "content": "{"weather":"rainy"}",
                  "is_error": undefined,
                  "tool_use_id": "weather-call-3",
                  "type": "tool_result",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "cache_control": undefined,
                  "text": "The weather for berlin is sunny, the weather for london is cloudy, and the weather for paris is rainy",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "cache_control": undefined,
                  "text": "and for new york?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "system": undefined,
        }
      `);
    });
  });
});
