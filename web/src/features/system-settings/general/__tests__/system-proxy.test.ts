import { describe, expect, it } from 'vitest'

import { isOptionalProxyURL } from '../system-proxy'

describe('isOptionalProxyURL', () => {
  it('accepts an empty value and the channel proxy schemes', () => {
    expect(isOptionalProxyURL('')).toBe(true)
    expect(isOptionalProxyURL('http://proxy.example:8080')).toBe(true)
    expect(isOptionalProxyURL('https://user:pass@proxy.example:8443')).toBe(
      true
    )
    expect(isOptionalProxyURL('socks5://proxy.example:1080')).toBe(true)
    expect(isOptionalProxyURL('socks5h://proxy.example')).toBe(true)
  })

  it('rejects a path, query, or unsupported scheme', () => {
    expect(isOptionalProxyURL(' ftp://proxy.example ')).toBe(false)
    expect(isOptionalProxyURL('socks5://proxy.example:1080/path')).toBe(false)
    expect(isOptionalProxyURL('http://proxy.example?x=1')).toBe(false)
    expect(isOptionalProxyURL('http://proxy.example?')).toBe(false)
    expect(isOptionalProxyURL('http://proxy.example#')).toBe(false)
  })
})
