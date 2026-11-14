import {
  UnsupportedFunctionalityError,
  type LanguageModelV4FilePart,
} from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { resolveFullMediaType } from './resolve-full-media-type';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
]);

describe('resolveFullMediaType', () => {
  it('returns full media type as-is', () => {
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'image/jpeg',
      data: { type: 'data', data: PNG_BYTES },
    };
    expect(resolveFullMediaType({ part })).toBe('image/jpeg');
  });

  it('detects image subtype from inline bytes for top-level-only media type', () => {
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'image',
      data: { type: 'data', data: PNG_BYTES },
    };
    expect(resolveFullMediaType({ part })).toBe('image/png');
  });

  it('treats image/* wildcard as top-level and runs detection', () => {
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'image/*',
      data: { type: 'data', data: PNG_BYTES },
    };
    expect(resolveFullMediaType({ part })).toBe('image/png');
  });

  it('detects application subtype (PDF)', () => {
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'application',
      data: { type: 'data', data: PDF_BYTES },
    };
    expect(resolveFullMediaType({ part })).toBe('application/pdf');
  });

  it('throws the "not passed as inline bytes" message when URL source with top-level-only media type', () => {
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'image',
      data: { type: 'url', url: new URL('https://example.com/x') },
    };
    expect(() => resolveFullMediaType({ part })).toThrow(
      UnsupportedFunctionalityError,
    );
    expect(() => resolveFullMediaType({ part })).toThrow(
      /not passed as inline bytes/,
    );
  });

  it('throws the "could not be auto-detected" message when bytes are present but unrecognised', () => {
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'image',
      data: { type: 'data', data: new Uint8Array([0x00, 0x01, 0x02]) },
    };
    expect(() => resolveFullMediaType({ part })).toThrow(
      UnsupportedFunctionalityError,
    );
    expect(() => resolveFullMediaType({ part })).toThrow(
      /could not be auto-detected/,
    );
  });

  it('throws the "could not be auto-detected" message when top-level segment is unsupported (e.g. text)', () => {
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'text',
      data: { type: 'data', data: 'hello' },
    };
    expect(() => resolveFullMediaType({ part })).toThrow(
      UnsupportedFunctionalityError,
    );
    expect(() => resolveFullMediaType({ part })).toThrow(
      /could not be auto-detected/,
    );
  });

  it('accepts base64 string data', () => {
    const base64 = Buffer.from(PNG_BYTES).toString('base64');
    const part: LanguageModelV4FilePart = {
      type: 'file',
      mediaType: 'image',
      data: { type: 'data', data: base64 },
    };
    expect(resolveFullMediaType({ part })).toBe('image/png');
  });
});
