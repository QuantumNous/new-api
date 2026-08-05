import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authApi } from '@/api/auth'
import { api } from '@/api/client'
import {
  clearAuthBundle,
  getAuthBundle,
  setAuthBundle,
} from '@/api/authSession'
import { ApiError } from '@/api/types'
import type { AuthBundle } from '@/types/auth'

const bundle: AuthBundle = {
  access_token: 'old-token',
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
afterEach(() => vi.restoreAllMocks())

describe('authentication API', () => {
  it('recovers a session mismatch before retrying logout', async () => {
    setAuthBundle(bundle)
    const replacement = {
      ...bundle,
      access_token: 'replacement-token',
      session: { ...bundle.session, sid: 'session-2' },
    }
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(
        new ApiError('Session mismatch', {
          status: 409,
          code: 'AUTH_SESSION_MISMATCH',
        })
      )
      .mockResolvedValueOnce(replacement)
      .mockResolvedValueOnce(undefined)

    await authApi.logout()

    expect(post.mock.calls.map(([url]) => url)).toEqual([
      '/api/user/auth/logout',
      '/api/user/auth/refresh',
      '/api/user/auth/logout',
    ])
    expect(getAuthBundle()?.session.sid).toBe('session-2')
  })
})
