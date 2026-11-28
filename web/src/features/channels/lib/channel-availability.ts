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

/** Mirrors `MaxChannelAvailabilityWindows` in `model/channel_availability.go`. */
export const MAX_AVAILABILITY_WINDOWS = 16

/**
 * One recurring window in which a channel may serve requests. `start` and
 * `end` are `HH:MM`; an `end` earlier than `start` crosses midnight. Empty
 * `weekdays` means every day, and an empty `timezone` means UTC.
 */
export type ChannelAvailabilityWindow = {
  timezone: string
  weekdays: number[]
  start: string
  end: string
}

/** Monday first, as the editor shows the days. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function createAvailabilityWindow(): ChannelAvailabilityWindow {
  return { timezone: 'Asia/Shanghai', weekdays: [], start: '09:00', end: '18:00' }
}

function isWeekday(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

/** Reads windows from stored channel settings, dropping malformed entries. */
export function parseAvailabilityWindows(value: unknown): ChannelAvailabilityWindow[] {
  if (!Array.isArray(value)) return []
  const windows: ChannelAvailabilityWindow[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const start = typeof record.start === 'string' ? record.start : ''
    const end = typeof record.end === 'string' ? record.end : ''
    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) continue
    const weekdays = Array.isArray(record.weekdays)
      ? [...new Set(record.weekdays.filter(isWeekday))].sort((a, b) => a - b)
      : []
    windows.push({
      timezone: typeof record.timezone === 'string' ? record.timezone : '',
      weekdays,
      start,
      end,
    })
  }
  return windows
}

export function isKnownTimezone(timezone: string): boolean {
  if (!timezone.trim()) return true
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone.trim() })
    return true
  } catch {
    return false
  }
}

/**
 * Returns the translation key of the first problem, or null when the windows
 * can be saved. The backend repeats these checks.
 */
export function availabilityWindowsError(
  windows: ChannelAvailabilityWindow[]
): string | null {
  if (windows.length > MAX_AVAILABILITY_WINDOWS) {
    return 'Add at most {{count}} windows'
  }
  for (const window of windows) {
    if (!TIME_PATTERN.test(window.start) || !TIME_PATTERN.test(window.end)) {
      return 'Enter each start and end as HH:MM'
    }
    if (window.start === window.end) {
      return 'Start and end must differ'
    }
    if (!isKnownTimezone(window.timezone)) {
      return 'Choose a valid IANA timezone'
    }
  }
  return null
}

/**
 * Returns the `availability_windows` value for the `setting` JSON, or
 * `undefined` so an unchanged channel keeps equivalent JSON.
 */
export function buildAvailabilityWindows(
  windows: ChannelAvailabilityWindow[]
): ChannelAvailabilityWindow[] | undefined {
  if (windows.length === 0) return undefined
  return windows.map((window) => ({
    timezone: window.timezone.trim(),
    weekdays: [...window.weekdays].sort((a, b) => a - b),
    start: window.start,
    end: window.end,
  }))
}
