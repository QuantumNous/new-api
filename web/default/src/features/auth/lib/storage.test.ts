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
import { isRecallClaimAnalyticsBlocked } from '@/lib/analytics/recall-claim'
import * as authStorage from './storage'
import { consumePendingOnboarding, setPendingOnboarding } from './storage'

const originalWindow = globalThis.window

function installWindowStorage() {
  const localValues = new Map<string, string>()
  const sessionValues = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => localValues.get(key) ?? null,
    removeItem: (key: string) => {
      localValues.delete(key)
    },
    setItem: (key: string, value: string) => {
      localValues.set(key, value)
    },
    values: localValues,
  }
  const sessionStorage = {
    getItem: (key: string) => sessionValues.get(key) ?? null,
    removeItem: (key: string) => {
      sessionValues.delete(key)
    },
    setItem: (key: string, value: string) => {
      sessionValues.set(key, value)
    },
    values: sessionValues,
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
    },
  })
  return { localStorage, sessionStorage }
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
    const { localStorage } = installWindowStorage()
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

describe('recall claim auth URL isolation', () => {
  test('moves a nested recall redirect out of the address bar without losing it', () => {
    expect(typeof authStorage.scrubRecallClaimFromAuthURL).toBe('function')

    const redirect = '/console/topup?recall_claim=signed-secret'
    const result = authStorage.scrubRecallClaimFromAuthURL?.(
      `https://console.example.com/sign-in?redirect=${encodeURIComponent(redirect)}&lng=zh`,
      'flow-nonce'
    )

    expect(result).toEqual({
      postLoginRedirect: redirect,
      sanitizedURL:
        'https://console.example.com/sign-in?redirect=%2Fconsole%2Ftopup&recall_redirect=flow-nonce&lng=zh',
    })
  })

  test('moves a direct auth recall claim into the wallet redirect', () => {
    expect(typeof authStorage.scrubRecallClaimFromAuthURL).toBe('function')

    const result = authStorage.scrubRecallClaimFromAuthURL?.(
      'https://console.example.com/sign-up?recall_claim=signed-secret&lng=en',
      'flow-nonce'
    )

    expect(result).toEqual({
      postLoginRedirect: '/console/topup?recall_claim=signed-secret',
      sanitizedURL:
        'https://console.example.com/sign-up?redirect=%2Fconsole%2Ftopup&recall_redirect=flow-nonce&lng=en',
    })
  })

  test('leaves ordinary authentication URLs unchanged', () => {
    expect(typeof authStorage.scrubRecallClaimFromAuthURL).toBe('function')
    expect(
      authStorage.scrubRecallClaimFromAuthURL?.(
        'https://console.example.com/sign-in?redirect=%2Fkeys&lng=zh'
      )
    ).toBe(null)
  })

  test('fails closed and removes over-depth nested claims from the visible URL', () => {
    let redirect = '/console/topup?recall_claim=signed-secret'
    for (let depth = 0; depth < 4; depth += 1) {
      redirect = `/sign-in?redirect=${encodeURIComponent(redirect)}`
    }

    const result = authStorage.scrubRecallClaimFromAuthURL(
      `https://console.example.com${redirect}`,
      'flow-nonce'
    )

    expect(result?.postLoginRedirect).toBeTruthy()
    expect(result?.sanitizedURL).not.toContain('signed-secret')
  })

  test('replaces auth history with the scrubbed URL and keeps the claim tab-scoped', () => {
    const values = new Map<string, string>()
    let replacedHref = ''
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        history: {
          state: { key: 'auth' },
          replaceState: (_state: unknown, _title: string, href: string) => {
            replacedHref = href
          },
        },
        sessionStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          removeItem: (key: string) => values.delete(key),
          setItem: (key: string, value: string) => values.set(key, value),
        },
      },
    })

    const sanitizedHref = authStorage.protectRecallClaimOnAuthRoute(
      '/sign-in?redirect=%2Fconsole%2Ftopup%3Frecall_claim%3Dsigned-secret'
    )

    const protectedURL = new URL(sanitizedHref!, 'https://console.example.com')
    const nonce = protectedURL.searchParams.get('recall_redirect')
    expect(protectedURL.pathname).toBe('/sign-in')
    expect(protectedURL.searchParams.get('redirect')).toBe('/console/topup')
    expect(nonce).toBeTruthy()
    expect(nonce).not.toBe('1')
    expect(replacedHref).toBe(sanitizedHref)
    expect(
      authStorage.resolvePendingPostLoginRedirect('/console/topup', nonce)
    ).toBe('/console/topup?recall_claim=signed-secret')
  })

  test('keeps analytics blocked after the address bar has been scrubbed', () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )

    expect(
      isRecallClaimAnalyticsBlocked(
        `/sign-in?redirect=${encodeURIComponent(protectedRedirect?.sanitizedTarget || '')}&recall_redirect=${protectedRedirect?.nonce}`
      )
    ).toBe(true)

    authStorage.consumePendingPostLoginRedirect?.(protectedRedirect?.nonce)
    expect(isRecallClaimAnalyticsBlocked('/sign-in')).toBe(false)
  })

  test('cleans an expired pending claim instead of blocking analytics indefinitely', () => {
    const { sessionStorage } = installWindowStorage()
    sessionStorage.setItem(
      'auth_post_login_redirect',
      JSON.stringify({
        nonce: 'expired-flow',
        rawTarget: '/console/topup?recall_claim=expired-secret',
        sanitizedTarget: '/console/topup',
        createdAt: Date.now() - 31 * 60 * 1000,
      })
    )
    sessionStorage.setItem('auth_oauth_redirect_nonce', 'expired-flow')

    expect(isRecallClaimAnalyticsBlocked('/sign-in')).toBe(false)
    expect(sessionStorage.getItem('auth_post_login_redirect')).toBe(null)
    expect(sessionStorage.getItem('auth_oauth_redirect_nonce')).toBe(null)
  })

  test('cleans a malformed pending claim instead of blocking analytics indefinitely', () => {
    const { sessionStorage } = installWindowStorage()
    sessionStorage.setItem('auth_post_login_redirect', '{malformed')
    sessionStorage.setItem('auth_oauth_redirect_nonce', 'malformed-flow')

    expect(isRecallClaimAnalyticsBlocked('/sign-in')).toBe(false)
    expect(sessionStorage.getItem('auth_post_login_redirect')).toBe(null)
    expect(sessionStorage.getItem('auth_oauth_redirect_nonce')).toBe(null)
  })

  test('builds a nonce-bound continuation search for multi-step auth', () => {
    const buildAuthContinuationSearch = (
      authStorage as unknown as {
        buildAuthContinuationSearch?: (
          visibleRedirect?: string | null,
          recallRedirectNonce?: string | null
        ) => { redirect: string; recall_redirect?: string } | undefined
      }
    ).buildAuthContinuationSearch

    expect(typeof buildAuthContinuationSearch).toBe('function')
    expect(
      buildAuthContinuationSearch?.('/console/topup', 'flow-nonce')
    ).toEqual({
      redirect: '/console/topup',
      recall_redirect: 'flow-nonce',
    })
    expect(buildAuthContinuationSearch?.('/keys')).toEqual({
      redirect: '/keys',
    })
    expect(
      buildAuthContinuationSearch?.('//attacker.example', 'flow-nonce')
    ).toBe(undefined)
  })

  test('uses a different nonce for each protected recall flow', () => {
    expect(typeof authStorage.protectRecallClaimRedirectForAuth).toBe(
      'function'
    )
    installWindowStorage()

    const first = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=first'
    )
    const second = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=second'
    )

    expect(first?.sanitizedTarget).toBe('/console/topup')
    expect(second?.sanitizedTarget).toBe('/console/topup')
    expect(first?.nonce).toBeTruthy()
    expect(second?.nonce).toBeTruthy()
    expect(first?.nonce).not.toBe(second?.nonce)
    expect(first?.nonce).not.toBe('1')
  })

  test('peeks idempotently only when nonce, target, and TTL all match', () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret&show_history=true'
    )

    const first = authStorage.resolvePendingPostLoginRedirect(
      protectedRedirect?.sanitizedTarget,
      protectedRedirect?.nonce
    )
    const second = authStorage.resolvePendingPostLoginRedirect(
      protectedRedirect?.sanitizedTarget,
      protectedRedirect?.nonce
    )

    expect(first).toBe(
      '/console/topup?recall_claim=signed-secret&show_history=true'
    )
    expect(second).toBe(first)
  })

  test('fails closed and clears the record when nonce or target mismatches', () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )

    expect(
      authStorage.resolvePendingPostLoginRedirect(
        protectedRedirect?.sanitizedTarget,
        'wrong-nonce'
      )
    ).toBe('/console/topup')
    expect(
      authStorage.resolvePendingPostLoginRedirect(
        protectedRedirect?.sanitizedTarget,
        protectedRedirect?.nonce
      )
    ).toBe('/console/topup')

    const next = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=next-secret'
    )
    expect(
      authStorage.resolvePendingPostLoginRedirect('/dashboard', next?.nonce)
    ).toBe('/dashboard')
    expect(
      authStorage.resolvePendingPostLoginRedirect(
        next?.sanitizedTarget,
        next?.nonce
      )
    ).toBe('/console/topup')
  })

  test('fails closed and clears an expired record', () => {
    const { sessionStorage } = installWindowStorage()
    sessionStorage.setItem(
      'auth_post_login_redirect',
      JSON.stringify({
        nonce: 'expired-flow',
        rawTarget: '/console/topup?recall_claim=expired-secret',
        sanitizedTarget: '/console/topup',
        createdAt: Date.now() - 31 * 60 * 1000,
      })
    )

    expect(
      authStorage.resolvePendingPostLoginRedirect(
        '/console/topup',
        'expired-flow'
      )
    ).toBe('/console/topup')
    expect(sessionStorage.getItem('auth_post_login_redirect')).toBe(null)
  })

  test('consumes a matching record only at an explicit terminal step', () => {
    installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )

    expect(
      authStorage.consumePendingPostLoginRedirect?.(protectedRedirect?.nonce)
    ).toBe(true)
    expect(
      authStorage.resolvePendingPostLoginRedirect(
        protectedRedirect?.sanitizedTarget,
        protectedRedirect?.nonce
      )
    ).toBe('/console/topup')
  })

  test('binds OAuth callback recovery to the active flow nonce', () => {
    const { sessionStorage } = installWindowStorage()
    const protectedRedirect = authStorage.protectRecallClaimRedirectForAuth?.(
      '/console/topup?recall_claim=signed-secret'
    )

    const prepared = authStorage.preparePendingPostLoginRedirectForOAuth?.(
      protectedRedirect?.sanitizedTarget,
      protectedRedirect?.nonce
    )
    const firstPeek = authStorage.peekPendingOAuthPostLoginRedirect?.()
    const secondPeek = authStorage.peekPendingOAuthPostLoginRedirect?.()

    expect(prepared).toEqual({
      nonce: protectedRedirect?.nonce,
      target: '/console/topup?recall_claim=signed-secret',
    })
    expect(firstPeek).toEqual(prepared)
    expect(secondPeek).toEqual(prepared)
    expect(sessionStorage.getItem('auth_oauth_redirect_nonce')).toBe(
      protectedRedirect?.nonce
    )
    expect(sessionStorage.getItem('auth_oauth_redirect_nonce')).not.toContain(
      'signed-secret'
    )
  })
})
