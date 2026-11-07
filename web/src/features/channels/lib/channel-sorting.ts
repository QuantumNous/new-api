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
import type { ColumnSort } from '@tanstack/react-table'

import type { ChannelSortBy } from '../types'

export const CHANNELS_SORT_STORAGE_KEY = 'channels:sort'

// Written by builds that only offered a "sort by ID" switch. Read once for
// migration and then removed; no new code should write it.
const LEGACY_ID_SORT_STORAGE_KEY = 'channels-id-sort'

const SORTABLE_FIELDS = new Set<ChannelSortBy>([
  'id',
  'name',
  'priority',
  'balance',
  'response_time',
  'test_time',
])

/**
 * Order used when nothing valid is stored or no column is sortable.
 */
export const DEFAULT_CHANNEL_SORT: Readonly<ColumnSort> = {
  id: 'priority',
  desc: true,
}

/**
 * Whether the value names a column the channel list API can sort by.
 *
 * @param value - Candidate value, typically a column id from table state.
 * @returns True when the value is a supported sort field.
 */
export const isChannelSortField = (value: unknown): value is ChannelSortBy => {
  return (
    typeof value === 'string' && SORTABLE_FIELDS.has(value as ChannelSortBy)
  )
}

/**
 * Persists the active channel list sort.
 *
 * @param sort - Active sort field and direction.
 */
export const writeChannelSorting = (sort: ColumnSort) => {
  try {
    if (!isChannelSortField(sort.id)) {
      localStorage.removeItem(CHANNELS_SORT_STORAGE_KEY)
      return
    }
    localStorage.setItem(
      CHANNELS_SORT_STORAGE_KEY,
      JSON.stringify({ id: sort.id, desc: sort.desc })
    )
  } catch {
    // Storage can be unavailable in private mode; sorting still works.
  }
}

const removeLegacySort = () => {
  try {
    localStorage.removeItem(LEGACY_ID_SORT_STORAGE_KEY)
  } catch {
    // Storage can be unavailable; there is nothing to clean up then.
  }
}

/**
 * Loads the channel list sort, migrating the legacy ID switch on first read.
 *
 * Stored data is untrusted: anything unreadable, malformed, or naming an
 * unsupported field falls back to the default priority order.
 *
 * @returns The persisted sort, or the default priority order.
 */
export const loadChannelSorting = (): ColumnSort => {
  try {
    const raw = localStorage.getItem(CHANNELS_SORT_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const { id, desc } = parsed as Record<string, unknown>
        if (isChannelSortField(id) && typeof desc === 'boolean') {
          removeLegacySort()
          return { id, desc }
        }
      }
    }
  } catch {
    // Storage can be unavailable or hold stale data; fall back to defaults.
  }

  try {
    if (localStorage.getItem(LEGACY_ID_SORT_STORAGE_KEY) === 'true') {
      const migrated: ColumnSort = { id: 'id', desc: true }
      writeChannelSorting(migrated)
      removeLegacySort()
      return migrated
    }
  } catch {
    // Ignore and fall through to the default order.
  }

  removeLegacySort()
  return { ...DEFAULT_CHANNEL_SORT }
}
