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
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { STORAGE_KEYS } from '../constants'
import type { Message } from '../types'
import {
  clearUserPlaygroundData,
  clearLocalConversationPriority,
  loadConfig,
  loadConversationId,
  loadLocalConversationPriority,
  loadMessages,
  loadParameterEnabled,
  saveConfig,
  saveConversationId,
  saveLocalConversationPriority,
  saveMessages,
  saveParameterEnabled,
} from './storage'

const originalLocalStorage = globalThis.localStorage

function installLocalStorage() {
  const values = new Map<string, string>()
  const storage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size
    },
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
    value: storage,
  })
  return storage
}

const aliceMessage: Message = {
  key: 'alice-message',
  from: 'user',
  versions: [{ id: 'alice-version', content: 'hello from alice' }],
}

const bobMessage: Message = {
  key: 'bob-message',
  from: 'user',
  versions: [{ id: 'bob-version', content: 'hello from bob' }],
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

describe('Playground user-scoped storage', () => {
  test('does not read legacy unscoped messages', () => {
    localStorage.setItem('playground_messages', JSON.stringify([aliceMessage]))

    expect(loadMessages(10)).toBe(null)
  })

  test('persists migrated media from user-scoped localStorage sessions', () => {
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
    const storageKey = `${STORAGE_KEYS.MESSAGES}:v2:10`
    localStorage.setItem(storageKey, JSON.stringify(legacyMessages))

    const loaded = loadMessages(10)
    const persisted = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as
      | Message[]
      | null

    expect(loaded?.[0]?.generatedMedia).toBeUndefined()
    expect(loaded?.[0]?.versions[0]?.generatedMedia).toEqual([
      { type: 'image', url: 'https://cdn.example/legacy.png' },
    ])
    expect(persisted).toEqual(loaded)
  })

  test('isolates messages and config by user', () => {
    saveMessages(10, [aliceMessage])
    saveMessages(20, [bobMessage])
    saveConfig(10, { model: 'alice-model' })
    saveParameterEnabled(10, { temperature: false })

    expect(loadMessages(10)).toEqual([aliceMessage])
    expect(loadMessages(20)).toEqual([bobMessage])
    expect(loadConfig(10)).toEqual({ model: 'alice-model' })
    expect(loadConfig(20)).toEqual({})
    expect(loadParameterEnabled(10)).toEqual({ temperature: false })
  })

  test('uses versioned keys and persists conversation ids', () => {
    const storage = installLocalStorage()

    saveConversationId(10, 'conversation-a')

    expect(loadConversationId(10)).toBe('conversation-a')
    expect(storage.values.get('playground_conversation:v2:10')).toBe(
      'conversation-a'
    )
    expect(storage.values.has('playground_conversation')).toBe(false)
  })

  test('isolates the local-only media conversation marker by user', () => {
    saveLocalConversationPriority(10, {
      conversationId: 'conversation-a',
      markedAt: 1234,
    })

    expect(loadLocalConversationPriority(10)).toEqual({
      conversationId: 'conversation-a',
      markedAt: 1234,
    })
    expect(loadLocalConversationPriority(20)).toBe(null)

    clearLocalConversationPriority(10)
    expect(loadLocalConversationPriority(10)).toBe(null)
  })

  test('safely handles corrupt user-scoped state', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('playground_messages:v2:10', '{}')
    localStorage.setItem('playground_config:v2:10', '[]')
    localStorage.setItem('playground_parameter_enabled:v2:10', 'null')

    expect(loadMessages(10)).toBe(null)
    expect(loadConfig(10)).toEqual({})
    expect(loadParameterEnabled(10)).toEqual({})
    errorSpy.mockRestore()
  })

  test('clears only the selected user data', () => {
    saveMessages(10, [aliceMessage])
    saveMessages(20, [bobMessage])
    saveConversationId(10, 'conversation-a')

    clearUserPlaygroundData(10)

    expect(loadMessages(10)).toBe(null)
    expect(loadConversationId(10)).toBe(null)
    expect(loadMessages(20)).toEqual([bobMessage])
  })
})
