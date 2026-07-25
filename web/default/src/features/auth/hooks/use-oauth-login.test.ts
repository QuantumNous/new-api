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
import * as authStorage from '../lib/storage'
import * as oauthLogin from './use-oauth-login'

const originalWindow = globalThis.window

function installWindowStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  })
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

type OAuthPreflightRunner = (
  resetSession: () => Promise<void>,
  getState: () => Promise<string | null>,
  buildURL: (state: string) => string
) => Promise<string | null>

type TimedOAuthPreflightRunner = (
  resetSession: () => Promise<void>,
  getState: () => Promise<string | null>,
  buildURL: (state: string) => string,
  timeoutMs: number
) => Promise<string | null>

function getPreflightRunner(): OAuthPreflightRunner | undefined {
  return (
    oauthLogin as unknown as {
      runOAuthRedirectPreflight?: OAuthPreflightRunner
    }
  ).runOAuthRedirectPreflight
}

function getTimedPreflightRunner(): TimedOAuthPreflightRunner | undefined {
  return (
    oauthLogin as unknown as {
      runOAuthRedirectPreflightWithTimeout?: TimedOAuthPreflightRunner
    }
  ).runOAuthRedirectPreflightWithTimeout
}

describe('OAuth recall redirect preflight lifecycle', () => {
  test('preserves the bound redirect only after a successful preflight', async () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )
    const runner = getPreflightRunner()

    expect(typeof runner).toBe('function')
    const url = await runner?.(
      async () => undefined,
      async () => 'oauth-state',
      (state) => `https://provider.example/authorize?state=${state}`
    )

    expect(url).toBe('https://provider.example/authorize?state=oauth-state')
    expect(
      authStorage.resolvePendingPostLoginRedirect(
        protectedRedirect?.sanitizedTarget,
        protectedRedirect?.nonce
      )
    ).toBe('/console/topup?recall_claim=signed-secret')
  })

  test('clears the bound redirect when state initialization fails', async () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )
    const runner = getPreflightRunner()

    expect(typeof runner).toBe('function')
    expect(
      await runner?.(
        async () => undefined,
        async () => null,
        () => 'unused'
      )
    ).toBe(null)
    expect(
      authStorage.resolvePendingPostLoginRedirect(
        protectedRedirect?.sanitizedTarget,
        protectedRedirect?.nonce
      )
    ).toBe('/console/topup')
  })

  test('clears the bound redirect when preflight throws', async () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )
    const runner = getPreflightRunner()

    expect(typeof runner).toBe('function')
    await expect(
      runner?.(
        async () => undefined,
        async () => {
          throw new Error('state failed')
        },
        () => 'unused'
      )
    ).rejects.toThrow('state failed')
    expect(
      authStorage.resolvePendingPostLoginRedirect(
        protectedRedirect?.sanitizedTarget,
        protectedRedirect?.nonce
      )
    ).toBe('/console/topup')
  })

  test('clears the bound redirect when GitHub preflight times out', async () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )
    const runner = getTimedPreflightRunner()

    expect(typeof runner).toBe('function')
    await expect(
      runner?.(
        async () => undefined,
        () => new Promise<string | null>(() => undefined),
        () => 'unused',
        1
      )
    ).rejects.toMatchObject({ name: 'OAuthRedirectPreflightTimeoutError' })
    expect(
      authStorage.resolvePendingPostLoginRedirect(
        protectedRedirect?.sanitizedTarget,
        protectedRedirect?.nonce
      )
    ).toBe('/console/topup')
  })

  test('does not build a redirect from OAuth state that resolves after timeout', async () => {
    installWindowStorage()
    let resolveState: ((state: string | null) => void) | undefined
    let buildCount = 0
    const lateState = new Promise<string | null>((resolve) => {
      resolveState = resolve
    })
    const runner = getTimedPreflightRunner()

    expect(typeof runner).toBe('function')
    const preflight = runner?.(
      async () => undefined,
      () => lateState,
      () => {
        buildCount += 1
        return 'https://provider.example/authorize'
      },
      1
    )
    await expect(preflight).rejects.toMatchObject({
      name: 'OAuthRedirectPreflightTimeoutError',
    })

    resolveState?.('late-state')
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(buildCount).toBe(0)
  })
})
