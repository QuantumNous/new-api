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
import { beforeEach, describe, expect, test } from 'vitest'

import type { ChannelSortBy } from '../../types'
import {
  CHANNELS_SORT_STORAGE_KEY,
  DEFAULT_CHANNEL_SORT,
  loadChannelSorting,
  writeChannelSorting,
} from '../channel-sorting'

const LEGACY_ID_SORT_STORAGE_KEY = 'channels-id-sort'

beforeEach(() => {
  localStorage.clear()
})

describe('channel sort persistence', () => {
  test('round-trips the chosen field and direction', () => {
    writeChannelSorting({ id: 'name', desc: false })

    expect(loadChannelSorting()).toEqual({ id: 'name', desc: false })
    expect(
      JSON.parse(localStorage.getItem(CHANNELS_SORT_STORAGE_KEY) ?? 'null')
    ).toEqual({ id: 'name', desc: false })
  })

  test('migrates the legacy ID switch once and removes it', () => {
    localStorage.setItem(LEGACY_ID_SORT_STORAGE_KEY, 'true')

    expect(loadChannelSorting()).toEqual({ id: 'id', desc: true })
    expect(localStorage.getItem(LEGACY_ID_SORT_STORAGE_KEY)).toBeNull()
    expect(
      JSON.parse(localStorage.getItem(CHANNELS_SORT_STORAGE_KEY) ?? 'null')
    ).toEqual({ id: 'id', desc: true })
  })

  test('drops the legacy key even when nothing valid can be migrated', () => {
    localStorage.setItem(LEGACY_ID_SORT_STORAGE_KEY, 'false')

    expect(loadChannelSorting()).toEqual(DEFAULT_CHANNEL_SORT)
    expect(localStorage.getItem(LEGACY_ID_SORT_STORAGE_KEY)).toBeNull()
  })

  test('defaults to priority order when nothing valid is stored', () => {
    expect(loadChannelSorting()).toEqual(DEFAULT_CHANNEL_SORT)

    localStorage.setItem(CHANNELS_SORT_STORAGE_KEY, '{"id":"name"}')
    expect(loadChannelSorting()).toEqual(DEFAULT_CHANNEL_SORT)

    localStorage.setItem(
      CHANNELS_SORT_STORAGE_KEY,
      JSON.stringify({ id: 'key', desc: true })
    )
    expect(loadChannelSorting()).toEqual(DEFAULT_CHANNEL_SORT)

    // An array left by an older build must not break the page.
    localStorage.setItem(
      CHANNELS_SORT_STORAGE_KEY,
      JSON.stringify([{ id: 'name', desc: true }])
    )
    expect(loadChannelSorting()).toEqual(DEFAULT_CHANNEL_SORT)
  })

  test('clears the stored sort when the field is not sortable', () => {
    writeChannelSorting({ id: 'name', desc: true })
    writeChannelSorting({ id: 'key' as ChannelSortBy, desc: true })

    expect(localStorage.getItem(CHANNELS_SORT_STORAGE_KEY)).toBeNull()
  })
})
