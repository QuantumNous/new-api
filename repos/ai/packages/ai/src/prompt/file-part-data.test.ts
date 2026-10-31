import { describe, expect, it } from 'vitest';
import { convertToLanguageModelV4FilePart } from './file-part-data';

describe('convertToLanguageModelV4FilePart', () => {
  describe('legacy bare shapes', () => {
    it('wraps a Uint8Array as { type: "data", data }', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      expect(convertToLanguageModelV4FilePart(bytes)).toEqual({
        data: { type: 'data', data: bytes },
        mediaType: undefined,
      });
    });

    it('wraps an ArrayBuffer (converted to Uint8Array) as { type: "data", data }', () => {
      const buffer = new Uint8Array([4, 5, 6]).buffer;
      const result = convertToLanguageModelV4FilePart(buffer);
      expect(result.data.type).toBe('data');
      const inner = (result.data as { type: 'data'; data: Uint8Array }).data;
      expect(inner).toBeInstanceOf(Uint8Array);
      expect(Array.from(inner)).toEqual([4, 5, 6]);
      expect(result.mediaType).toBeUndefined();
    });

    it('wraps a base64 string that is not a URL as { type: "data", data }', () => {
      const base64 = 'aGVsbG8=';
      expect(convertToLanguageModelV4FilePart(base64)).toEqual({
        data: { type: 'data', data: base64 },
        mediaType: undefined,
      });
    });

    it('converts a URL string into { type: "url", url }', () => {
      const result = convertToLanguageModelV4FilePart(
        'https://example.com/file.pdf',
      );
      expect(result.data.type).toBe('url');
      const url = (result.data as { type: 'url'; url: URL }).url;
      expect(url).toBeInstanceOf(URL);
      expect(url.toString()).toBe('https://example.com/file.pdf');
      expect(result.mediaType).toBeUndefined();
    });

    it('passes through a URL instance as { type: "url", url }', () => {
      const url = new URL('https://example.com/file.pdf');
      expect(convertToLanguageModelV4FilePart(url)).toEqual({
        data: { type: 'url', url },
        mediaType: undefined,
      });
    });

    it('extracts base64 and media type from a data URL into { type: "data", data }', () => {
      const result = convertToLanguageModelV4FilePart(
        'data:text/plain;base64,aGVsbG8=',
      );
      expect(result).toEqual({
        data: { type: 'data', data: 'aGVsbG8=' },
        mediaType: 'text/plain',
      });
    });

    it('wraps a provider reference as { type: "reference", reference }', () => {
      const reference = { openai: 'file-123', anthropic: 'file-abc' };
      expect(convertToLanguageModelV4FilePart(reference)).toEqual({
        data: { type: 'reference', reference },
        mediaType: undefined,
      });
    });
  });

  describe('tagged shapes', () => {
    it('unwraps { type: "data", data: Uint8Array }', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      expect(
        convertToLanguageModelV4FilePart({ type: 'data', data: bytes }),
      ).toEqual({ data: { type: 'data', data: bytes }, mediaType: undefined });
    });

    it('unwraps { type: "data", data: ArrayBuffer }', () => {
      const buffer = new Uint8Array([4, 5, 6]).buffer;
      const result = convertToLanguageModelV4FilePart({
        type: 'data',
        data: buffer,
      });
      expect(result.data.type).toBe('data');
      const inner = (result.data as { type: 'data'; data: Uint8Array }).data;
      expect(inner).toBeInstanceOf(Uint8Array);
      expect(Array.from(inner)).toEqual([4, 5, 6]);
      expect(result.mediaType).toBeUndefined();
    });

    it('unwraps { type: "data", data: base64 string } that is not a URL', () => {
      const base64 = 'aGVsbG8=';
      expect(
        convertToLanguageModelV4FilePart({ type: 'data', data: base64 }),
      ).toEqual({ data: { type: 'data', data: base64 }, mediaType: undefined });
    });

    it('rejects { type: "data", data: data URL string } — data URLs are not inline data', () => {
      expect(() =>
        convertToLanguageModelV4FilePart({
          type: 'data',
          data: 'data:text/plain;base64,aGVsbG8=',
        }),
      ).toThrow(/Data URLs are not valid inline data/);
    });

    it('unwraps { type: "url", url } into { type: "url", url }', () => {
      const url = new URL('https://example.com/file.pdf');
      expect(convertToLanguageModelV4FilePart({ type: 'url', url })).toEqual({
        data: { type: 'url', url },
        mediaType: undefined,
      });
    });

    it('unwraps { type: "url", url } with data URL into base64 + mediaType', () => {
      const url = new URL('data:text/plain;base64,aGVsbG8=');
      const result = convertToLanguageModelV4FilePart({
        type: 'url',
        url,
      });
      expect(result).toEqual({
        data: { type: 'data', data: 'aGVsbG8=' },
        mediaType: 'text/plain',
      });
    });

    it('passes through { type: "reference", reference }', () => {
      const reference = { openai: 'file-123', anthropic: 'file-abc' };
      expect(
        convertToLanguageModelV4FilePart({
          type: 'reference',
          reference,
        }),
      ).toEqual({
        data: { type: 'reference', reference },
        mediaType: undefined,
      });
    });

    it('passes through { type: "text", text }', () => {
      expect(
        convertToLanguageModelV4FilePart({ type: 'text', text: 'hello' }),
      ).toEqual({
        data: { type: 'text', text: 'hello' },
        mediaType: undefined,
      });
    });
  });

  describe('legacy and tagged produce the same output', () => {
    it('{ type: "data", data: bytes } equals bare bytes', () => {
      const bytes = new Uint8Array([7, 8, 9]);
      expect(
        convertToLanguageModelV4FilePart({ type: 'data', data: bytes }),
      ).toEqual(convertToLanguageModelV4FilePart(bytes));
    });

    it('{ type: "url", url } equals bare URL', () => {
      const url = new URL('https://example.com/file.pdf');
      expect(convertToLanguageModelV4FilePart({ type: 'url', url })).toEqual(
        convertToLanguageModelV4FilePart(url),
      );
    });

    it('{ type: "reference", reference } equals bare reference', () => {
      const reference = { openai: 'file-123' };
      expect(
        convertToLanguageModelV4FilePart({ type: 'reference', reference }),
      ).toEqual(convertToLanguageModelV4FilePart(reference));
    });
  });
});
