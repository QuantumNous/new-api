import { describe, expect, test } from 'vitest'
import { parseHref } from '../src'

describe('parseHref', () => {
  test('works', () => {
    const parsed = parseHref('/foo?bar=baz#qux', {} as any)
    expect(parsed.pathname).toEqual('/foo')
    expect(parsed.search).toEqual('?bar=baz')
    expect(parsed.hash).toEqual('#qux')
  })

  describe('open redirect prevention', () => {
    test('strips CR characters to prevent open redirect', () => {
      // If \r (CR) is in the href, it should be stripped
      const parsed = parseHref('/\r/google.com/', undefined)
      expect(parsed.href).toBe('/google.com/')
      expect(parsed.pathname).toBe('/google.com/')
      expect(parsed.href).not.toMatch(/^\/\//)
    })

    test('strips LF characters to prevent open redirect', () => {
      const parsed = parseHref('/\n/evil.com/', undefined)
      expect(parsed.href).toBe('/evil.com/')
      expect(parsed.pathname).toBe('/evil.com/')
      expect(parsed.href).not.toMatch(/^\/\//)
    })

    test('strips CRLF characters to prevent open redirect', () => {
      const parsed = parseHref('/\r\n/evil.com/', undefined)
      expect(parsed.href).toBe('/evil.com/')
      expect(parsed.pathname).toBe('/evil.com/')
      expect(parsed.href).not.toMatch(/^\/\//)
    })

    test('collapses leading double slashes to prevent protocol-relative URLs', () => {
      const parsed = parseHref('//evil.com/path', undefined)
      expect(parsed.href).toBe('/evil.com/path')
      expect(parsed.pathname).toBe('/evil.com/path')
    })

    test('sanitized href resolves safely to same origin', () => {
      const parsed = parseHref('/\r/evil.com/', undefined)
      const url = new URL(parsed.href, 'http://localhost:3000')
      expect(url.origin).toBe('http://localhost:3000')
      expect(url.pathname).toBe('/evil.com/')
    })

    test('normal paths remain unchanged', () => {
      const parsed = parseHref('/users/profile?id=1#section', undefined)
      expect(parsed.href).toBe('/users/profile?id=1#section')
      expect(parsed.pathname).toBe('/users/profile')
      expect(parsed.search).toBe('?id=1')
      expect(parsed.hash).toBe('#section')
    })
  })
})
