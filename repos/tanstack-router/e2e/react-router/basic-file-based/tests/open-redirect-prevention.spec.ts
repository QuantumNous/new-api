import { expect, test } from '@playwright/test'

test.describe('Open redirect prevention', () => {
  test.describe('CRLF injection attacks', () => {
    test('should not redirect to external site via CR injection (%0d)', async ({
      page,
      baseURL,
    }) => {
      // This URL attempts to exploit CRLF injection to redirect to google.com
      // %0d = \r (carriage return)
      // Without the fix, /\r/google.com/ would be interpreted as //google.com/
      // which browsers resolve as a protocol-relative URL to http://google.com/
      await page.goto('/%0d/google.com/')
      await page.waitForLoadState('networkidle')

      // Should stay on the same origin - the path should be treated as a local path
      // not as an external redirect
      expect(page.url().startsWith(baseURL!)).toBe(true)
      // The origin should be localhost, not google.com
      const url = new URL(page.url())
      expect(url.origin).toBe(new URL(baseURL!).origin)
    })

    test('should not redirect to external site via LF injection (%0a)', async ({
      page,
      baseURL,
    }) => {
      // %0a = \n (line feed)
      await page.goto('/%0a/evil.com/')
      await page.waitForLoadState('networkidle')

      // Should stay on the same origin
      expect(page.url().startsWith(baseURL!)).toBe(true)
      const url = new URL(page.url())
      expect(url.origin).toBe(new URL(baseURL!).origin)
    })

    test('should not redirect to external site via CRLF injection (%0d%0a)', async ({
      page,
      baseURL,
    }) => {
      // Combined CRLF injection attempt
      await page.goto('/%0d%0a/attacker.com/')
      await page.waitForLoadState('networkidle')

      // Should stay on the same origin
      expect(page.url().startsWith(baseURL!)).toBe(true)
      const url = new URL(page.url())
      expect(url.origin).toBe(new URL(baseURL!).origin)
    })

    test('should not redirect to external site via multiple control chars', async ({
      page,
      baseURL,
    }) => {
      // Multiple CR/LF characters
      await page.goto('/%0d%0d%0a/malicious.com/path')
      await page.waitForLoadState('networkidle')

      // Should stay on the same origin
      expect(page.url().startsWith(baseURL!)).toBe(true)
      const url = new URL(page.url())
      expect(url.origin).toBe(new URL(baseURL!).origin)
    })
  })

  test.describe('Protocol-relative URL prevention', () => {
    test('should handle paths that could be misinterpreted as protocol-relative URLs', async ({
      page,
      baseURL,
    }) => {
      // %0d is kept encoded, so /%0d/test-path/ stays as-is and won't become //test-path/
      await page.goto('/%0d/test-path/')
      await page.waitForLoadState('networkidle')

      // Should stay on the same origin
      expect(page.url().startsWith(baseURL!)).toBe(true)
      const url = new URL(page.url())
      expect(url.origin).toBe(new URL(baseURL!).origin)
    })
  })

  test.describe('Normal navigation still works', () => {
    test('should navigate to normal paths correctly', async ({
      page,
      baseURL,
    }) => {
      await page.goto('/posts')
      await page.waitForLoadState('networkidle')

      expect(page.url()).toBe(`${baseURL}/posts`)
    })

    test('should handle URL-encoded characters in normal paths', async ({
      page,
      baseURL,
    }) => {
      // Normal URL encoding should still work
      await page.goto('/params/single/hello%20world')
      await page.waitForLoadState('networkidle')

      expect(page.url().startsWith(baseURL!)).toBe(true)
    })
  })
})
