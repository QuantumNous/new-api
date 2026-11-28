import { describe, it, expect } from 'vitest';
import { convertImageModelFileToDataUri } from './convert-image-model-file-to-data-uri';

describe('convertImageModelFileToDataUri()', () => {
  describe('URL files', () => {
    it('should return the URL as-is for URL type files', () => {
      const result = convertImageModelFileToDataUri({
        type: 'url',
        url: 'https://example.com/image.png',
      });

      expect(result).toBe('https://example.com/image.png');
    });

    it('should handle URLs with query parameters', () => {
      const result = convertImageModelFileToDataUri({
        type: 'url',
        url: 'https://example.com/image.png?width=100&height=200',
      });

      expect(result).toBe('https://example.com/image.png?width=100&height=200');
    });
  });

  describe('base64 string files', () => {
    it('should return a data URI for base64 string data', () => {
      const result = convertImageModelFileToDataUri({
        type: 'file',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      });

      expect(result).toBe(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      );
    });

    it('should handle different media types', () => {
      const result = convertImageModelFileToDataUri({
        type: 'file',
        mediaType: 'image/jpeg',
        data: 'base64data',
      });

      expect(result).toBe('data:image/jpeg;base64,base64data');
    });
  });

  describe('Uint8Array files', () => {
    it('should convert Uint8Array to base64 and return a data URI', () => {
      // "Hello" in bytes
      const data = new Uint8Array([72, 101, 108, 108, 111]);

      const result = convertImageModelFileToDataUri({
        type: 'file',
        mediaType: 'image/png',
        data,
      });

      expect(result).toBe('data:image/png;base64,SGVsbG8=');
    });

    it('should handle empty Uint8Array', () => {
      const result = convertImageModelFileToDataUri({
        type: 'file',
        mediaType: 'image/png',
        data: new Uint8Array([]),
      });

      expect(result).toBe('data:image/png;base64,');
    });

    it('should handle different media types with Uint8Array', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]);

      const result = convertImageModelFileToDataUri({
        type: 'file',
        mediaType: 'image/webp',
        data,
      });

      expect(result).toBe('data:image/webp;base64,SGVsbG8=');
    });
  });
});
