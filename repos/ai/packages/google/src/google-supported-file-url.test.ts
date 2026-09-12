import { isSupportedFileUrl } from './google-supported-file-url';
import { it, expect } from 'vitest';

it('should return true for valid Google generative language file URLs', () => {
  const validUrl = new URL(
    'https://generativelanguage.googleapis.com/v1beta/files/00000000-00000000-00000000-00000000',
  );
  expect(isSupportedFileUrl(validUrl)).toBe(true);

  const simpleValidUrl = new URL(
    'https://generativelanguage.googleapis.com/v1beta/files/test123',
  );
  expect(isSupportedFileUrl(simpleValidUrl)).toBe(true);
});

it('should return true for valid YouTube URLs', () => {
  const validYouTubeUrls = [
    new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    new URL('https://youtube.com/watch?v=dQw4w9WgXcQ'),
    new URL('https://youtu.be/dQw4w9WgXcQ'),
    new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be'),
    new URL('https://youtu.be/dQw4w9WgXcQ?t=42'),
  ];

  validYouTubeUrls.forEach(url => {
    expect(isSupportedFileUrl(url)).toBe(true);
  });
});

it('should return false for invalid YouTube URLs', () => {
  const invalidYouTubeUrls = [
    new URL('https://youtube.com/channel/UCdQw4w9WgXcQ'),
    new URL('https://youtube.com/playlist?list=PLdQw4w9WgXcQ'),
    new URL('https://m.youtube.com/watch?v=dQw4w9WgXcQ'),
    new URL('http://youtube.com/watch?v=dQw4w9WgXcQ'),
    new URL('https://vimeo.com/123456789'),
  ];

  invalidYouTubeUrls.forEach(url => {
    expect(isSupportedFileUrl(url)).toBe(false);
  });
});

it('should return false for non-Google generative language file URLs', () => {
  const testCases = [
    new URL('https://example.com'),
    new URL('https://example.com/foo/bar'),
    new URL('https://generativelanguage.googleapis.com'),
    new URL('https://generativelanguage.googleapis.com/v1/other'),
    new URL('http://generativelanguage.googleapis.com/v1beta/files/test'),
    new URL('https://api.googleapis.com/v1beta/files/test'),
  ];

  testCases.forEach(url => {
    expect(isSupportedFileUrl(url)).toBe(false);
  });
});
