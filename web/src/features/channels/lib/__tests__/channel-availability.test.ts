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

import { channelSchema } from '../../types'
import {
  availabilityWindowsError,
  buildAvailabilityWindows,
  MAX_AVAILABILITY_WINDOWS,
  parseAvailabilityWindows,
  type ChannelAvailabilityWindow,
} from '../channel-availability'
import {
  buildSettingJSON,
  CHANNEL_FORM_DEFAULT_VALUES,
  transformChannelToFormDefaults,
} from '../channel-form'

function window(
  overrides: Partial<ChannelAvailabilityWindow> = {}
): ChannelAvailabilityWindow {
  return {
    timezone: 'Asia/Shanghai',
    weekdays: [],
    start: '09:00',
    end: '18:00',
    ...overrides,
  }
}

describe('parseAvailabilityWindows', () => {
  test('returns an empty list when the stored value is not an array', () => {
    expect(parseAvailabilityWindows(undefined)).toEqual([])
    expect(parseAvailabilityWindows({ start: '09:00' })).toEqual([])
  })

  test('drops entries without a valid HH:MM start and end', () => {
    expect(
      parseAvailabilityWindows([
        { timezone: 'UTC', weekdays: [], start: '9:00', end: '18:00' },
        { timezone: 'UTC', weekdays: [], start: '09:00', end: '25:00' },
        { timezone: 'UTC', weekdays: [], start: '08:00', end: '12:00' },
      ])
    ).toEqual([{ timezone: 'UTC', weekdays: [], start: '08:00', end: '12:00' }])
  })

  test('sorts and de-duplicates weekdays and keeps an unknown timezone as typed', () => {
    expect(
      parseAvailabilityWindows([
        { timezone: 'Mars/Base', weekdays: [5, 1, 5, 9], start: '09:00', end: '18:00' },
      ])
    ).toEqual([{ timezone: 'Mars/Base', weekdays: [1, 5], start: '09:00', end: '18:00' }])
  })
})

describe('availabilityWindowsError', () => {
  test('accepts an empty list and a valid window', () => {
    expect(availabilityWindowsError([])).toBeNull()
    expect(availabilityWindowsError([window()])).toBeNull()
  })

  test('reports more windows than the backend accepts', () => {
    const windows = Array.from({ length: MAX_AVAILABILITY_WINDOWS + 1 }, () =>
      window()
    )
    expect(availabilityWindowsError(windows)).toBe(
      'Add at most {{count}} windows'
    )
  })

  test('reports a window whose start equals its end', () => {
    expect(availabilityWindowsError([window({ end: '09:00' })])).toBe(
      'Start and end must differ'
    )
  })

  test('reports an unknown IANA timezone', () => {
    expect(
      availabilityWindowsError([window({ timezone: 'Mars/Base' })])
    ).toBe('Choose a valid IANA timezone')
  })
})

describe('buildAvailabilityWindows', () => {
  test('omits the field so an unchanged channel keeps equivalent JSON', () => {
    expect(buildAvailabilityWindows([])).toBeUndefined()
  })

  test('trims the timezone and sorts weekdays for storage', () => {
    expect(
      buildAvailabilityWindows([
        window({ timezone: ' Asia/Tokyo ', weekdays: [5, 1] }),
      ])
    ).toEqual([
      { timezone: 'Asia/Tokyo', weekdays: [1, 5], start: '09:00', end: '18:00' },
    ])
  })
})

describe('channel setting JSON', () => {
  test('a channel without windows omits the field from the saved setting', () => {
    const setting = buildSettingJSON(CHANNEL_FORM_DEFAULT_VALUES)
    expect(JSON.parse(setting).availability_windows).toBeUndefined()
  })

  test('windows survive save and reload of the channel', () => {
    const windows = [
      { timezone: 'Asia/Shanghai', weekdays: [1, 2], start: '09:00', end: '12:00' },
    ]
    const setting = buildSettingJSON({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      availability_windows: windows,
    })
    expect(JSON.parse(setting).availability_windows).toEqual(windows)

    const channel = channelSchema.parse({
      id: 1,
      name: 'Daytime channel',
      key: '',
      type: 1,
      status: 1,
      created_time: 0,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
      setting,
    })
    expect(transformChannelToFormDefaults(channel).availability_windows).toEqual(
      windows
    )
  })
})
