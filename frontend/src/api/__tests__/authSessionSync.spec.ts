import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  publishAuthSessionEvent,
  subscribeAuthSessionEvents,
} from '@/api/authSessionSync'

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', undefined)
  window.localStorage.clear()
})

describe('cross-tab authentication session sync', () => {
  it('delivers a recent signed-out event with its session id', () => {
    const received: unknown[] = []
    const unsubscribe = subscribeAuthSessionEvents((event) => {
      received.push(event)
    })

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'new-api:auth-session:event',
        newValue: JSON.stringify({
          kind: 'signed_out',
          sid: 'other-session',
          source: 'peer-tab',
          nonce: 'nonce-1',
          timestamp: Date.now(),
        }),
      })
    )

    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      kind: 'signed_out',
      sid: 'other-session',
    })
    unsubscribe()
  })

  it('ignores stale, malformed, and self-authored events', () => {
    const received: unknown[] = []
    const unsubscribe = subscribeAuthSessionEvents((event) => {
      received.push(event)
    })
    const dispatch = (value: unknown) =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'new-api:auth-session:event',
          newValue: JSON.stringify(value),
        })
      )

    dispatch({
      kind: 'authenticated',
      sid: 'session-1',
      source: 'peer-tab',
      nonce: 'nonce-stale',
      timestamp: Date.now() - 60_001,
    })
    dispatch({ kind: 'authenticated' })
    dispatch({
      kind: 'authenticated',
      sid: 'session-1',
      source: 'peer-tab',
      nonce: 'nonce-current',
      timestamp: Date.now(),
    })

    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ nonce: 'nonce-current' })
    unsubscribe()
  })

  it('does not expose an access token through the published event', () => {
    const received: unknown[] = []
    const unsubscribe = subscribeAuthSessionEvents((event) => {
      received.push(event)
    })

    publishAuthSessionEvent('authenticated', 'session-2')

    expect(received).toHaveLength(0)
    unsubscribe()
  })
})
