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
import { afterEach, describe, test } from 'node:test'

import {
  getAffiliateCode,
  removeAffiliateCode,
  saveAffiliateCode,
} from './storage'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalDateNow = Date.now

function installLocalStorage() {
  const values = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  })
  return { localStorage, values }
}

afterEach(() => {
  Date.now = originalDateNow
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow)
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
})

describe('affiliate attribution storage', () => {
  test('stores a valid invitation code for seven days and removes the legacy key', () => {
    const { localStorage, values } = installLocalStorage()
    localStorage.setItem('aff', 'LEGACY')
    Date.now = () => 1_000_000

    saveAffiliateCode(' INVITE01 ')

    assert.equal(values.has('aff'), false)
    assert.equal(getAffiliateCode(), 'INVITE01')
    assert.deepEqual(JSON.parse(values.get('aff:v1') ?? ''), {
      code: 'INVITE01',
      captured_at: 1000,
      expires_at: 605_800,
    })
  })

  test('expires and clears attribution after seven days', () => {
    const { values } = installLocalStorage()
    Date.now = () => 1_000_000
    saveAffiliateCode('INVITE01')
    Date.now = () => 605_800_000

    assert.equal(getAffiliateCode(), '')
    assert.equal(values.has('aff:v1'), false)
  })

  test('clears all attribution keys after registration or OAuth login', () => {
    const { localStorage, values } = installLocalStorage()
    localStorage.setItem('aff', 'LEGACY')
    localStorage.setItem('aff:v1', '{}')

    removeAffiliateCode()

    assert.equal(values.size, 0)
  })
})
