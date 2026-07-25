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
import { useAuthStore } from './auth-store'

const originalWindow = globalThis.window

function installWindowStorage() {
  const localValues = new Map<string, string>()
  const sessionValues = new Map<string, string>()
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  })
  const localStorage = storage(localValues)
  const sessionStorage = storage(sessionValues)

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  })
  return { localStorage, sessionStorage }
}

function setPendingRecallRedirect(sessionStorage: {
  setItem: (key: string, value: string) => unknown
}) {
  const record = JSON.stringify({
    nonce: 'oauth-recall-flow',
    rawTarget: '/console/topup?recall_claim=signed-secret',
    sanitizedTarget: '/console/topup',
    createdAt: Date.now(),
  })
  sessionStorage.setItem('auth_post_login_redirect', record)
  sessionStorage.setItem('auth_oauth_redirect_nonce', 'oauth-recall-flow')
  return record
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

describe('auth reset recall redirect lifecycle', () => {
  test('clears pending recall state on ordinary logout/reset', () => {
    const { sessionStorage } = installWindowStorage()
    setPendingRecallRedirect(sessionStorage)

    useAuthStore.getState().auth.reset()

    expect(sessionStorage.getItem('auth_post_login_redirect')).toBe(null)
    expect(sessionStorage.getItem('auth_oauth_redirect_nonce')).toBe(null)
  })

  test('preserves pending recall state only for the OAuth preflight reset', () => {
    const { sessionStorage } = installWindowStorage()
    const record = setPendingRecallRedirect(sessionStorage)

    useAuthStore
      .getState()
      .auth.reset({ preservePendingPostLoginRedirect: true })

    expect(sessionStorage.getItem('auth_post_login_redirect')).toBe(record)
    expect(sessionStorage.getItem('auth_oauth_redirect_nonce')).toBe(
      'oauth-recall-flow'
    )
  })
})
