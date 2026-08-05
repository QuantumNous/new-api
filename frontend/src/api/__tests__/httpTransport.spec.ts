import axios, { type AxiosInstance } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearAuthBundle,
  getAuthBundle,
  setAuthBundle,
} from '@/api/authSession'
import {
  createHttpTransport,
  createPublicHttpTransport,
} from '@/api/httpTransport'
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

function unauthorized() {
  return Object.assign(new Error('Unauthorized'), {
    isAxiosError: true,
    response: { status: 401 },
  })
}

function conflict(code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status: 409, data: { success: false, code } },
  })
}

beforeEach(clearAuthBundle)

describe('HTTP authentication transport', () => {
  it('sends the bearer token and session-bound logout header', async () => {
    setAuthBundle(bundle)
    const request = vi.fn().mockResolvedValue({
      data: { success: true, data: undefined },
    })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await transport.request('POST', '/api/user/auth/logout')

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer old-token',
          'X-Auth-Session': 'session-1',
        }),
      })
    )
  })

  it('refreshes once after a 401 and retries with the rotated bearer token', async () => {
    setAuthBundle(bundle)
    const refreshed = { ...bundle, access_token: 'new-token' }
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValueOnce({
        data: { success: true, data: refreshed },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: { value: 42 } },
      })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(transport.request('GET', '/api/user/self')).resolves.toEqual({
      success: true,
      data: { value: 42 },
    })
    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls[1]?.[0]).toMatchObject({
      url: '/api/user/auth/refresh',
      headers: { 'X-Auth-Session': 'session-1' },
    })
    expect(request.mock.calls[2]?.[0]).toMatchObject({
      headers: { Authorization: 'Bearer new-token' },
    })
    expect(getAuthBundle()?.access_token).toBe('new-token')
    expect(axios.isAxiosError(unauthorized())).toBe(true)
  })

  it('shares one refresh request across concurrent 401 responses', async () => {
    setAuthBundle(bundle)
    const refreshed = { ...bundle, access_token: 'shared-token' }
    let protectedCalls = 0
    let refreshCalls = 0
    let releaseRefresh: (() => void) | undefined
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const request = vi
      .fn()
      .mockImplementation(async ({ url }: { url?: string }) => {
        if (url === '/api/user/auth/refresh') {
          refreshCalls++
          await refreshGate
          return { data: { success: true, data: refreshed } }
        }
        protectedCalls++
        if (protectedCalls <= 2) throw unauthorized()
        return { data: { success: true, data: { ok: true } } }
      })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    const first = transport.request('GET', '/api/user/self')
    const second = transport.request('GET', '/api/data/self')
    await vi.waitFor(() => expect(refreshCalls).toBe(1))
    releaseRefresh?.()

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(refreshCalls).toBe(1)
    expect(protectedCalls).toBe(4)
  })

  it('retries a bounded refresh race before replaying the request', async () => {
    setAuthBundle(bundle)
    const refreshed = { ...bundle, access_token: 'race-winner-token' }
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockRejectedValueOnce(conflict('AUTH_REFRESH_RACE'))
      .mockResolvedValueOnce({ data: { success: true, data: refreshed } })
      .mockResolvedValueOnce({ data: { success: true, data: { ok: true } } })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(transport.request('GET', '/api/user/self')).resolves.toEqual({
      success: true,
      data: { ok: true },
    })
    expect(request).toHaveBeenCalledTimes(4)
    expect(getAuthBundle()?.access_token).toBe('race-winner-token')
  })

  it('recovers a refresh session mismatch without exposing an empty session', async () => {
    setAuthBundle(bundle)
    const replacement = {
      ...bundle,
      access_token: 'replacement-token',
      session: { ...bundle.session, sid: 'session-2' },
    }
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockRejectedValueOnce(conflict('AUTH_SESSION_MISMATCH'))
      .mockResolvedValueOnce({ data: { success: true, data: replacement } })
      .mockResolvedValueOnce({ data: { success: true, data: { ok: true } } })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(transport.request('GET', '/api/user/self')).resolves.toEqual({
      success: true,
      data: { ok: true },
    })
    expect(request.mock.calls[1]?.[0]).toMatchObject({
      headers: { 'X-Auth-Session': 'session-1' },
    })
    expect(request.mock.calls[2]?.[0].headers).toBeUndefined()
    expect(request.mock.calls[3]?.[0]).toMatchObject({
      headers: { Authorization: 'Bearer replacement-token' },
    })
    expect(getAuthBundle()?.session.sid).toBe('session-2')
  })

  it('invalidates mismatch recovery when the cookie belongs to another user', async () => {
    setAuthBundle(bundle)
    const otherUser = {
      ...bundle,
      access_token: 'other-user-token',
      session: { ...bundle.session, sid: 'session-2' },
      user: { ...bundle.user, id: 2, username: 'other' },
    }
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockRejectedValueOnce(conflict('AUTH_SESSION_MISMATCH'))
      .mockResolvedValueOnce({ data: { success: true, data: otherUser } })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(
      transport.request('GET', '/api/user/self')
    ).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_SESSION_INVALIDATED',
    })
    expect(request).toHaveBeenCalledTimes(3)
    expect(getAuthBundle()).toBeNull()
  })

  it('normalizes transient refresh failures without clearing the session', async () => {
    setAuthBundle(bundle)
    const refreshFailure = Object.assign(new Error('Unavailable'), {
      isAxiosError: true,
      response: {
        status: 503,
        data: { success: false, message: 'Authentication unavailable' },
      },
    })
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockRejectedValueOnce(refreshFailure)
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(
      transport.request('GET', '/api/user/self')
    ).rejects.toMatchObject({
      status: 503,
      message: 'Authentication unavailable',
    })
    expect(getAuthBundle()?.access_token).toBe('old-token')
  })

  it('does not let an obsolete refresh overwrite a newer login', async () => {
    setAuthBundle(bundle)
    let releaseRefresh: (() => void) | undefined
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const staleRefresh = { ...bundle, access_token: 'stale-token' }
    const replacement = {
      ...bundle,
      access_token: 'replacement-token',
      session: { ...bundle.session, sid: 'session-2' },
    }
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockImplementationOnce(async () => {
        await refreshGate
        return { data: { success: true, data: staleRefresh } }
      })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    const pending = transport.request('GET', '/api/user/self')
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    setAuthBundle(replacement)
    releaseRefresh?.()

    await expect(pending).rejects.toMatchObject({ status: 409 })
    expect(getAuthBundle()?.access_token).toBe('replacement-token')
  })

  it('rejects a successful response that belongs to an obsolete login', async () => {
    setAuthBundle(bundle)
    let releaseResponse: (() => void) | undefined
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    const replacement = {
      ...bundle,
      access_token: 'replacement-token',
      session: { ...bundle.session, sid: 'session-2' },
    }
    const request = vi.fn().mockImplementation(async () => {
      await responseGate
      return { data: { success: true, data: { owner: 'demo' } } }
    })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    const pending = transport.request('GET', '/api/user/self')
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    setAuthBundle(replacement)
    releaseResponse?.()

    await expect(pending).rejects.toMatchObject({
      status: 409,
      code: 'AUTH_SESSION_CHANGED',
    })
    expect(getAuthBundle()?.access_token).toBe('replacement-token')
  })

  it('does not refresh after the request session was replaced', async () => {
    setAuthBundle(bundle)
    let rejectRequest: (() => void) | undefined
    const requestGate = new Promise<void>((resolve) => {
      rejectRequest = resolve
    })
    const replacement = {
      ...bundle,
      access_token: 'replacement-token',
      session: { ...bundle.session, sid: 'session-2' },
    }
    const request = vi.fn().mockImplementation(async () => {
      await requestGate
      throw unauthorized()
    })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    const pending = transport.request('GET', '/api/user/self')
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    setAuthBundle(replacement)
    rejectRequest?.()

    await expect(pending).rejects.toMatchObject({
      status: 409,
      code: 'AUTH_SESSION_CHANGED',
    })
    expect(request).toHaveBeenCalledOnce()
    expect(getAuthBundle()?.access_token).toBe('replacement-token')
  })

  it('stops mismatch recovery when another login replaces the session', async () => {
    setAuthBundle(bundle)
    const replacement = {
      ...bundle,
      access_token: 'replacement-token',
      session: { ...bundle.session, sid: 'session-2' },
    }
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockImplementationOnce(async () => {
        setAuthBundle(replacement)
        throw conflict('AUTH_SESSION_MISMATCH')
      })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(
      transport.request('GET', '/api/user/self')
    ).rejects.toMatchObject({ status: 409, code: 'AUTH_SESSION_CHANGED' })
    expect(request).toHaveBeenCalledTimes(2)
    expect(getAuthBundle()?.access_token).toBe('replacement-token')
  })

  it('invalidates the active session after a malformed refresh response', async () => {
    setAuthBundle(bundle)
    const request = vi
      .fn()
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValueOnce({
        data: { success: true, data: { invalid: true } },
      })
    const transport = createHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(
      transport.request('GET', '/api/user/self')
    ).rejects.toMatchObject({ status: 401 })
    expect(getAuthBundle()).toBeNull()
  })

  it('keeps public requests free of credentials and refresh side effects', async () => {
    setAuthBundle(bundle)
    const request = vi.fn().mockRejectedValue(unauthorized())
    const transport = createPublicHttpTransport({
      request,
    } as unknown as AxiosInstance)

    await expect(transport.request('GET', '/api/status')).rejects.toMatchObject(
      { status: 401 }
    )
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[0].headers).toBeUndefined()
    expect(getAuthBundle()?.access_token).toBe('old-token')
  })
})
