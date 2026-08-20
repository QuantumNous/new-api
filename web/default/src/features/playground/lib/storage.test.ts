/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { STORAGE_KEYS } from '../constants'
import type { Message } from '../types'
import { loadMessages } from './storage'

const originalLocalStorage = globalThis.localStorage

function installLocalStorage() {
  const values = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key)
    },
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    values,
  }

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  })
  return localStorage
}

beforeEach(() => {
  installLocalStorage()
})

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: originalLocalStorage,
  })
})

describe('loadMessages', () => {
  test('persists migrated media from legacy localStorage sessions', () => {
    const legacyMessages: Message[] = [
      {
        key: 'assistant-legacy',
        from: 'assistant',
        status: 'complete',
        versions: [{ id: 'version-1', content: 'legacy result' }],
        generatedMedia: [
          { type: 'image', url: 'https://cdn.example/legacy.png' },
        ],
      },
    ]
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(legacyMessages))

    const loaded = loadMessages()
    const persisted = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.MESSAGES) ?? 'null'
    ) as Message[] | null

    expect(loaded?.[0]?.generatedMedia).toBeUndefined()
    expect(loaded?.[0]?.versions[0]?.generatedMedia).toEqual([
      { type: 'image', url: 'https://cdn.example/legacy.png' },
    ])
    expect(persisted).toEqual(loaded)
  })
})
