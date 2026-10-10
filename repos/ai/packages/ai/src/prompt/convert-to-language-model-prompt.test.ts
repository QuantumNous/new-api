import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDownloadFunction } from '../util/download/download-function';
import {
  convertToLanguageModelMessage,
  convertToLanguageModelPrompt,
} from './convert-to-language-model-prompt';

describe('convertToLanguageModelPrompt', () => {
  describe('system message', () => {
    it('should convert a string system message', async () => {
      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: 'INSTRUCTIONS',
          messages: [{ role: 'user', content: 'Hello, world!' }],
        },
        supportedUrls: {},
        download: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": "INSTRUCTIONS",
            "role": "system",
          },
          {
            "content": [
              {
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);
    });

    it('should convert a SystemModelMessage system message', async () => {
      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: {
            role: 'system',
            content: 'INSTRUCTIONS',
            providerOptions: { test: { value: 'test' } },
          },
          messages: [{ role: 'user', content: 'Hello, world!' }],
        },
        supportedUrls: {},
        download: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": "INSTRUCTIONS",
            "providerOptions": {
              "test": {
                "value": "test",
              },
            },
            "role": "system",
          },
          {
            "content": [
              {
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);
    });

    it('should convert an array of SystemModelMessage system messages', async () => {
      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: [
            { role: 'system', content: 'INSTRUCTIONS' },
            { role: 'system', content: 'INSTRUCTIONS 2' },
          ],
          messages: [{ role: 'user', content: 'Hello, world!' }],
        },
        supportedUrls: {},
        download: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": "INSTRUCTIONS",
            "providerOptions": undefined,
            "role": "system",
          },
          {
            "content": "INSTRUCTIONS 2",
            "providerOptions": undefined,
            "role": "system",
          },
          {
            "content": [
              {
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('user message', () => {
    let mockProcessEmitWarning: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockProcessEmitWarning = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      mockProcessEmitWarning.mockRestore();
    });

    describe('image parts', () => {
      it('should download images for user image parts with URLs when model does not support image URLs', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    image: new URL('https://example.com/image.png'),
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/image.png'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'image/png',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
              },
            ],
          },
        ]);
      });

      it('should download images for user image parts with string URLs when model does not support image URLs', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    image: 'https://example.com/image.png',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/image.png'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'image/png',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
              },
            ],
          },
        ]);
      });

      it('should pass through provider reference for image parts without conversion', async () => {
        const providerRef = { openai: 'file-abc123', anthropic: 'file-xyz789' };
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    image: providerRef,
                    mediaType: 'image/png',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                filename: undefined,
                data: { type: 'reference', reference: providerRef },
              },
            ],
          },
        ]);
      });
    });

    describe('file parts', () => {
      it('should pass through URLs when the model supports a particular URL', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: new URL('https://example.com/document.pdf'),
                    mediaType: 'application/pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {
            '*': [/^https:\/\/.*$/],
          },
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
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
        ]);
      });

      it('should download the URL as an asset when the model does not support a URL', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: new URL('https://example.com/document.pdf'),
                    mediaType: 'application/pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {
            // PDF is not supported, but image/* is
            'image/*': [/^https:\/\/.*$/],
          },
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/document.pdf'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'application/pdf',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
              },
            ],
          },
        ]);
      });

      it('should handle file parts with base64 string data', async () => {
        const base64Data = 'SGVsbG8sIFdvcmxkIQ=='; // "Hello, World!" in base64
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: base64Data,
                    mediaType: 'text/plain',
                  },
                ],
              },
            ],
          },
          supportedUrls: {
            'image/*': [/^https:\/\/.*$/],
          },
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data', data: base64Data },
                mediaType: 'text/plain',
              },
            ],
          },
        ]);
      });

      it('should handle file parts with Uint8Array data', async () => {
        const uint8Data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: uint8Data,
                    mediaType: 'text/plain',
                  },
                ],
              },
            ],
          },
          supportedUrls: {
            'image/*': [/^https:\/\/.*$/],
          },
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: {
                  type: 'data',
                  data: new Uint8Array([72, 101, 108, 108, 111]),
                },
                mediaType: 'text/plain',
              },
            ],
          },
        ]);
      });

      it('should download files for user file parts with URL objects when model does not support downloads', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: new URL('https://example.com/document.pdf'),
                    mediaType: 'application/pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/document.pdf'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'application/pdf',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
              },
            ],
          },
        ]);
      });

      it('should download files for user file parts with string URLs when model does not support downloads', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: 'https://example.com/document.pdf',
                    mediaType: 'application/pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/document.pdf'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'application/pdf',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
              },
            ],
          },
        ]);
      });

      it('should download files for user file parts with string URLs when model does not support the particular URL', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: 'https://example.com/document.pdf',
                    mediaType: 'application/pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {
            'application/pdf': [
              // everything except https://example.com/document.pdf
              /^(?!https:\/\/example\.com\/document\.pdf$).*$/,
            ],
          },
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/document.pdf'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'application/pdf',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
              },
            ],
          },
        ]);
      });

      it('does not download URLs for user file parts for URL objects when model does support the URL', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: new URL('https://example.com/document.pdf'),
                    mediaType: 'application/pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {
            'application/pdf': [
              // match exactly https://example.com/document.pdf
              /^https:\/\/example\.com\/document\.pdf$/,
            ],
          },
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: {
                  type: 'url',
                  url: new URL('https://example.com/document.pdf'),
                },
              },
            ],
          },
        ]);
      });

      it('it should default to downloading the URL when the model does not provider a supportsUrl function', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: 'https://example.com/document.pdf',
                    mediaType: 'application/pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/document.pdf'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'application/pdf',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
              },
            ],
          },
        ]);
      });

      it('should handle file parts with filename', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: 'SGVsbG8sIFdvcmxkIQ==', // "Hello, World!" in base64
                    mediaType: 'text/plain',
                    filename: 'hello.txt',
                  },
                ],
              },
            ],
          },
          supportedUrls: {
            'image/*': [/^https:\/\/.*$/],
          },
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: { type: 'data', data: 'SGVsbG8sIFdvcmxkIQ==' },
                mediaType: 'text/plain',
                filename: 'hello.txt',
              },
            ],
          },
        ]);
      });

      it('should preserve filename when downloading file from URL', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: new URL('https://example.com/document.pdf'),
                    mediaType: 'application/pdf',
                    filename: 'important-document.pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/document.pdf'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'application/pdf',
            };
          }),
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: { type: 'data', data: new Uint8Array([0, 1, 2, 3]) },
                filename: 'important-document.pdf',
              },
            ],
          },
        ]);
      });

      it('should prioritize user-provided mediaType over downloaded file mediaType', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: new URL('https://example.com/image.jpg'),
                    mediaType: 'image/jpeg',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/image.jpg'));
            return {
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'application/octet-stream',
            };
          }),
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "data": {
                    "data": Uint8Array [
                      0,
                      1,
                      2,
                      3,
                    ],
                    "type": "data",
                  },
                  "filename": undefined,
                  "mediaType": "image/jpeg",
                  "providerOptions": undefined,
                  "type": "file",
                },
              ],
              "providerOptions": undefined,
              "role": "user",
            },
          ]
        `);
      });

      it('should use downloaded file mediaType as fallback when user provides generic mediaType', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: new URL('https://example.com/document.txt'),
                    mediaType: 'application/octet-stream',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: createDefaultDownloadFunction(async ({ url }) => {
            expect(url).toEqual(new URL('https://example.com/document.txt'));
            return {
              data: new Uint8Array([72, 101, 108, 108, 111]),
              mediaType: 'text/plain',
            };
          }),
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "data": {
                    "data": Uint8Array [
                      72,
                      101,
                      108,
                      108,
                      111,
                    ],
                    "type": "data",
                  },
                  "filename": undefined,
                  "mediaType": "application/octet-stream",
                  "providerOptions": undefined,
                  "type": "file",
                },
              ],
              "providerOptions": undefined,
              "role": "user",
            },
          ]
        `);
      });

      it('should pass through provider reference for file parts without conversion', async () => {
        const providerRef = { openai: 'file-abc123', anthropic: 'file-xyz789' };
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: providerRef,
                    mediaType: 'application/pdf',
                    filename: 'doc.pdf',
                  },
                ],
              },
            ],
          },
          supportedUrls: {},
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                filename: 'doc.pdf',
                data: { type: 'reference', reference: providerRef },
              },
            ],
          },
        ]);
      });
    });

    describe('provider options', async () => {
      it('should add provider options to messages', async () => {
        const result = await convertToLanguageModelPrompt({
          prompt: {
            instructions: undefined,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'hello, world!',
                  },
                ],
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
            ],
          },
          supportedUrls: {},
          download: undefined,
        });

        expect(result).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'hello, world!',
                providerMetadata: undefined,
              },
            ],
            providerOptions: {
              'test-provider': {
                'key-a': 'test-value-1',
                'key-b': 'test-value-2',
              },
            },
          },
        ]);
      });
    });

    it('should download files when intermediate file cannot be downloaded', async () => {
      const imageUrlA = `http://example.com/my-image-A.png`; // supported
      const fileUrl = `http://127.0.0.1:3000/file`; // unsupported
      const imageUrlB = `http://example.com/my-image-B.png`; // supported

      const mockDownload = vi.fn().mockResolvedValue([
        {
          url: new URL(imageUrlA),
          data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]), // empty png and 0
          mediaType: 'image/png',
        },
        null,
        {
          url: new URL(imageUrlB),
          data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]), // empty png and 1
          mediaType: 'image/png',
        },
      ]);

      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: undefined,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', image: imageUrlA, mediaType: 'image/png' },
                {
                  type: 'file',
                  data: new URL(fileUrl),
                  mediaType: 'application/octet-stream',
                },
                { type: 'image', image: imageUrlB, mediaType: 'image/png' },
              ],
            },
          ],
        },
        supportedUrls: {
          '*': [/^https:\/\/.*$/],
        },
        download: mockDownload,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "data": {
                  "data": Uint8Array [
                    137,
                    80,
                    78,
                    71,
                    13,
                    10,
                    26,
                    10,
                    0,
                  ],
                  "type": "data",
                },
                "filename": undefined,
                "mediaType": "image/png",
                "providerOptions": undefined,
                "type": "file",
              },
              {
                "data": {
                  "type": "url",
                  "url": "http://127.0.0.1:3000/file",
                },
                "filename": undefined,
                "mediaType": "application/octet-stream",
                "providerOptions": undefined,
                "type": "file",
              },
              {
                "data": {
                  "data": Uint8Array [
                    137,
                    80,
                    78,
                    71,
                    13,
                    10,
                    26,
                    10,
                    1,
                  ],
                  "type": "data",
                },
                "filename": undefined,
                "mediaType": "image/png",
                "providerOptions": undefined,
                "type": "file",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('tool message', () => {
    it('should combine 2 consecutive tool messages into a single tool message', async () => {
      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: undefined,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'toolCallId',
                  toolName: 'toolName',
                  input: {},
                },
                {
                  type: 'tool-approval-request',
                  approvalId: 'approvalId',
                  toolCallId: 'toolCallId',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-approval-response',
                  approvalId: 'approvalId',
                  approved: true,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolName: 'toolName',
                  toolCallId: 'toolCallId',
                  output: { type: 'json', value: { some: 'result' } },
                },
              ],
            },
          ],
        },
        supportedUrls: {},
        download: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {},
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-call",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "json",
                  "value": {
                    "some": "result",
                  },
                },
                "providerOptions": undefined,
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-result",
              },
            ],
            "providerOptions": undefined,
            "role": "tool",
          },
        ]
      `);
    });
  });

  describe('custom download function', () => {
    it('should use custom download function to fetch URL content', async () => {
      const mockDownload = vi.fn().mockResolvedValue([
        {
          url: new URL('https://example.com/test-file.txt'),
          data: new Uint8Array([72, 101, 108, 108, 111]), // "Hello" in ASCII
          mediaType: 'text/plain',
        },
      ]);

      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: undefined,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  data: 'https://example.com/test-file.txt',
                  mediaType: 'text/plain',
                },
              ],
            },
          ],
        },
        supportedUrls: {}, // No URL support, so download should be triggered
        download: mockDownload,
      });

      expect(mockDownload).toHaveBeenCalledOnce();
      expect(mockDownload).toHaveBeenCalledWith([
        {
          url: new URL('https://example.com/test-file.txt'),
          isUrlSupportedByModel: false,
        },
      ]);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'text/plain',
              data: {
                type: 'data',
                data: new Uint8Array([72, 101, 108, 108, 111]),
              },
            },
          ],
        },
      ]);
    });

    it('should download URL content in tool results', async () => {
      const mockDownload = vi.fn().mockResolvedValue([
        {
          url: new URL('https://example.com/image.png'),
          data: new Uint8Array([0, 1, 2, 3]),
          mediaType: 'image/png',
        },
      ]);

      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: undefined,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'toolCallId',
                  toolName: 'toolName',
                  input: {},
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolName: 'toolName',
                  toolCallId: 'toolCallId',
                  output: {
                    type: 'content',
                    value: [
                      {
                        type: 'file',
                        mediaType: 'image/png',
                        data: {
                          type: 'url',
                          url: new URL('https://example.com/image.png'),
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
        supportedUrls: {},
        download: mockDownload,
      });

      expect(mockDownload).toHaveBeenCalledOnce();
      expect(mockDownload).toHaveBeenCalledWith([
        {
          url: new URL('https://example.com/image.png'),
          isUrlSupportedByModel: false,
        },
      ]);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'toolCallId',
              toolName: 'toolName',
              input: {},
              providerExecuted: undefined,
              providerOptions: undefined,
            },
          ],
          providerOptions: undefined,
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'toolCallId',
              toolName: 'toolName',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'file',
                    mediaType: 'image/png',
                    data: {
                      type: 'data',
                      data: new Uint8Array([0, 1, 2, 3]),
                    },
                    filename: undefined,
                    providerOptions: undefined,
                  },
                ],
              },
              providerOptions: undefined,
            },
          ],
          providerOptions: undefined,
        },
      ]);
    });

    it('should download URL content in assistant tool results', async () => {
      const mockDownload = vi.fn().mockResolvedValue([
        {
          url: new URL('https://example.com/assistant-image.png'),
          data: new Uint8Array([4, 5, 6, 7]),
          mediaType: 'image/png',
        },
      ]);

      const result = await convertToLanguageModelPrompt({
        prompt: {
          instructions: undefined,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-result',
                  toolName: 'toolName',
                  toolCallId: 'toolCallId',
                  output: {
                    type: 'content',
                    value: [
                      {
                        type: 'file',
                        mediaType: 'image/png',
                        data: {
                          type: 'url',
                          url: new URL(
                            'https://example.com/assistant-image.png',
                          ),
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
        supportedUrls: {},
        download: mockDownload,
      });

      expect(mockDownload).toHaveBeenCalledOnce();
      expect(mockDownload).toHaveBeenCalledWith([
        {
          url: new URL('https://example.com/assistant-image.png'),
          isUrlSupportedByModel: false,
        },
      ]);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "output": {
                  "type": "content",
                  "value": [
                    {
                      "data": {
                        "data": Uint8Array [
                          4,
                          5,
                          6,
                          7,
                        ],
                        "type": "data",
                      },
                      "filename": undefined,
                      "mediaType": "image/png",
                      "providerOptions": undefined,
                      "type": "file",
                    },
                  ],
                },
                "providerOptions": undefined,
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-result",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          },
        ]
      `);
    });
  });
});

