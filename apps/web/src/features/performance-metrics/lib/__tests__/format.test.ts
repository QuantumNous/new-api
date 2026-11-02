import { describe, expect, test } from 'bun:test'

import {
  formatLatency,
  formatLatencyValue,
  formatLatencyWithUnit,
  pickLatencyUnit,
} from '../format'

// The unit rule has to hold at the 1s boundary: a chart whose peak crosses it
// flips every label on the axis, so an off-by-one here changes a whole column
// of numbers, not one cell.
describe('pickLatencyUnit', () => {
  test('milliseconds below one second, seconds at and above', () => {
    expect(pickLatencyUnit(0)).toBe('ms')
    expect(pickLatencyUnit(1)).toBe('ms')
    expect(pickLatencyUnit(999)).toBe('ms')
    expect(pickLatencyUnit(1_000)).toBe('s')
    expect(pickLatencyUnit(2_500)).toBe('s')
  })

  test('a non-finite peak falls back to milliseconds', () => {
    expect(pickLatencyUnit(Number.NaN)).toBe('ms')
    expect(pickLatencyUnit(Number.POSITIVE_INFINITY)).toBe('ms')
  })
})

describe('formatLatencyValue', () => {
  test('seconds keep two decimals so the card width is stable', () => {
    expect(formatLatencyValue(1_000, 's')).toBe('1.00')
    expect(formatLatencyValue(2_500, 's')).toBe('2.50')
    expect(formatLatencyValue(60_000, 's')).toBe('60.00')
  })

  test('milliseconds stay whole integers', () => {
    expect(formatLatencyValue(0, 'ms')).toBe('0')
    expect(formatLatencyValue(420, 'ms')).toBe('420')
    expect(formatLatencyValue(12_500, 'ms')).toBe('12,500')
  })

  test('never renders a negative value', () => {
    expect(formatLatencyValue(-500, 'ms')).toBe('0')
    expect(formatLatencyValue(-500, 's')).toBe('0.00')
  })
})

describe('formatLatencyWithUnit', () => {
  test('carries the unit suffix', () => {
    expect(formatLatencyWithUnit(850, 'ms')).toBe('850ms')
    expect(formatLatencyWithUnit(1_250, 's')).toBe('1.25s')
  })

  // An idle hour or an unsampled bucket has no measurement; it must read as a
  // dash rather than as "0ms", which would claim a zero-latency request.
  test('no measurement renders as a dash', () => {
    expect(formatLatencyWithUnit(0, 'ms')).toBe('—')
    expect(formatLatencyWithUnit(-1, 's')).toBe('—')
    expect(formatLatencyWithUnit(Number.NaN, 's')).toBe('—')
  })
})

describe('formatLatency', () => {
  test('a standalone value picks its own unit', () => {
    expect(formatLatency(820)).toBe('820ms')
    expect(formatLatency(1_200)).toBe('1.20s')
  })

  test('no measurement renders as a dash', () => {
    expect(formatLatency(0)).toBe('—')
    expect(formatLatency(-5)).toBe('—')
    expect(formatLatency(Number.NaN)).toBe('—')
  })
})
