import { describe, expect, it } from 'vitest';
import {
  detectMediaType,
  getTopLevelMediaType,
  isFullMediaType,
} from './detect-media-type';
import { convertUint8ArrayToBase64 } from './uint8-utils';

describe('detectMediaType signature matching', () => {
  describe('GIF', () => {
    it('should detect GIF from bytes', () => {
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0xff, 0xff]);
      expect(
        detectMediaType({
          data: gifBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/gif');
    });

    it('should detect GIF from base64', () => {
      const gifBase64 = 'R0lGabc123'; // Base64 string starting with GIF signature
      expect(
        detectMediaType({
          data: gifBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/gif');
    });
  });

  describe('PNG', () => {
    it('should detect PNG from bytes', () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xff]);
      expect(
        detectMediaType({
          data: pngBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/png');
    });

    it('should detect PNG from base64', () => {
      const pngBase64 = 'iVBORwabc123'; // Base64 string starting with PNG signature
      expect(
        detectMediaType({
          data: pngBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/png');
    });
  });

  describe('JPEG', () => {
    it('should detect JPEG from bytes', () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xff]);
      expect(
        detectMediaType({
          data: jpegBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/jpeg');
    });

    it('should detect JPEG from base64', () => {
      const jpegBase64 = '/9j/abc123'; // Base64 string starting with JPEG signature
      expect(
        detectMediaType({
          data: jpegBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/jpeg');
    });
  });

  describe('WebP', () => {
    it('should detect WebP from bytes (positive webp image uint8)', () => {
      // WebP format: RIFF + 4 bytes file size + WEBP
      const webpBytes = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // "RIFF"
        0x24,
        0x00,
        0x00,
        0x00, // file size (example: 36 bytes)
        0x57,
        0x45,
        0x42,
        0x50, // "WEBP"
        0x56,
        0x50,
        0x38,
        0x20, // VP8 chunk (additional WebP data)
      ]);
      expect(
        detectMediaType({
          data: webpBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/webp');
    });

    it('should detect WebP from base64 (positive webp image base64)', () => {
      // WebP: RIFF + file size + WEBP encoded to base64
      const webpBytes = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // "RIFF"
        0x24,
        0x00,
        0x00,
        0x00, // file size
        0x57,
        0x45,
        0x42,
        0x50, // "WEBP"
        0x56,
        0x50,
        0x38,
        0x20, // VP8 chunk
      ]);
      const webpBase64 = convertUint8ArrayToBase64(webpBytes);
      expect(
        detectMediaType({
          data: webpBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/webp');
    });

    it('should NOT detect RIFF audio as WebP from bytes (negative riff audio uint8)', () => {
      // WAV format: RIFF + file size + WAVE (not WEBP)
      const wavBytes = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // "RIFF"
        0x24,
        0x00,
        0x00,
        0x00, // file size
        0x57,
        0x41,
        0x56,
        0x45, // "WAVE" (not "WEBP")
        0x66,
        0x6d,
        0x74,
        0x20, // fmt chunk
      ]);
      expect(
        detectMediaType({
          data: wavBytes,
          topLevelType: 'image',
        }),
      ).toBeUndefined(); // Should not detect as WebP
    });

    it('should NOT detect RIFF audio as WebP from base64 (negative riff audio base64)', () => {
      // WAV format encoded to base64
      const wavBytes = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // "RIFF"
        0x24,
        0x00,
        0x00,
        0x00, // file size
        0x57,
        0x41,
        0x56,
        0x45, // "WAVE" (not "WEBP")
        0x66,
        0x6d,
        0x74,
        0x20, // fmt chunk
      ]);
      const wavBase64 = convertUint8ArrayToBase64(wavBytes);
      expect(
        detectMediaType({
          data: wavBase64,
          topLevelType: 'image',
        }),
      ).toBeUndefined(); // Should not detect as WebP
    });
  });

  describe('BMP', () => {
    it('should detect BMP from bytes', () => {
      const bmpBytes = new Uint8Array([0x42, 0x4d, 0xff, 0xff]);
      expect(
        detectMediaType({
          data: bmpBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/bmp');
    });

    it('should detect BMP from base64', () => {
      const bmpBytes = new Uint8Array([0x42, 0x4d, 0xff, 0xff]);
      expect(
        detectMediaType({
          data: convertUint8ArrayToBase64(bmpBytes),
          topLevelType: 'image',
        }),
      ).toBe('image/bmp');
    });
  });

  describe('TIFF', () => {
    it('should detect TIFF (little endian) from bytes', () => {
      const tiffLEBytes = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0xff]);
      expect(
        detectMediaType({
          data: tiffLEBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/tiff');
    });

    it('should detect TIFF (little endian) from base64', () => {
      const tiffLEBase64 = 'SUkqAAabc123'; // Base64 string starting with TIFF LE signature
      expect(
        detectMediaType({
          data: tiffLEBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/tiff');
    });

    it('should detect TIFF (big endian) from bytes', () => {
      const tiffBEBytes = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0xff]);
      expect(
        detectMediaType({
          data: tiffBEBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/tiff');
    });

    it('should detect TIFF (big endian) from base64', () => {
      const tiffBEBase64 = 'TU0AKgabc123'; // Base64 string starting with TIFF BE signature
      expect(
        detectMediaType({
          data: tiffBEBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/tiff');
    });
  });

  describe('AVIF', () => {
    it('should detect AVIF from bytes', () => {
      const avifBytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
        0xff,
      ]);
      expect(
        detectMediaType({
          data: avifBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/avif');
    });

    it('should detect AVIF from base64', () => {
      const avifBase64 = 'AAAAIGZ0eXBhdmlmabc123'; // Base64 string starting with AVIF signature
      expect(
        detectMediaType({
          data: avifBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/avif');
    });
  });

  describe('HEIC', () => {
    it('should detect HEIC from bytes', () => {
      const heicBytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
        0xff,
      ]);
      expect(
        detectMediaType({
          data: heicBytes,
          topLevelType: 'image',
        }),
      ).toBe('image/heic');
    });

    it('should detect HEIC from base64', () => {
      const heicBase64 = 'AAAAIGZ0eXBoZWljabc123'; // Base64 string starting with HEIC signature
      expect(
        detectMediaType({
          data: heicBase64,
          topLevelType: 'image',
        }),
      ).toBe('image/heic');
    });
  });

  describe('MP3', () => {
    it('should detect MP3 from bytes', () => {
      const mp3Bytes = new Uint8Array([0xff, 0xfb]);
      expect(
        detectMediaType({
          data: mp3Bytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/mpeg');
    });

    it('should detect MP3 from base64', () => {
      const mp3Base64 = '//s='; // Base64 string starting with MP3 signature
      expect(
        detectMediaType({
          data: mp3Base64,
          topLevelType: 'audio',
        }),
      ).toBe('audio/mpeg');
    });

    it('should detect MP3 with ID3v2 tags from bytes', () => {
      const mp3WithID3Bytes = new Uint8Array([
        0x49,
        0x44,
        0x33, // 'ID3'
        0x03,
        0x00, // version
        0x00, // flags
        0x00,
        0x00,
        0x00,
        0x0a, // size (10 bytes)
        // 10 bytes of ID3 data
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        // MP3 frame header
        0xff,
        0xfb,
        0x00,
        0x00,
      ]);
      expect(
        detectMediaType({
          data: mp3WithID3Bytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/mpeg');
    });
    it('should detect MP3 with ID3v2 tags from base64', () => {
      const mp3WithID3Bytes = new Uint8Array([
        0x49,
        0x44,
        0x33, // 'ID3'
        0x03,
        0x00, // version
        0x00, // flags
        0x00,
        0x00,
        0x00,
        0x0a, // size (10 bytes)
        // 10 bytes of ID3 data
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        // MP3 frame header
        0xff,
        0xfb,
        0x00,
        0x00,
      ]);
      const mp3WithID3Base64 = convertUint8ArrayToBase64(mp3WithID3Bytes);
      expect(
        detectMediaType({
          data: mp3WithID3Base64,
          topLevelType: 'audio',
        }),
      ).toBe('audio/mpeg');
    });
  });

  describe('WAV', () => {
    // WebP format: RIFF + 4 bytes file size + WEBP
    const webpBytes = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46, // "RIFF"
      0x24,
      0x00,
      0x00,
      0x00, // file size (example: 36 bytes)
      0x57,
      0x45,
      0x42,
      0x50, // "WEBP"
      0x56,
      0x50,
      0x38,
      0x20, // VP8 chunk (additional WebP data)
    ]);

    const wavBytes = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46, // "RIFF"
      0x24,
      0x00,
      0x00,
      0x00, // file size (example: 36 bytes)
      0x57,
      0x41,
      0x56,
      0x45, // "WAVE" (not "WEBP")
      0x66,
      0x6d,
      0x74,
      0x20, // fmt chunk
    ]);

    it('should detect WAV from bytes', () => {
      expect(
        detectMediaType({
          data: wavBytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/wav');
    });

    it('should detect WAV from base64', () => {
      expect(
        detectMediaType({
          data: convertUint8ArrayToBase64(wavBytes),
          topLevelType: 'audio',
        }),
      ).toBe('audio/wav');
    });

    it('should NOT detect WebP as WAV from bytes (negative webp image uint8)', () => {
      expect(
        detectMediaType({
          data: webpBytes,
          topLevelType: 'audio',
        }),
      ).toBeUndefined(); // Should not detect as WAV
    });

    it('should NOT detect WebP as WAV from base64 (negative webp image base64)', () => {
      expect(
        detectMediaType({
          data: convertUint8ArrayToBase64(webpBytes),
          topLevelType: 'audio',
        }),
      ).toBeUndefined(); // Should not detect as WAV
    });
  });

  describe('OGG', () => {
    it('should detect OGG from bytes', () => {
      const oggBytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
      expect(
        detectMediaType({
          data: oggBytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/ogg');
    });

    it('should detect OGG from base64', () => {
      const oggBase64 = 'T2dnUw'; // Base64 string starting with OGG signature
      expect(
        detectMediaType({
          data: oggBase64,
          topLevelType: 'audio',
        }),
      ).toBe('audio/ogg');
    });
  });

  describe('FLAC', () => {
    it('should detect FLAC from bytes', () => {
      const flacBytes = new Uint8Array([0x66, 0x4c, 0x61, 0x43]);
      expect(
        detectMediaType({
          data: flacBytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/flac');
    });

    it('should detect FLAC from base64', () => {
      const flacBase64 = 'ZkxhQw'; // Base64 string starting with FLAC signature
      expect(
        detectMediaType({
          data: flacBase64,
          topLevelType: 'audio',
        }),
      ).toBe('audio/flac');
    });
  });

  describe('AAC', () => {
    it('should detect AAC from bytes', () => {
      const aacBytes = new Uint8Array([0x40, 0x15, 0x00, 0x00]);
      expect(
        detectMediaType({
          data: aacBytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/aac');
    });

    it('should detect AAC from base64', () => {
      const aacBytes = new Uint8Array([0x40, 0x15, 0x00, 0x00]);
      expect(
        detectMediaType({
          data: convertUint8ArrayToBase64(aacBytes),
          topLevelType: 'audio',
        }),
      ).toBe('audio/aac');
    });
  });

  describe('MP4', () => {
    it('should detect MP4 from bytes', () => {
      const mp4Bytes = new Uint8Array([0x66, 0x74, 0x79, 0x70]);
      expect(
        detectMediaType({
          data: mp4Bytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/mp4');
    });

    it('should detect MP4 from base64', () => {
      const mp4Base64 = 'ZnR5cA'; // Base64 string starting with MP4 signature
      expect(
        detectMediaType({
          data: mp4Base64,
          topLevelType: 'audio',
        }),
      ).toBe('audio/mp4');
    });
  });

  describe('WEBM', () => {
    it('should detect WEBM from bytes', () => {
      const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
      expect(
        detectMediaType({
          data: webmBytes,
          topLevelType: 'audio',
        }),
      ).toBe('audio/webm');
    });

    it('should detect WEBM from base64', () => {
      const webmBase64 = 'GkXfow=='; // Base64 string starting with WEBM signature
      expect(
        detectMediaType({
          data: webmBase64,
          topLevelType: 'audio',
        }),
      ).toBe('audio/webm');
    });
  });

  describe('error cases', () => {
    it('should return undefined for unknown image formats', () => {
      const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(
        detectMediaType({
          data: unknownBytes,
          topLevelType: 'image',
        }),
      ).toBeUndefined();
    });

    it('should return undefined for unknown audio formats', () => {
      const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(
        detectMediaType({
          data: unknownBytes,
          topLevelType: 'audio',
        }),
      ).toBeUndefined();
    });

    it('should return undefined for empty arrays for image', () => {
      const emptyBytes = new Uint8Array([]);
      expect(
        detectMediaType({
          data: emptyBytes,
          topLevelType: 'image',
        }),
      ).toBeUndefined();
    });

    it('should return undefined for empty arrays for audio', () => {
      const emptyBytes = new Uint8Array([]);
      expect(
        detectMediaType({
          data: emptyBytes,
          topLevelType: 'audio',
        }),
      ).toBeUndefined();
    });

    it('should return undefined for arrays shorter than signature length for image', () => {
      const shortBytes = new Uint8Array([0x89, 0x50]); // Incomplete PNG signature
      expect(
        detectMediaType({
          data: shortBytes,
          topLevelType: 'image',
        }),
      ).toBeUndefined();
    });

    it('should return undefined for arrays shorter than signature length for audio', () => {
      const shortBytes = new Uint8Array([0x4f, 0x67]); // Incomplete OGG signature
      expect(
        detectMediaType({
          data: shortBytes,
          topLevelType: 'audio',
        }),
      ).toBeUndefined();
    });

    it('should return undefined for invalid base64 strings for image', () => {
      const invalidBase64 = 'invalid123';
      expect(
        detectMediaType({
          data: invalidBase64,
          topLevelType: 'image',
        }),
      ).toBeUndefined();
    });

    it('should return undefined for invalid base64 strings for audio', () => {
      const invalidBase64 = 'invalid123';
      expect(
        detectMediaType({
          data: invalidBase64,
          topLevelType: 'audio',
        }),
      ).toBeUndefined();
    });
  });
});

describe('getTopLevelMediaType', () => {
  it('returns the top-level segment for a full media type', () => {
    expect(getTopLevelMediaType('image/png')).toBe('image');
    expect(getTopLevelMediaType('audio/mpeg')).toBe('audio');
    expect(getTopLevelMediaType('video/mp4')).toBe('video');
    expect(getTopLevelMediaType('application/pdf')).toBe('application');
    expect(getTopLevelMediaType('text/plain')).toBe('text');
  });

  it('returns the input when it is already just a top-level segment', () => {
    expect(getTopLevelMediaType('image')).toBe('image');
    expect(getTopLevelMediaType('audio')).toBe('audio');
    expect(getTopLevelMediaType('video')).toBe('video');
    expect(getTopLevelMediaType('application')).toBe('application');
    expect(getTopLevelMediaType('text')).toBe('text');
  });

  it('normalizes *-subtype wildcards to the top-level segment', () => {
    expect(getTopLevelMediaType('image/*')).toBe('image');
    expect(getTopLevelMediaType('audio/*')).toBe('audio');
    expect(getTopLevelMediaType('video/*')).toBe('video');
    expect(getTopLevelMediaType('application/*')).toBe('application');
    expect(getTopLevelMediaType('text/*')).toBe('text');
  });

  it('handles edge cases', () => {
    expect(getTopLevelMediaType('')).toBe('');
    expect(getTopLevelMediaType('/')).toBe('');
    expect(getTopLevelMediaType('image/')).toBe('image');
  });
});

describe('isFullMediaType', () => {
  it('returns true for media types with a concrete subtype', () => {
    expect(isFullMediaType('image/png')).toBe(true);
    expect(isFullMediaType('audio/mpeg')).toBe(true);
    expect(isFullMediaType('video/mp4')).toBe(true);
    expect(isFullMediaType('application/pdf')).toBe(true);
    expect(isFullMediaType('text/plain')).toBe(true);
  });

  it('returns false for top-level-only media types', () => {
    expect(isFullMediaType('image')).toBe(false);
    expect(isFullMediaType('audio')).toBe(false);
    expect(isFullMediaType('video')).toBe(false);
    expect(isFullMediaType('application')).toBe(false);
    expect(isFullMediaType('text')).toBe(false);
  });

  it('returns false for *-subtype wildcards', () => {
    expect(isFullMediaType('image/*')).toBe(false);
    expect(isFullMediaType('audio/*')).toBe(false);
    expect(isFullMediaType('video/*')).toBe(false);
    expect(isFullMediaType('application/*')).toBe(false);
    expect(isFullMediaType('text/*')).toBe(false);
  });

  it('returns false for edge cases', () => {
    expect(isFullMediaType('')).toBe(false);
    expect(isFullMediaType('/')).toBe(false);
    expect(isFullMediaType('image/')).toBe(false);
  });
});

describe('detectMediaType', () => {
  it('detects image types when topLevelType is "image"', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xff]);
    expect(
      detectMediaType({
        data: pngBytes,
        topLevelType: 'image',
      }),
    ).toBe('image/png');
  });

  it('detects audio types when topLevelType is "audio"', () => {
    const mp3Bytes = new Uint8Array([0xff, 0xfb]);
    expect(
      detectMediaType({
        data: mp3Bytes,
        topLevelType: 'audio',
      }),
    ).toBe('audio/mpeg');
  });

  it('detects video types when topLevelType is "video"', () => {
    const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
    expect(
      detectMediaType({
        data: webmBytes,
        topLevelType: 'video',
      }),
    ).toBe('video/webm');
  });

  it('detects document types when topLevelType is "application"', () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00]);
    expect(
      detectMediaType({
        data: pdfBytes,
        topLevelType: 'application',
      }),
    ).toBe('application/pdf');
  });

  it('returns undefined for the "text" top-level segment', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    expect(
      detectMediaType({
        data,
        topLevelType: 'text',
      }),
    ).toBeUndefined();
  });

  it('returns undefined for unknown top-level segments', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xff]);
    expect(
      detectMediaType({
        data: pngBytes,
        topLevelType: 'not-a-real-segment',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when data does not match any signature in the segment table', () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(
      detectMediaType({
        data: garbage,
        topLevelType: 'image',
      }),
    ).toBeUndefined();
  });

  describe('without topLevelType', () => {
    it('detects image types', () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xff]);
      expect(detectMediaType({ data: pngBytes })).toBe('image/png');
    });

    it('detects audio types', () => {
      const mp3Bytes = new Uint8Array([0xff, 0xfb]);
      expect(detectMediaType({ data: mp3Bytes })).toBe('audio/mpeg');
    });

    it('detects video types', () => {
      const mp4Bytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
      ]);
      expect(detectMediaType({ data: mp4Bytes })).toBe('video/mp4');
    });

    it('detects document types', () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00]);
      expect(detectMediaType({ data: pdfBytes })).toBe('application/pdf');
    });

    it('returns undefined when data does not match any signature', () => {
      const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(detectMediaType({ data: garbage })).toBeUndefined();
    });
  });
});
