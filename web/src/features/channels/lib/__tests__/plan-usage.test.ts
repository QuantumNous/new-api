/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import {
  CHANNEL_TYPE_MINIMAX,
  CHANNEL_TYPE_ZHIPU,
  CHANNEL_TYPE_ZHIPU_V4,
  isPlanUsageChannelType,
} from '../../constants'
import {
  formatPlanRemainingPercent,
  formatPlanResetCountdown,
  getPlanRemainingVariant,
  parsePlanUsageFromOtherInfo,
} from '../channel-utils'

describe('isPlanUsageChannelType', () => {
  test('matches coding-plan channel types only', () => {
    expect(isPlanUsageChannelType(CHANNEL_TYPE_ZHIPU)).toBe(true)
    expect(isPlanUsageChannelType(CHANNEL_TYPE_ZHIPU_V4)).toBe(true)
    expect(isPlanUsageChannelType(CHANNEL_TYPE_MINIMAX)).toBe(true)
    expect(isPlanUsageChannelType(1)).toBe(false)
    expect(isPlanUsageChannelType(undefined)).toBe(false)
  })
})

describe('parsePlanUsageFromOtherInfo', () => {
  test('reads the persisted window snapshot from other_info JSON', () => {
    const usage = parsePlanUsageFromOtherInfo(
      '{"plan_usage":{"provider":"zhipu","level":"lite","windows":[' +
        '{"kind":"interval_5h","used_percent":0,"reset_time":0},' +
        '{"kind":"weekly","used_percent":47,"reset_time":1787919529}]}}'
    )
    expect(usage).toEqual({
      provider: 'zhipu',
      level: 'lite',
      windows: [
        { kind: 'interval_5h', used_percent: 0, reset_time: 0 },
        { kind: 'weekly', used_percent: 47, reset_time: 1787919529 },
      ],
    })
  })

  test('preserves other other_info keys and drops them from the snapshot', () => {
    // The snapshot is merged into a shared JSON blob alongside other keys.
    const usage = parsePlanUsageFromOtherInfo(
      '{"status_reason":"test","plan_usage":{"provider":"minimax","windows":[' +
        '{"kind":"interval_5h","used_percent":29.5,"reset_time":1787641200}]}}'
    )
    expect(usage?.provider).toBe('minimax')
    expect(usage?.level).toBeUndefined()
  })

  test('clamps upstream drift in used percent and tolerates missing reset', () => {
    const usage = parsePlanUsageFromOtherInfo(
      '{"plan_usage":{"provider":"zhipu","windows":[' +
        '{"kind":"weekly","used_percent":130,"reset_time":"soon"}]}}'
    )
    expect(usage?.windows[0].used_percent).toBe(100)
    expect(usage?.windows[0].reset_time).toBe(0)
  })

  test('returns null for missing, malformed, or empty data', () => {
    expect(parsePlanUsageFromOtherInfo(null)).toBeNull()
    expect(parsePlanUsageFromOtherInfo('')).toBeNull()
    expect(parsePlanUsageFromOtherInfo('not json')).toBeNull()
    expect(parsePlanUsageFromOtherInfo('{}')).toBeNull()
    expect(parsePlanUsageFromOtherInfo('{"plan_usage":{}}')).toBeNull()
    expect(
      parsePlanUsageFromOtherInfo('{"plan_usage":{"windows":[]}}')
    ).toBeNull()
    expect(
      parsePlanUsageFromOtherInfo('{"plan_usage":{"windows":[{"kind":5}]}}')
    ).toBeNull()
  })
})

describe('formatPlanResetCountdown', () => {
  const now = 1787800000

  test('renders compact plan-watch style countdowns', () => {
    // 3 days 20 hours
    expect(formatPlanResetCountdown(now + 3 * 86400 + 20 * 3600, now)).toBe(
      '3d20h'
    )
    // 3.7 hours = 3h42m
    expect(formatPlanResetCountdown(now + 3 * 3600 + 42 * 60, now)).toBe('3.7h')
    expect(formatPlanResetCountdown(now + 20 * 60, now)).toBe('20m')
    expect(formatPlanResetCountdown(now + 42, now)).toBe('42s')
  })

  test('unknown or already-passed reset times degrade gracefully', () => {
    expect(formatPlanResetCountdown(0, now)).toBe('-')
    expect(formatPlanResetCountdown(Number.NaN, now)).toBe('-')
    expect(formatPlanResetCountdown(now - 10, now)).toBe('0m')
  })
})

describe('formatPlanRemainingPercent', () => {
  test('renders one decimal without trailing zero', () => {
    expect(formatPlanRemainingPercent(100)).toBe('100%')
    expect(formatPlanRemainingPercent(52.5)).toBe('52.5%')
    expect(formatPlanRemainingPercent(0)).toBe('0%')
  })

  test('clamps out-of-range percents from upstream', () => {
    expect(formatPlanRemainingPercent(120)).toBe('100%')
    expect(formatPlanRemainingPercent(-3)).toBe('0%')
    expect(formatPlanRemainingPercent(Number.NaN)).toBe('-')
  })
})

describe('getPlanRemainingVariant', () => {
  test('escalates color as the tightest window drains', () => {
    expect(getPlanRemainingVariant(80)).toBe('success')
    expect(getPlanRemainingVariant(50)).toBe('success')
    expect(getPlanRemainingVariant(49.9)).toBe('warning')
    expect(getPlanRemainingVariant(19.9)).toBe('danger')
    // Never-queried channels persist 0 and stay neutral, like USD balances.
    expect(getPlanRemainingVariant(0)).toBe('neutral')
  })
})
