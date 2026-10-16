import { getResourceType } from '../src/rspack-plugins/resource-hints/getResourceType';

describe('getResourceType', () => {
  it('should return script for JavaScript files', () => {
    expect(
      getResourceType({
        href: '"/chunk/vendors.js"',
        file: 'chunk/vendors.js',
      }),
    ).toBe('script');
  });

  it('should return image for image files', () => {
    expect(
      getResourceType({
        href: '/image/logo.png',
        file: 'image/logo.png',
      }),
    ).toBe('image');
  });

  it('should return track for WebVTT files', () => {
    expect(
      getResourceType({
        href: '/media/subtitles.vtt',
        file: 'media/subtitles.vtt',
      }),
    ).toBe('track');
  });
});
