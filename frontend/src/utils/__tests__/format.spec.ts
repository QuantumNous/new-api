import { describe, expect, it } from 'vitest'

import {
  formatBytes,
  formatCompact,
  formatContext,
  formatDuration,
  formatLatency,
  formatMoney,
  formatQuota,
  formatTokenPrice,
  maskKey,
  passwordStrength,
  relativeTime,
} from '@/utils/format'

describe('maskKey', () => {
  it('never returns a non-empty secret verbatim', () => {
    expect(maskKey('')).toBe('')
    expect(maskKey('a')).toBe('•')
    expect(maskKey('sk-abcdefgh')).toBe('sk-••••gh')
    expect(maskKey('secret')).not.toBe('secret')
    expect(maskKey('secret')).not.toContain('secret')
  })

  it('keeps the established preview shape for normal token keys', () => {
    expect(maskKey('sk-7YX12345678lpK')).toBe('sk-7YX••••8lpK')
  })
})

describe('quota and money formatting', () => {
  it('converts quota to dollars at 500k per dollar', () => {
    expect(formatQuota(500_000)).toBe('$1.00')
    expect(formatQuota(1_250_000, 4)).toBe('$2.5000')
    expect(formatQuota(0)).toBe('$0.00')
  })

  it('formats money with grouping', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50')
  })

  it('formats token prices and missing values', () => {
    expect(formatTokenPrice(1.25)).toBe('$1.2500')
    expect(formatTokenPrice(undefined)).toBe('—')
  })
})

describe('compact numeric labels', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCompact(999)).toBe('999')
    expect(formatCompact(1_000)).toBe('1.0K')
    expect(formatCompact(1_500_000)).toBe('1.5M')
  })

  it('labels context windows', () => {
    expect(formatContext(0)).toBe('—')
    expect(formatContext(128_000)).toBe('128K')
    expect(formatContext(1_000_000)).toBe('1M')
    expect(formatContext(1_500_000)).toBe('1.5M')
  })

  it('labels byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(12_800)).toBe('12.5 KB')
    expect(formatBytes(2_205_000)).toBe('2.1 MB')
  })

  it('labels durations and latency', () => {
    expect(formatDuration(5)).toBe('5s')
    expect(formatDuration(75)).toBe('1:15')
    expect(formatLatency(1.784)).toBe('1.78s')
    expect(formatLatency(18.02)).toBe('18.0s')
  })
})

describe('relativeTime', () => {
  it('localizes recent and older timestamps', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(relativeTime(now - 30, 'zh-CN')).toBe('刚刚')
    expect(relativeTime(now - 30, 'en')).toBe('just now')
    expect(relativeTime(now - 120, 'en')).toBe('2m ago')
    expect(relativeTime(now - 7_200, 'zh-CN')).toBe('2 小时前')
    expect(relativeTime(now - 3 * 86_400, 'en')).toBe('3d ago')
  })
})

describe('passwordStrength', () => {
  it('scores from empty to strong', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(1)
    expect(passwordStrength('Abcdef12')).toBe(2)
    expect(passwordStrength('Abcdef12345!')).toBe(3)
  })
})
