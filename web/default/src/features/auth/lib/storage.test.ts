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
import { afterEach, describe, expect, test } from 'bun:test'
import {
  consumePendingOnboarding,
  setPendingOnboarding,
} from './storage'

const originalWindow = globalThis.window

function installWindowStorage() {
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

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
    },
  })
  return localStorage
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

describe('auth storage onboarding flags', () => {
  test('consumes legacy onboarding exactly once', () => {
    installWindowStorage()

    setPendingOnboarding()

    expect(consumePendingOnboarding()).toBe(true)
    expect(consumePendingOnboarding()).toBe(false)
  })

  test('clears legacy Playground first-run storage without triggering onboarding', () => {
    const localStorage = installWindowStorage()
    localStorage.values.set(
      'pending_playground_first_run',
      JSON.stringify({
        email: 'old-user@example.com',
        username: 'old-user',
        createdAt: Date.now(),
      })
    )

    expect(consumePendingOnboarding()).toBe(false)
    expect(localStorage.getItem('pending_playground_first_run')).toBe(null)
  })
})
