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
import { describe, expect, it } from 'bun:test'
import {
  getVisibleCodexLimitWindows,
  resolveCodexLimitWindows,
} from './codex-usage-windows'

describe('Codex usage windows', () => {
  it('shows only the weekly card when the upstream removed the short window', () => {
    const weekly = {
      used_percent: 17,
      limit_window_seconds: 7 * 24 * 60 * 60,
    }
    const resolved = resolveCodexLimitWindows({
      rate_limit: { primary_window: weekly },
    })

    expect(resolved.fiveHourWindow).toBeNull()
    expect(resolved.weeklyWindow).toBe(weekly)
    expect(resolved.unknownWindows).toEqual([])
    expect(
      getVisibleCodexLimitWindows(
        resolved.fiveHourWindow,
        resolved.weeklyWindow
      )
    ).toEqual([{ kind: 'weekly', window: weekly }])
  })

  it('keeps both cards for legacy payloads that still contain both windows', () => {
    const fiveHour = { used_percent: 20, limit_window_seconds: 5 * 60 * 60 }
    const weekly = { used_percent: 40, limit_window_seconds: 7 * 24 * 60 * 60 }
    const resolved = resolveCodexLimitWindows({
      rate_limit: {
        primary_window: fiveHour,
        secondary_window: weekly,
      },
    })

    expect(
      getVisibleCodexLimitWindows(
        resolved.fiveHourWindow,
        resolved.weeklyWindow
      )
    ).toEqual([
      { kind: 'fiveHour', window: fiveHour },
      { kind: 'weekly', window: weekly },
    ])
  })

  it('does not render placeholder cards for absent or empty windows', () => {
    expect(getVisibleCodexLimitWindows(null, undefined)).toEqual([])
    expect(getVisibleCodexLimitWindows({}, {})).toEqual([])
  })

  it('keeps durationless or unknown windows visible without inventing a name', () => {
    for (const window of [
      { used_percent: 0 },
      { used_percent: 10, limit_window_seconds: 60 * 60 },
      { used_percent: 20, limit_window_seconds: 12 * 60 * 60 },
    ]) {
      const resolved = resolveCodexLimitWindows({
        rate_limit: { primary_window: window },
      })
      expect(resolved.fiveHourWindow).toBeNull()
      expect(resolved.weeklyWindow).toBeNull()
      expect(resolved.unknownWindows).toEqual([window])
      expect(
        getVisibleCodexLimitWindows(
          resolved.fiveHourWindow,
          resolved.weeklyWindow,
          resolved.unknownWindows
        )
      ).toEqual([{ kind: 'unknown', window }])
    }
  })

  it('recognizes a near-weekly upstream duration as weekly', () => {
    const weekly = {
      used_percent: 25,
      limit_window_seconds: 7 * 24 * 60 * 60 - 60,
    }
    expect(
      resolveCodexLimitWindows({
        rate_limit: { secondary_window: weekly },
      })
    ).toEqual({
      fiveHourWindow: null,
      weeklyWindow: weekly,
      unknownWindows: [],
    })
  })

  it('does not expose a five-hour window for free plans', () => {
    expect(
      resolveCodexLimitWindows({
        plan_type: 'free',
        rate_limit: {
          primary_window: {
            used_percent: 64,
            limit_window_seconds: 5 * 60 * 60,
          },
        },
      })
    ).toEqual({
      fiveHourWindow: null,
      weeklyWindow: null,
      unknownWindows: [],
    })
  })
})
