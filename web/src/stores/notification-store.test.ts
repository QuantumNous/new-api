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
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'

// Minimal in-memory localStorage so the persist middleware has real storage.
// Installed before the store is imported, because zustand rehydrates from
// storage when the store is created and its default storage reads
// window.localStorage.
const memoryStore = new Map<string, string>()
const storage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStore.set(key, value)
  },
  removeItem: (key: string) => {
    memoryStore.delete(key)
  },
  clear: () => {
    memoryStore.clear()
  },
  key: (index: number) => [...memoryStore.keys()][index] ?? null,
  get length() {
    return memoryStore.size
  },
} as Storage
;(globalThis as { localStorage?: Storage }).localStorage = storage
;(globalThis as { window?: { localStorage: Storage } }).window = {
  localStorage: storage,
}

const { useNotificationStore } = await import('./notification-store')

beforeEach(() => {
  memoryStore.clear()
  useNotificationStore.setState({ closedUntilDate: null })
})

afterEach(() => {
  useNotificationStore.setState({ closedUntilDate: null })
})

describe('notification store notice dismissal', () => {
  test('isNoticeClosed is false when the notice was never dismissed', () => {
    assert.equal(useNotificationStore.getState().isNoticeClosed(), false)
  })

  test('close today suppresses the notice for the current day', () => {
    const today = new Date().toDateString()
    useNotificationStore.getState().setClosedUntilDate(today)
    assert.equal(useNotificationStore.getState().isNoticeClosed(), true)
  })

  test('a dismissal from a previous day no longer suppresses the notice', () => {
    useNotificationStore.getState().setClosedUntilDate('Mon Jan 01 2001')
    assert.equal(useNotificationStore.getState().isNoticeClosed(), false)
  })

  test('the dismissal date persists to storage so it survives a reload', () => {
    const today = new Date().toDateString()
    useNotificationStore.getState().setClosedUntilDate(today)

    const persisted = JSON.parse(memoryStore.get('notification-storage') ?? '{}')
    assert.equal(persisted.state.closedUntilDate, today)
  })
})
