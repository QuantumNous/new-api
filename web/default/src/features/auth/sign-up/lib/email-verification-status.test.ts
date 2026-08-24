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
import { describe, expect, test } from 'bun:test'
import {
  createEmailVerificationState,
  isVerifiedEmail,
  markEmailSent,
  markEmailVerified,
} from './email-verification-state'
import {
  createEmailVerificationStatusRefresher,
  refreshRegistrationEmailVerificationState,
  startEmailVerificationStatusSync,
} from './email-verification-status'

describe('registration email verification status refresh', () => {
  test('discovers a fresh-tab browser grant before code-less registration', async () => {
    const state = await refreshRegistrationEmailVerificationState(
      createEmailVerificationState(),
      '  user@example.com  ',
      async (email) => {
        expect(email).toBe('user@example.com')
        return { success: true, message: '', data: { verified: true } }
      }
    )

    expect(isVerifiedEmail(state, 'user@example.com')).toBe(true)
  })

  test('clears a stale green state when the browser grant is no longer valid', async () => {
    const verified = markEmailVerified(
      markEmailSent(createEmailVerificationState(), 'user@example.com'),
      'user@example.com'
    )
    const state = await refreshRegistrationEmailVerificationState(
      verified,
      'user@example.com',
      async () => ({
        success: true,
        message: '',
        data: { verified: false },
      })
    )

    expect(isVerifiedEmail(state, 'user@example.com')).toBe(false)
  })

  test('coalesces paired browser events, applies a cooldown, and stops cleanly', async () => {
    let now = 1_000
    let calls = 0
    let finishRefresh: (() => void) | undefined
    const refresher = createEmailVerificationStatusRefresher({
      cooldownMs: 1_000,
      now: () => now,
      refresh: () => {
        calls += 1
        return new Promise<void>((resolve) => {
          finishRefresh = resolve
        })
      },
    })

    const focusRefresh = refresher.refresh()
    const visibilityRefresh = refresher.refresh()
    expect(calls).toBe(1)

    finishRefresh?.()
    await Promise.all([focusRefresh, visibilityRefresh])

    now = 1_500
    await refresher.refresh()
    expect(calls).toBe(1)

    now = 2_000
    const laterRefresh = refresher.refresh()
    expect(calls).toBe(2)
    finishRefresh?.()
    await laterRefresh

    refresher.stop()
    now = 3_000
    await refresher.refresh()
    expect(calls).toBe(2)
  })

  test('refreshes on start and lets completion bypass browser-event cooldown', async () => {
    let now = 1_000
    let calls = 0
    let visible = false
    let focusListener: (() => void) | undefined
    let visibilityListener: (() => void) | undefined
    let completionListener: (() => void) | undefined
    let removedFocusListener: (() => void) | undefined
    let removedVisibilityListener: (() => void) | undefined
    let unsubscribed = false
    let focusRegistrationWindowCalls = 0

    const stop = startEmailVerificationStatusSync({
      cooldownMs: 1_000,
      now: () => now,
      refresh: async () => {
        calls += 1
      },
      subscribe: (listener) => {
        completionListener = listener
        return () => {
          completionListener = undefined
          unsubscribed = true
        }
      },
      addFocusListener: (listener) => {
        focusListener = listener
      },
      removeFocusListener: (listener) => {
        removedFocusListener = listener
      },
      addVisibilityListener: (listener) => {
        visibilityListener = listener
      },
      removeVisibilityListener: (listener) => {
        removedVisibilityListener = listener
      },
      isVisible: () => visible,
      focusRegistrationWindow: () => {
        focusRegistrationWindowCalls += 1
      },
    })

    expect(calls).toBe(1)
    await Promise.resolve()

    completionListener?.()
    expect(focusRegistrationWindowCalls).toBe(1)
    expect(calls).toBe(2)

    focusListener?.()
    expect(calls).toBe(2)

    now = 2_000
    focusListener?.()
    expect(calls).toBe(3)
    await Promise.resolve()

    now = 3_000
    visibilityListener?.()
    expect(calls).toBe(3)
    visible = true
    visibilityListener?.()
    expect(calls).toBe(4)

    stop()
    expect(unsubscribed).toBe(true)
    expect(removedFocusListener).toBe(focusListener)
    expect(removedVisibilityListener).toBe(visibilityListener)
  })

  test('still refreshes when the browser rejects the focus request', () => {
    let calls = 0
    let completionListener: (() => void) | undefined

    startEmailVerificationStatusSync({
      cooldownMs: 1_000,
      now: () => 1_000,
      refresh: async () => {
        calls += 1
      },
      subscribe: (listener) => {
        completionListener = listener
        return () => undefined
      },
      addFocusListener: () => undefined,
      removeFocusListener: () => undefined,
      addVisibilityListener: () => undefined,
      removeVisibilityListener: () => undefined,
      isVisible: () => true,
      focusRegistrationWindow: () => {
        throw new Error('focus denied')
      },
    })

    expect(calls).toBe(1)
    expect(() => completionListener?.()).not.toThrow()
    expect(calls).toBe(2)
  })
})
