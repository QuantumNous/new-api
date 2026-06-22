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
  consumePendingPlaygroundFirstRun,
  setPendingOnboarding,
  setPendingPlaygroundFirstRun,
} from './storage'

const originalWindow = globalThis.window
const originalDateNow = Date.now
const pendingPlaygroundFirstRunKey = 'pending_playground_first_run'

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
  Date.now = originalDateNow
})

describe('auth storage onboarding flags', () => {
  test('consumes Playground first-run exactly once', () => {
    installWindowStorage()

    setPendingPlaygroundFirstRun({
      email: 'new-user@example.com',
      username: 'new-user',
    })

    expect(
      consumePendingPlaygroundFirstRun({
        email: 'New-User@Example.com',
        username: 'new-user',
      })
    ).toBe(true)
    expect(
      consumePendingPlaygroundFirstRun({
        email: 'new-user@example.com',
        username: 'new-user',
      })
    ).toBe(false)
  })

  test('keeps Playground first-run independent from legacy onboarding', () => {
    installWindowStorage()

    setPendingOnboarding()

    expect(
      consumePendingPlaygroundFirstRun({
        email: 'new-user@example.com',
        username: 'new-user',
      })
    ).toBe(false)
    expect(consumePendingOnboarding()).toBe(true)
  })

  test('does not consume Playground first-run for a different account', () => {
    installWindowStorage()

    setPendingPlaygroundFirstRun({
      email: 'new-user@example.com',
      username: 'new-user',
    })

    expect(
      consumePendingPlaygroundFirstRun({
        email: 'existing@example.com',
        username: 'existing-user',
      })
    ).toBe(false)
    expect(
      consumePendingPlaygroundFirstRun({
        email: 'new-user@example.com',
        username: 'new-user',
      })
    ).toBe(true)
  })

  test('does not consume Playground first-run when stored identifiers conflict', () => {
    installWindowStorage()

    setPendingPlaygroundFirstRun({
      email: 'new-user@example.com',
      username: 'new-user',
    })

    expect(
      consumePendingPlaygroundFirstRun({
        email: 'other@example.com',
        username: 'new-user',
      })
    ).toBe(false)
    expect(
      consumePendingPlaygroundFirstRun({
        email: 'new-user@example.com',
        username: 'new-user',
      })
    ).toBe(true)
  })

  test('drops expired Playground first-run state', () => {
    installWindowStorage()
    Date.now = () => 1_000

    setPendingPlaygroundFirstRun({
      email: 'new-user@example.com',
      username: 'new-user',
    })

    Date.now = () => 8 * 24 * 60 * 60 * 1000 + 1_000

    expect(
      consumePendingPlaygroundFirstRun({
        email: 'new-user@example.com',
        username: 'new-user',
      })
    ).toBe(false)
  })

  test('drops future-dated Playground first-run state', () => {
    installWindowStorage()
    Date.now = () => 10_000

    setPendingPlaygroundFirstRun({
      email: 'new-user@example.com',
      username: 'new-user',
    })

    Date.now = () => 1_000

    expect(
      consumePendingPlaygroundFirstRun({
        email: 'new-user@example.com',
        username: 'new-user',
      })
    ).toBe(false)
  })

  test('clears invalid Playground first-run state', () => {
    const localStorage = installWindowStorage()
    localStorage.values.set(pendingPlaygroundFirstRunKey, '{not-json')

    expect(
      consumePendingPlaygroundFirstRun({
        email: 'new-user@example.com',
        username: 'new-user',
      })
    ).toBe(false)
    expect(localStorage.getItem(pendingPlaygroundFirstRunKey)).toBe(null)
  })
})