describe('convertToLanguageModelMessage', () => {
  describe('user message', () => {
    let mockProcessEmitWarning: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockProcessEmitWarning = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      mockProcessEmitWarning.mockRestore();
    });

    describe('text parts', () => {
      it('should filter out empty text parts', async () => {
        const result = convertToLanguageModelMessage({
          message: { role: 'user', content: [{ type: 'text', text: '' }] },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'user',
          content: [],
        });
      });

      it('should pass through non-empty text parts', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'hello, world!' }],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'user',
          content: [{ type: 'text', text: 'hello, world!' }],
        });
      });
    });

    describe('image parts', () => {
      it('should convert image string https url to URL object', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'user',
            content: [
              {
                type: 'image',
                image: 'https://example.com/image.jpg',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.jpg'),
              },
              mediaType: 'image',
            },
          ],
        });
      });

      it('should convert image string data url to base64 content', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'user',
            content: [
              {
                type: 'image',
                image: 'data:image/jpg;base64,/9j/3Q==',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data', data: '/9j/3Q==' },
              mediaType: 'image/jpeg',
            },
          ],
        });
      });

      it('should prefer detected mediaType', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'user',
            content: [
              {
                type: 'image',
                // incorrect mediaType:
                image: 'data:image/png;base64,/9j/3Q==',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data', data: '/9j/3Q==' },
              mediaType: 'image/jpeg',
            },
          ],
        });
      });
    });

    describe('file parts', () => {
      it('should convert file string https url to URL object', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'user',
            content: [
              {
                type: 'file',
                data: 'https://example.com/image.jpg',
                mediaType: 'image/jpg',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.jpg'),
              },
              mediaType: 'image/jpg',
            },
          ],
        });
      });

      it('should convert file string data url to base64 content', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'user',
            content: [
              {
                type: 'file',
                data: 'data:image/jpg;base64,dGVzdA==',
                mediaType: 'image/jpg',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data', data: 'dGVzdA==' },
              mediaType: 'image/jpg',
            },
          ],
        });
      });
    });
  });

  describe('assistant message', () => {
    it('should include custom parts', () => {
      const result = convertToLanguageModelMessage({
        message: {
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
        downloadedAssets: {},
      });

      expect(result).toEqual({
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
        providerOptions: undefined,
      });
    });

    describe('text parts', () => {
      it('should ignore empty text parts when there are no provider options', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: '',
              },
              {
                type: 'tool-call',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                input: {},
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              input: {},
              toolCallId: 'toolCallId',
              toolName: 'toolName',
            },
          ],
        });
      });

      it('should include empty text parts when there are provider options', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: '',
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                  },
                },
              },
              {
                type: 'tool-call',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                input: {},
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "content": [
              {
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                  },
                },
                "text": "",
                "type": "text",
              },
              {
                "input": {},
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-call",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          }
        `);
      });
    });

    describe('reasoning parts', () => {
      it('should pass through provider options', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: 'hello, world!',
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'hello, world!',
              providerOptions: {
                'test-provider': {
                  'key-a': 'test-value-1',
                  'key-b': 'test-value-2',
                },
              },
            },
          ],
        });
      });

      it('should support a mix of reasoning, redacted reasoning, and text parts', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: `I'm thinking`,
              },
              {
                type: 'reasoning',
                text: 'redacted-reasoning-data',
                providerOptions: {
                  'test-provider': { redacted: true },
                },
              },
              {
                type: 'reasoning',
                text: 'more thinking',
              },
              {
                type: 'text',
                text: 'hello, world!',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: `I'm thinking`,
            },
            {
              type: 'reasoning',
              text: 'redacted-reasoning-data',
              providerOptions: {
                'test-provider': { redacted: true },
              },
            },
            {
              type: 'reasoning',
              text: 'more thinking',
            },
            {
              type: 'text',
              text: 'hello, world!',
            },
          ],
        });
      });
    });

    describe('file parts with provider reference', () => {
      it('should pass through provider reference for assistant file parts without conversion', () => {
        const providerRef = { openai: 'file-abc123', anthropic: 'file-xyz789' };
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'file',
                data: providerRef,
                mediaType: 'application/pdf',
                filename: 'doc.pdf',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'file',
              data: { type: 'reference', reference: providerRef },
              mediaType: 'application/pdf',
              filename: 'doc.pdf',
            },
          ],
        });
      });
    });

    describe('reasoning-file parts', () => {
      it('should convert reasoning-file part with base64 data', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'reasoning-file',
                data: 'iVBORw0KGgo=',
                mediaType: 'image/png',
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                  },
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "content": [
              {
                "data": {
                  "data": "iVBORw0KGgo=",
                  "type": "data",
                },
                "mediaType": "image/png",
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                  },
                },
                "type": "reasoning-file",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          }
        `);
      });

      it('should convert reasoning-file part with Uint8Array data', () => {
        const data = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'reasoning-file',
                data,
                mediaType: 'image/png',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "content": [
              {
                "data": {
                  "data": Uint8Array [
                    137,
                    80,
                    78,
                    71,
                    13,
                    10,
                    26,
                    10,
                  ],
                  "type": "data",
                },
                "mediaType": "image/png",
                "providerOptions": undefined,
                "type": "reasoning-file",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          }
        `);
      });
    });

    describe('tool call parts', () => {
      it('should pass through provider options', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                input: {},
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              input: {},
              toolCallId: 'toolCallId',
              toolName: 'toolName',
              providerOptions: {
                'test-provider': {
                  'key-a': 'test-value-1',
                  'key-b': 'test-value-2',
                },
              },
            },
          ],
        });
      });

      it('should include providerExecuted flag', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                input: {},
                providerExecuted: true,
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "content": [
              {
                "input": {},
                "providerExecuted": true,
                "providerOptions": undefined,
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-call",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          }
        `);
      });
    });

    describe('tool result parts', () => {
      it('should include providerExecuted flag', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'toolCallId',
                toolName: 'toolName',
                output: { type: 'json', value: { some: 'result' } },
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "content": [
              {
                "output": {
                  "type": "json",
                  "value": {
                    "some": "result",
                  },
                },
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                    "key-b": "test-value-2",
                  },
                },
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-result",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          }
        `);
      });
    });

    describe('provider-executed tool calls and results', () => {
      it('should include providerExecuted flag', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                input: {},
                providerExecuted: true,
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
              {
                type: 'tool-result',
                toolCallId: 'toolCallId',
                toolName: 'toolName',
                output: { type: 'json', value: { some: 'result' } },
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "content": [
              {
                "input": {},
                "providerExecuted": true,
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                    "key-b": "test-value-2",
                  },
                },
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-call",
              },
              {
                "output": {
                  "type": "json",
                  "value": {
                    "some": "result",
                  },
                },
                "providerOptions": {
                  "test-provider": {
                    "key-a": "test-value-1",
                    "key-b": "test-value-2",
                  },
                },
                "toolCallId": "toolCallId",
                "toolName": "toolName",
                "type": "tool-result",
              },
            ],
            "providerOptions": undefined,
            "role": "assistant",
          }
        `);
      });
    });

    describe('file parts', () => {
      it('should convert file data correctly', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'file',
                data: 'dGVzdA==', // "test" in base64
                mediaType: 'application/pdf',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'file',
              data: { type: 'data', data: 'dGVzdA==' },
              mediaType: 'application/pdf',
            },
          ],
        });
      });

      it('should preserve filename when present', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'file',
                data: 'dGVzdA==',
                mediaType: 'application/pdf',
                filename: 'test-document.pdf',
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'file',
              data: { type: 'data', data: 'dGVzdA==' },
              mediaType: 'application/pdf',
              filename: 'test-document.pdf',
            },
          ],
        });
      });

      it('should handle provider options', async () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'file',
                data: 'dGVzdA==',
                mediaType: 'application/pdf',
                providerOptions: {
                  'test-provider': {
                    'key-a': 'test-value-1',
                    'key-b': 'test-value-2',
                  },
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(result).toEqual({
          role: 'assistant',
          content: [
            {
              type: 'file',
              data: { type: 'data', data: 'dGVzdA==' },
              mediaType: 'application/pdf',
              providerOptions: {
                'test-provider': {
                  'key-a': 'test-value-1',
                  'key-b': 'test-value-2',
                },
              },
            },
          ],
        });
      });
    });
  });

  describe('tool message', () => {
    it('should convert basic tool result message', () => {
      const result = convertToLanguageModelMessage({
        message: {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'toolName',
              toolCallId: 'toolCallId',
              output: { type: 'json', value: { some: 'result' } },
            },
          ],
        },
        downloadedAssets: {},
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "output": {
                "type": "json",
                "value": {
                  "some": "result",
                },
              },
              "providerOptions": undefined,
              "toolCallId": "toolCallId",
              "toolName": "toolName",
              "type": "tool-result",
            },
          ],
          "providerOptions": undefined,
          "role": "tool",
        }
      `);
    });

    it('should convert tool result with provider metadata', () => {
      const result = convertToLanguageModelMessage({
        message: {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'toolName',
              toolCallId: 'toolCallId',
              output: { type: 'json', value: { some: 'result' } },
              providerOptions: {
                'test-provider': {
                  'key-a': 'test-value-1',
                  'key-b': 'test-value-2',
                },
              },
            },
          ],
        },
        downloadedAssets: {},
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "output": {
                "type": "json",
                "value": {
                  "some": "result",
                },
              },
              "providerOptions": {
                "test-provider": {
                  "key-a": "test-value-1",
                  "key-b": "test-value-2",
                },
              },
              "toolCallId": "toolCallId",
              "toolName": "toolName",
              "type": "tool-result",
            },
          ],
          "providerOptions": undefined,
          "role": "tool",
        }
      `);
    });

    it('should include error flag', () => {
      const result = convertToLanguageModelMessage({
        message: {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'toolName',
              toolCallId: 'toolCallId',
              output: { type: 'json', value: { some: 'result' } },
            },
          ],
        },
        downloadedAssets: {},
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "output": {
                "type": "json",
                "value": {
                  "some": "result",
                },
              },
              "providerOptions": undefined,
              "toolCallId": "toolCallId",
              "toolName": "toolName",
              "type": "tool-result",
            },
          ],
          "providerOptions": undefined,
          "role": "tool",
        }
      `);
    });

    describe('deprecated content type warnings', () => {
      let mockProcessEmitWarning: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        mockProcessEmitWarning = vi
          .spyOn(process, 'emitWarning')
          .mockImplementation(() => {});
      });

      afterEach(() => {
        mockProcessEmitWarning.mockRestore();
      });

      it('should emit DeprecationWarning for file-data and emit type: "file"', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file-data',
                      data: 'dGVzdA==',
                      mediaType: 'image/png',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "file-data"". The "file-data" type for tool result content is deprecated. Use the "file" type with mediaType and { type: \'data\', data } instead.',
          { type: 'DeprecationWarning' },
        );
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: { type: 'data', data: 'dGVzdA==' },
              filename: undefined,
              mediaType: 'image/png',
              providerOptions: undefined,
            },
          ],
        });
      });

      it('should emit DeprecationWarning for file-reference and emit type: "file" with application default', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file-reference',
                      providerReference: { 'test-provider': 'fileId' },
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "file-reference"". The "file-reference" type for tool result content is deprecated. Use the "file" type with mediaType and { type: \'reference\', reference } instead.',
          { type: 'DeprecationWarning' },
        );
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: {
                type: 'reference',
                reference: { 'test-provider': 'fileId' },
              },
              mediaType: 'application',
              providerOptions: undefined,
            },
          ],
        });
      });

      it('should emit DeprecationWarning for image-data and emit type: "file"', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'image-data',
                      data: 'dGVzdA==',
                      mediaType: 'image/png',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "image-data"". The "image-data" type for tool result content is deprecated. Use the "file" type with mediaType and { type: \'data\', data } instead.',
          { type: 'DeprecationWarning' },
        );
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: { type: 'data', data: 'dGVzdA==' },
              mediaType: 'image/png',
              providerOptions: undefined,
            },
          ],
        });
      });

      it('should emit DeprecationWarning for image-url and emit type: "file" with mediaType "image"', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    { type: 'image-url', url: 'https://example.com/image.png' },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "image-url"". The "image-url" type for tool result content is deprecated. Use the "file" type with mediaType \'image\' (or a specific image/* subtype) and { type: \'url\', url } instead.',
          { type: 'DeprecationWarning' },
        );
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.png'),
              },
              mediaType: 'image',
              providerOptions: undefined,
            },
          ],
        });
      });

      it('should emit DeprecationWarning for image-file-reference and emit type: "file" with mediaType "image"', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'image-file-reference',
                      providerReference: { 'test-provider': 'fileId' },
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "image-file-reference"". The "image-file-reference" type for tool result content is deprecated. Use the "file" type with mediaType and { type: \'reference\', reference } instead.',
          { type: 'DeprecationWarning' },
        );
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: {
                type: 'reference',
                reference: { 'test-provider': 'fileId' },
              },
              mediaType: 'image',
              providerOptions: undefined,
            },
          ],
        });
      });

      it('should emit DeprecationWarning for image-file-id with object fileId and emit type: "file" with mediaType "image"', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'image-file-id',
                      fileId: { 'test-provider': 'fileId' },
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "image-file-id"". The "image-file-id" type for tool result content is deprecated. Use the "file" type with mediaType and { type: \'reference\', reference } instead.',
          { type: 'DeprecationWarning' },
        );
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: {
                type: 'reference',
                reference: { 'test-provider': 'fileId' },
              },
              mediaType: 'image',
              providerOptions: undefined,
            },
          ],
        });
      });

      it('should emit DeprecationWarning for file-id with object fileId and emit type: "file" with application default', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file-id',
                      fileId: { 'test-provider': 'fileId' },
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "file-id"". The "file-id" type for tool result content is deprecated. Use the "file" type with mediaType and { type: \'reference\', reference } instead.',
          { type: 'DeprecationWarning' },
        );
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: {
                type: 'reference',
                reference: { 'test-provider': 'fileId' },
              },
              mediaType: 'application',
              providerOptions: undefined,
            },
          ],
        });
      });

      it('should emit DeprecationWarning for file-url with mediaType', () => {
        convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file-url',
                      url: 'https://example.com/image.png',
                      mediaType: 'image/png',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          `AI SDK Warning: Deprecated: ""tool-result" content of type "file-url"". The "file-url" type for tool result content is deprecated. Use the "file" type with mediaType and { type: 'url', url } instead.`,
          { type: 'DeprecationWarning' },
        );
      });

      it('should emit DeprecationWarning for file-url without mediaType (inferred)', () => {
        convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file-url',
                      url: 'https://example.com/image.png',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          `AI SDK Warning: Deprecated: ""tool-result" content of type "file-url"". The "file-url" tool result content part with URL "https://example.com/image.png" is missing a "mediaType". Inferred media type 'image/png' from URL. The "file-url" type for tool result content is deprecated. Use the "file" type with mediaType and { type: 'url', url } instead.`,
          { type: 'DeprecationWarning' },
        );
      });

      it('should emit DeprecationWarning for file-url without mediaType (not inferable)', () => {
        convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file-url',
                      url: 'https://example.com/file',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          `AI SDK Warning: Deprecated: ""tool-result" content of type "file-url"". The "file-url" tool result content part with URL "https://example.com/file" is missing a "mediaType". Unable to infer media type from URL. Defaulting to 'application/octet-stream'. The "file-url" type for tool result content is deprecated. Use the "file" type with mediaType and { type: 'url', url } instead.`,
          { type: 'DeprecationWarning' },
        );
      });

      it('should fall back when file-url extension collides with Object.prototype (e.g. `.constructor`)', () => {
        // Regression: a previous implementation used `ext in URL_EXTENSION_TO_MEDIA_TYPE`,
        // which traverses the prototype chain and returned the `Object`
        // constructor (a function) for attacker-controlled extensions like
        // `.constructor`, breaking the helper's `: string` contract.
        convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file-url',
                      url: 'https://example.com/foo.constructor',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          `AI SDK Warning: Deprecated: ""tool-result" content of type "file-url"". The "file-url" tool result content part with URL "https://example.com/foo.constructor" is missing a "mediaType". Unable to infer media type from URL. Defaulting to 'application/octet-stream'. The "file-url" type for tool result content is deprecated. Use the "file" type with mediaType and { type: 'url', url } instead.`,
          { type: 'DeprecationWarning' },
        );
      });

      it('should emit DeprecationWarning for deprecated types in assistant message tool-result content', () => {
        convertToLanguageModelMessage({
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'toolCallId',
                toolName: 'toolName',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'image-data',
                      data: 'dGVzdA==',
                      mediaType: 'image/png',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledOnce();
        expect(mockProcessEmitWarning).toHaveBeenCalledWith(
          'AI SDK Warning: Deprecated: ""tool-result" content of type "image-data"". The "image-data" type for tool result content is deprecated. Use the "file" type with mediaType and { type: \'data\', data } instead.',
          { type: 'DeprecationWarning' },
        );
      });

      it('should emit one DeprecationWarning per deprecated item', () => {
        convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'image-data',
                      data: 'dGVzdA==',
                      mediaType: 'image/png',
                    },
                    { type: 'image-url', url: 'https://example.com/image.png' },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).toHaveBeenCalledTimes(2);
      });

      it('should not emit warnings for non-deprecated content types', () => {
        convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'dGVzdA==' },
                      mediaType: 'image/png',
                    },
                    {
                      type: 'file',
                      data: {
                        type: 'url',
                        url: new URL('https://example.com/image.png'),
                      },
                      mediaType: 'image/png',
                    },
                    {
                      type: 'file',
                      data: {
                        type: 'reference',
                        reference: { 'test-provider': 'fileId' },
                      },
                      mediaType: 'application/octet-stream',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).not.toHaveBeenCalled();
      });

      it('should pass the new "file" shape through unchanged', () => {
        const result = convertToLanguageModelMessage({
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolName: 'toolName',
                toolCallId: 'toolCallId',
                output: {
                  type: 'content',
                  value: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'dGVzdA==' },
                      mediaType: 'image/png',
                      filename: 'image.png',
                    },
                    {
                      type: 'file',
                      data: {
                        type: 'url',
                        url: new URL('https://example.com/image.png'),
                      },
                      mediaType: 'image/png',
                    },
                    {
                      type: 'file',
                      data: {
                        type: 'reference',
                        reference: { 'test-provider': 'fileId' },
                      },
                      mediaType: 'application/pdf',
                    },
                    {
                      type: 'file',
                      data: { type: 'text', text: 'inline text' },
                      mediaType: 'text/plain',
                    },
                  ],
                },
              },
            ],
          },
          downloadedAssets: {},
        });

        expect(mockProcessEmitWarning).not.toHaveBeenCalled();
        expect(
          (
            result.content[0] as Extract<
              (typeof result.content)[number],
              { type: 'tool-result' }
            >
          ).output,
        ).toEqual({
          type: 'content',
          value: [
            {
              type: 'file',
              data: { type: 'data', data: 'dGVzdA==' },
              mediaType: 'image/png',
              filename: 'image.png',
              providerOptions: undefined,
            },
            {
              type: 'file',
              data: {
                type: 'url',
                url: new URL('https://example.com/image.png'),
              },
              mediaType: 'image/png',
              filename: undefined,
              providerOptions: undefined,
            },
            {
              type: 'file',
              data: {
                type: 'reference',
                reference: { 'test-provider': 'fileId' },
              },
              mediaType: 'application/pdf',
              filename: undefined,
              providerOptions: undefined,
            },
            {
              type: 'file',
              data: { type: 'text', text: 'inline text' },
              mediaType: 'text/plain',
              filename: undefined,
              providerOptions: undefined,
            },
          ],
        });
      });
    });

    it('should include multipart content', () => {
      const mockProcessEmitWarning = vi
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => {});

      const result = convertToLanguageModelMessage({
        message: {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'toolName',
              toolCallId: 'toolCallId',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'file-url',
                    url: 'https://example.com/image.png',
                    mediaType: 'image/png',
                  },
                  {
                    type: 'file-data',
                    data: 'dGVzdA==',
                    mediaType: 'image/png',
                  },
                  {
                    type: 'file-reference',
                    providerReference: { 'test-provider': 'fileId' },
                  },
                  {
                    type: 'image-data',
                    data: 'dGVzdA==',
                    mediaType: 'image/png',
                  },
                  { type: 'image-url', url: 'https://example.com/image.png' },
                  {
                    type: 'image-file-reference',
                    providerReference: { 'test-provider': 'fileId' },
                  },
                  {
                    type: 'custom',
                    providerOptions: {
                      'test-provider': {
                        'key-a': 'test-value-1',
                        'key-b': 'test-value-2',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
        downloadedAssets: {},
      });

      mockProcessEmitWarning.mockRestore();

      expect(result).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "output": {
                "type": "content",
                "value": [
                  {
                    "data": {
                      "type": "url",
                      "url": "https://example.com/image.png",
                    },
                    "mediaType": "image/png",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "data": {
                      "data": "dGVzdA==",
                      "type": "data",
                    },
                    "filename": undefined,
                    "mediaType": "image/png",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "data": {
                      "reference": {
                        "test-provider": "fileId",
                      },
                      "type": "reference",
                    },
                    "mediaType": "application",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "data": {
                      "data": "dGVzdA==",
                      "type": "data",
                    },
                    "mediaType": "image/png",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "data": {
                      "type": "url",
                      "url": "https://example.com/image.png",
                    },
                    "mediaType": "image",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "data": {
                      "reference": {
                        "test-provider": "fileId",
                      },
                      "type": "reference",
                    },
                    "mediaType": "image",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "providerOptions": {
                      "test-provider": {
                        "key-a": "test-value-1",
                        "key-b": "test-value-2",
                      },
                    },
                    "type": "custom",
                  },
                ],
              },
              "providerOptions": undefined,
              "toolCallId": "toolCallId",
              "toolName": "toolName",
              "type": "tool-result",
            },
          ],
          "providerOptions": undefined,
          "role": "tool",
        }
      `);
    });
  });
});
