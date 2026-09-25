import { resourceUrlFromServerUrl, checkResourceAllowed } from './oauth-util';
import { describe, it, expect } from 'vitest';

describe('auth-utils', () => {
  describe('resourceUrlFromServerUrl', () => {
    it('should remove fragments', () => {
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com/path#fragment'))
          .href,
      ).toBe('https://example.com/path');
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com#fragment')).href,
      ).toBe('https://example.com/');
      expect(
        resourceUrlFromServerUrl(
          new URL('https://example.com/path?query=1#fragment'),
        ).href,
      ).toBe('https://example.com/path?query=1');
    });

    it('should return URL unchanged if no fragment', () => {
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com')).href,
      ).toBe('https://example.com/');
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com/path')).href,
      ).toBe('https://example.com/path');
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com/path?query=1'))
          .href,
      ).toBe('https://example.com/path?query=1');
    });

    it('should keep everything else unchanged', () => {
      // Case sensitivity preserved
      expect(
        resourceUrlFromServerUrl(new URL('https://EXAMPLE.COM/PATH')).href,
      ).toBe('https://example.com/PATH');
      // Ports preserved
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com:443/path')).href,
      ).toBe('https://example.com/path');
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com:8080/path')).href,
      ).toBe('https://example.com:8080/path');
      // Query parameters preserved
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com?foo=bar&baz=qux'))
          .href,
      ).toBe('https://example.com/?foo=bar&baz=qux');
      // Trailing slashes preserved
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com/')).href,
      ).toBe('https://example.com/');
      expect(
        resourceUrlFromServerUrl(new URL('https://example.com/path/')).href,
      ).toBe('https://example.com/path/');
    });
  });

  describe('resourceMatches', () => {
    it('should match identical URLs', () => {
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/path',
          configuredResource: 'https://example.com/path',
        }),
      ).toBe(true);
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/',
          configuredResource: 'https://example.com/',
        }),
      ).toBe(true);
    });

    it('should not match URLs with different paths', () => {
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/path1',
          configuredResource: 'https://example.com/path2',
        }),
      ).toBe(false);
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/',
          configuredResource: 'https://example.com/path',
        }),
      ).toBe(false);
    });

    it('should not match URLs with different domains', () => {
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/path',
          configuredResource: 'https://example.org/path',
        }),
      ).toBe(false);
    });

    it('should not match URLs with different ports', () => {
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com:8080/path',
          configuredResource: 'https://example.com/path',
        }),
      ).toBe(false);
    });

    it('should not match URLs where one path is a sub-path of another', () => {
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/mcpxxxx',
          configuredResource: 'https://example.com/mcp',
        }),
      ).toBe(false);
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/folder',
          configuredResource: 'https://example.com/folder/subfolder',
        }),
      ).toBe(false);
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/api/v1',
          configuredResource: 'https://example.com/api',
        }),
      ).toBe(true);
    });

    it('should handle trailing slashes vs no trailing slashes', () => {
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/mcp/',
          configuredResource: 'https://example.com/mcp',
        }),
      ).toBe(true);
      expect(
        checkResourceAllowed({
          requestedResource: 'https://example.com/folder',
          configuredResource: 'https://example.com/folder/',
        }),
      ).toBe(false);
    });
  });
});
