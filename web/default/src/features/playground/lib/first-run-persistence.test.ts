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
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  clearFirstRunDone,
  isFirstRunActive,
  markFirstRunDone,
  markFirstRunStarted,
} from './first-run-persistence'

const USER_A = 101
const USER_B = 202

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
    value: { localStorage },
  })
  return localStorage
}

beforeEach(() => {
  installWindowStorage()
})

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

describe('first-run persistence', () => {
  test('inactive before onboarding has started', () => {
    expect(isFirstRunActive(USER_A)).toBe(false)
  })

  test('started and not done => active', () => {
    markFirstRunStarted(USER_A)
    expect(isFirstRunActive(USER_A)).toBe(true)
  })

  test('done => inactive', () => {
    markFirstRunStarted(USER_A)
    markFirstRunDone(USER_A)
    expect(isFirstRunActive(USER_A)).toBe(false)
  })

  test('clearDone re-activates a previously completed onboarding', () => {
    markFirstRunStarted(USER_A)
    markFirstRunDone(USER_A)
    expect(isFirstRunActive(USER_A)).toBe(false)

    clearFirstRunDone(USER_A)
    expect(isFirstRunActive(USER_A)).toBe(true)
  })

  test('done alone (never started) stays inactive', () => {
    markFirstRunDone(USER_A)
    expect(isFirstRunActive(USER_A)).toBe(false)
  })

  test('state is isolated per user', () => {
    markFirstRunStarted(USER_A)
    markFirstRunStarted(USER_B)

    // User A completes onboarding; user B must be unaffected.
    markFirstRunDone(USER_A)
    expect(isFirstRunActive(USER_A)).toBe(false)
    expect(isFirstRunActive(USER_B)).toBe(true)
  })

  test('no user id => persistence is skipped, never active', () => {
    markFirstRunStarted(undefined)
    expect(isFirstRunActive(undefined)).toBe(false)
    expect(isFirstRunActive(null)).toBe(false)
  })
})
