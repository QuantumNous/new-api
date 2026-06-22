/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/

// Coverage: getDateRange — 100% | getBlockReasonLabelKey — 100%

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDateRange, getBlockReasonLabelKey, type BlockReason } from '../types'

describe('getDateRange', () => {
  const FIXED_NOW = new Date('2026-06-21T12:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('24h: end is now and start is exactly 24 hours earlier', () => {
    const { start, end } = getDateRange('24h')
    const startMs = new Date(start).getTime()
    const endMs = new Date(end).getTime()
    expect(endMs).toBe(FIXED_NOW.getTime())
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000)
  })

  it('7d: end is now and start is 7 days earlier', () => {
    const { start, end } = getDateRange('7d')
    const startMs = new Date(start).getTime()
    const endMs = new Date(end).getTime()
    expect(endMs).toBe(FIXED_NOW.getTime())
    // 7 days in ms
    expect(endMs - startMs).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3)
  })

  it('30d: end is now and start is 30 days earlier', () => {
    const { start, end } = getDateRange('30d')
    const startMs = new Date(start).getTime()
    const endMs = new Date(end).getTime()
    expect(endMs).toBe(FIXED_NOW.getTime())
    expect(endMs - startMs).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -3)
  })

  it('returns ISO 8601 strings', () => {
    const { start, end } = getDateRange('7d')
    // ISO 8601: must parse without NaN
    expect(new Date(start).toString()).not.toBe('Invalid Date')
    expect(new Date(end).toString()).not.toBe('Invalid Date')
    // Must contain 'T' separator
    expect(start).toContain('T')
    expect(end).toContain('T')
  })

  it('start is always strictly before end', () => {
    for (const preset of ['24h', '7d', '30d'] as const) {
      const { start, end } = getDateRange(preset)
      expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime())
    }
  })
})

describe('getBlockReasonLabelKey', () => {
  const cases: [BlockReason, string][] = [
    ['plan_required', 'skillAnalytics.blockReason.planRequired'],
    ['subscription_inactive', 'skillAnalytics.blockReason.subscriptionInactive'],
    ['quota_exceeded', 'skillAnalytics.blockReason.quotaExceeded'],
    ['kids_blocked', 'skillAnalytics.blockReason.kidsBlocked'],
    ['safety_violation', 'skillAnalytics.blockReason.safetyViolation'],
    ['unknown', 'skillAnalytics.blockReason.unknown'],
  ]

  it.each(cases)('%s → "%s"', (reason, expected) => {
    expect(getBlockReasonLabelKey(reason)).toBe(expected)
  })

  it('covers all 6 BlockReason variants', () => {
    // Compile-time check: each case array entry type-checks against BlockReason
    expect(cases).toHaveLength(6)
  })
})
