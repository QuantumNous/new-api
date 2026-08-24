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
import { isNewAccount } from './new-account'
import {
  hasSeenWelcomeNotice,
  markWelcomeNoticeSeen,
} from './welcome-notice-persistence'

const USER_A = 101
const USER_B = 202

const originalWindow = globalThis.window

function installWindowStorage(overrides?: {
  getItem?: (key: string) => string | null
  setItem?: (key: string, value: string) => void
}) {
  const values = new Map<string, string>()
  const localStorage = {
    getItem: overrides?.getItem ?? ((key: string) => values.get(key) ?? null),
    removeItem: (key: string) => {
      values.delete(key)
    },
    setItem:
      overrides?.setItem ??
      ((key: string, value: string) => {
        values.set(key, value)
      }),
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

describe('welcome notice persistence', () => {
  test('unseen before the banner has ever rendered', () => {
    expect(hasSeenWelcomeNotice(USER_A)).toBe(false)
  })

  test('marking it seen hides it from then on', () => {
    markWelcomeNoticeSeen(USER_A)
    expect(hasSeenWelcomeNotice(USER_A)).toBe(true)
  })

  test('the flag is scoped per user on a shared browser', () => {
    markWelcomeNoticeSeen(USER_A)
    expect(hasSeenWelcomeNotice(USER_B)).toBe(false)
  })

  test('a missing user id never writes a shared global flag', () => {
    const storage = installWindowStorage()
    markWelcomeNoticeSeen(null)
    markWelcomeNoticeSeen(undefined)
    expect(storage.values.size).toBe(0)
    expect(hasSeenWelcomeNotice(null)).toBe(false)
  })

  test('a throwing storage reads as unseen instead of crashing', () => {
    installWindowStorage({
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('storage disabled')
      },
    })

    expect(() => markWelcomeNoticeSeen(USER_A)).not.toThrow()
    expect(hasSeenWelcomeNotice(USER_A)).toBe(false)
  })
})

describe('new account detection', () => {
  test('a fresh account with no usage counts as new', () => {
    expect(isNewAccount({ used_quota: 0, request_count: 0 })).toBe(true)
  })

  test('missing counters are treated as zero', () => {
    expect(isNewAccount({})).toBe(true)
  })

  test('any consumed quota disqualifies the account', () => {
    expect(isNewAccount({ used_quota: 12, request_count: 0 })).toBe(false)
  })

  test('any request disqualifies the account, even with zero quota spent', () => {
    // A free-tier or errored call bills nothing but still means the user has
    // started; the greeting is no longer their first impression.
    expect(isNewAccount({ used_quota: 0, request_count: 3 })).toBe(false)
  })

  test('a signed-out user is not a new account', () => {
    expect(isNewAccount(null)).toBe(false)
    expect(isNewAccount(undefined)).toBe(false)
  })

  test('non-numeric counters do not read as zero usage', () => {
    // The store hydrates from localStorage, so a corrupted payload can hand
    // back strings; guessing "new" there would replay the banner forever.
    expect(
      isNewAccount({
        used_quota: '0' as unknown as number,
        request_count: 0,
      })
    ).toBe(false)
  })
})
