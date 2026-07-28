import { describe, expect, it } from 'vitest'

import { resolveApiMode } from '@/api/mode'

describe('API mode boundary', () => {
  it('defaults missing and mock values to the mock transport', () => {
    expect(resolveApiMode(undefined)).toBe('mock')
    expect(resolveApiMode('')).toBe('mock')
    expect(resolveApiMode(' MOCK ')).toBe('mock')
  })

  it('accepts the explicit HTTP transport', () => {
    expect(resolveApiMode('http')).toBe('http')
    expect(resolveApiMode(' HTTP ')).toBe('http')
  })

  it('rejects typos instead of silently selecting a transport', () => {
    expect(() => resolveApiMode('mokk')).toThrow(/VITE_API_MODE/)
  })
})
