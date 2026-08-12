import { convertToPerplexityMessages } from './convert-to-perplexity-messages';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { describe, it, expect } from 'vitest';

describe('convertToPerplexityMessages', () => {
  describe('system messages', () => {
    it('should convert a system message with text content', () => {
      expect(
        convertToPerplexityMessages([
          {
            role: 'system',
            content: 'System initialization',
          },
        ]),
      ).toMatchSnapshot();
    });
  });

  describe('user messages', () => {
    it('should convert a user message with text parts', () => {
      expect(
        convertToPerplexityMessages([
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'World' },
            ],
          },
        ]),
      ).toMatchSnapshot();
    });

    it('should convert a user message with image parts', () => {
      expect(
        convertToPerplexityMessages([
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello ' },
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
        ]),
      ).toMatchSnapshot();
    });
  });

  describe('assistant messages', () => {
    it('should convert an assistant message with text content', () => {
      expect(
        convertToPerplexityMessages([
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Assistant reply' }],
          },
        ]),
      ).toMatchSnapshot();
    });
  });

  describe('tool messages', () => {
    it('should throw an error for tool messages', () => {
      expect(() => {
        convertToPerplexityMessages([
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'dummy-tool-call-id',
                toolName: 'dummy-tool-name',
                output: { type: 'text', value: 'This should fail' },
              },
            ],
          },
        ]);
      }).toThrow(UnsupportedFunctionalityError);
    });

    it('should throw for file parts with provider references', () => {
      expect(() =>
        convertToPerplexityMessages([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: {
                  type: 'reference' as const,
                  reference: { perplexity: 'file-ref-123' },
                },
                mediaType: 'image/png',
              },
            ],
          },
        ]),
      ).toThrow(UnsupportedFunctionalityError);
    });
  });

  describe('top-level-only media type resolution', () => {
    const pngBase64 = 'iVBORw0KGgo=';

    it('passes full image/png through unchanged for inline data', () => {
      const result = convertToPerplexityMessages([
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
      const result = convertToPerplexityMessages([
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

    it('passes through URL source for top-level-only image', () => {
      const result = convertToPerplexityMessages([
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

    it('accepts top-level-only "application" mediaType for PDF without error', () => {
      const pdfBase64 = 'JVBERi0xLjQ=';

      expect(() =>
        convertToPerplexityMessages([
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application',
                data: { type: 'data' as const, data: pdfBase64 },
                filename: 'doc.pdf',
              },
            ],
          },
        ]),
      ).not.toThrow();
    });

    it('normalizes image/* wildcard via detection', () => {
      const result = convertToPerplexityMessages([
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
});
