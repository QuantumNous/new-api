import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyAuthRotation,
  clearAuthBundle,
  clearAuthBundleIfCurrent,
  getAuthBundle,
  getAuthSessionGeneration,
  getAuthSessionSnapshot,
  parseAuthBundle,
  parseAuthRotation,
  parseTwoFactorChallenge,
  replaceAuthBundleIfCurrent,
  setAuthBundle,
  setAuthBundleIfCurrent,
} from '@/api/authSession'
import type { AuthBundle } from '@/types/auth'

const bundle: AuthBundle = {
  access_token: 'access-token',
  token_type: 'Bearer',
  access_expires_at: 2_000_000_000,
  session: {
    sid: 'session-1',
    current: true,
    login_method: 'password',
    ip: '127.0.0.1',
    user_agent: 'vitest',
    created_at: 1,
    last_active_at: 2,
    expires_at: 2_000_000_000,
  },
  user: {
    id: 1,
    username: 'demo',
    display_name: 'Demo',
    email: 'demo@example.com',
    role: 10,
    quota: 100,
    used_quota: 5,
  },
}

beforeEach(clearAuthBundle)

describe('authentication response boundary', () => {
  it('accepts complete bundles and rejects malformed token responses', () => {
    expect(parseAuthBundle(bundle)).toEqual(bundle)
    expect(parseAuthBundle({ ...bundle, token_type: 'Basic' })).toBeNull()
    expect(
      parseAuthBundle({ ...bundle, session: { ...bundle.session, sid: '' } })
    ).toBeNull()
    expect(parseAuthRotation(bundle)).toMatchObject({
      access_token: 'access-token',
      session: { sid: 'session-1' },
    })
  })

  it('parses only complete two-factor challenges', () => {
    expect(
      parseTwoFactorChallenge({
        require_2fa: true,
        flow_token: 'flow-1',
        expires_at: 2_000_000_000,
      })
    ).toMatchObject({ flow_token: 'flow-1' })
    expect(
      parseTwoFactorChallenge({ require_2fa: true, flow_token: '' })
    ).toBeNull()
    expect(
      parseTwoFactorChallenge({
        require_2fa: true,
        flow_token: 'flow-1',
        expires_at: 0,
      })
    ).toBeNull()
  })

  it('rotates tokens only inside the active session', () => {
    setAuthBundle(bundle)
    const generation = getAuthSessionGeneration()
    applyAuthRotation({
      ...bundle,
      access_token: 'rotated-token',
    })
    expect(getAuthBundle()?.access_token).toBe('rotated-token')
    expect(getAuthSessionGeneration()).toBe(generation)

    expect(() =>
      applyAuthRotation({
        ...bundle,
        session: { ...bundle.session, sid: 'other-session' },
      })
    ).toThrow('session mismatch')
  })

  it('rejects stale conditional session updates', () => {
    setAuthBundle(bundle)
    const stale = getAuthSessionSnapshot()
    const replacement = {
      ...bundle,
      access_token: 'replacement-token',
      session: { ...bundle.session, sid: 'session-2' },
    }
    setAuthBundle(replacement)

    expect(
      setAuthBundleIfCurrent(stale, {
        ...bundle,
        access_token: 'stale-token',
      })
    ).toBe(false)
    expect(clearAuthBundleIfCurrent(stale)).toBe(false)
    expect(getAuthBundle()?.access_token).toBe('replacement-token')
  })

  it('advances the identity generation only when the session identity changes', () => {
    const anonymousGeneration = getAuthSessionGeneration()
    setAuthBundle(bundle)
    const authenticatedGeneration = getAuthSessionGeneration()
    expect(authenticatedGeneration).toBeGreaterThan(anonymousGeneration)

    const current = getAuthSessionSnapshot()
    expect(
      setAuthBundleIfCurrent(current, {
        ...bundle,
        access_token: 'refreshed-token',
      })
    ).toBe(true)
    expect(getAuthSessionGeneration()).toBe(authenticatedGeneration)

    clearAuthBundle()
    expect(getAuthSessionGeneration()).toBeGreaterThan(authenticatedGeneration)
  })

  it('accepts a bundle only for the unchanged cold-start snapshot', () => {
    const coldStart = getAuthSessionSnapshot()
    expect(setAuthBundleIfCurrent(coldStart, bundle)).toBe(true)
    expect(setAuthBundleIfCurrent(coldStart, bundle)).toBe(false)
  })

  it('conditionally replaces a mismatched session only from a current snapshot', () => {
    setAuthBundle(bundle)
    const current = getAuthSessionSnapshot()
    const replacement = {
      ...bundle,
      session: { ...bundle.session, sid: 'session-2' },
    }

    expect(setAuthBundleIfCurrent(current, replacement)).toBe(false)
    expect(replaceAuthBundleIfCurrent(current, replacement)).toBe(true)
    expect(replaceAuthBundleIfCurrent(current, bundle)).toBe(false)
    expect(getAuthBundle()?.session.sid).toBe('session-2')
  })

  it('keeps the identity generation stable when only the session id changes', () => {
    setAuthBundle(bundle)
    const generation = getAuthSessionGeneration()
    const current = getAuthSessionSnapshot()

    expect(
      replaceAuthBundleIfCurrent(current, {
        ...bundle,
        session: { ...bundle.session, sid: 'session-2' },
      })
    ).toBe(true)
    expect(getAuthSessionGeneration()).toBe(generation)
  })
})
