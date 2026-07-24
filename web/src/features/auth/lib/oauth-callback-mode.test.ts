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
import { describe, test } from 'node:test'

import {
  markOAuthBindPopup,
  resolveOAuthCallbackMode,
} from './oauth-callback-mode'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    snapshot: () => Object.fromEntries(data),
  }
}

const openOpener = { closed: false }

describe('resolveOAuthCallbackMode', () => {
  test('bind popup we opened is treated as a bind flow', () => {
    const storage = fakeStorage()
    markOAuthBindPopup(storage, 'oidc')

    assert.equal(
      resolveOAuthCallbackMode('oidc', { opener: openOpener, storage }),
      'bind'
    )
  })

  // Regression: a tab opened from an external link (Slack, e-mail, another
  // site) keeps a live window.opener across the cross-origin round trip to the
  // identity provider. Treating that opener as proof of a bind flow made every
  // such login hang on the binding screen until the 30s handshake deadline.
  test('login redirect in a tab with a foreign opener stays a login flow', () => {
    const storage = fakeStorage()

    assert.equal(
      resolveOAuthCallbackMode('oidc', { opener: openOpener, storage }),
      'login'
    )
  })

  test('bind marker for another provider does not hijack this callback', () => {
    const storage = fakeStorage()
    markOAuthBindPopup(storage, 'github')

    assert.equal(
      resolveOAuthCallbackMode('oidc', { opener: openOpener, storage }),
      'login'
    )
  })

  test('bind marker without an opener falls back to login', () => {
    const storage = fakeStorage()
    markOAuthBindPopup(storage, 'oidc')

    assert.equal(
      resolveOAuthCallbackMode('oidc', { opener: null, storage }),
      'login'
    )
  })

  test('closed opener falls back to login', () => {
    const storage = fakeStorage()
    markOAuthBindPopup(storage, 'oidc')

    assert.equal(
      resolveOAuthCallbackMode('oidc', {
        opener: { closed: true },
        storage,
      }),
      'login'
    )
  })

  test('missing storage degrades to login instead of throwing', () => {
    assert.equal(
      resolveOAuthCallbackMode('oidc', { opener: openOpener, storage: null }),
      'login'
    )
  })
})
