import { describe, expect, test } from 'vitest'
import { getOrigin } from '../src/ssr/ssr-server'

describe('getOrigin security', () => {
  test('should not trust spoofed Origin header', () => {
    // An attacker could send a malicious Origin header to try to manipulate
    // the router's origin, which could affect redirect handling (CVE-2024-34351)
    const maliciousRequest = new Request('https://legitimate.com/api/action', {
      headers: {
        Origin: 'https://evil.com',
      },
    })

    const origin = getOrigin(maliciousRequest)

    // The origin should come from request.url, not the spoofed Origin header
    // This prevents SSRF-like attacks where an attacker tries to manipulate
    // how redirects are processed by providing a malicious Origin header
    expect(origin).toBe('https://legitimate.com')
    expect(origin).not.toBe('https://evil.com')
  })

  test('should derive origin from request URL', () => {
    const request = new Request('https://myapp.com/page')
    const origin = getOrigin(request)
    expect(origin).toBe('https://myapp.com')
  })

  test('should handle localhost requests', () => {
    const request = new Request('http://localhost:3000/api')
    const origin = getOrigin(request)
    expect(origin).toBe('http://localhost:3000')
  })

  test('should return fallback for invalid request URL', () => {
    // This should be rare, but handle gracefully
    const request = {
      url: 'not-a-valid-url',
      headers: new Headers(),
    } as unknown as Request

    const origin = getOrigin(request)
    expect(origin).toBe('http://localhost')
  })

  test('should ignore Origin header even if request URL parse fails', () => {
    // Even if the request URL is somehow invalid, we should not fall back
    // to trusting the Origin header
    const request = {
      url: 'invalid-url',
      headers: new Headers({
        Origin: 'https://evil.com',
      }),
    } as unknown as Request

    const origin = getOrigin(request)

    // Should fall back to localhost, not use the potentially malicious Origin
    expect(origin).toBe('http://localhost')
    expect(origin).not.toBe('https://evil.com')
  })
})
