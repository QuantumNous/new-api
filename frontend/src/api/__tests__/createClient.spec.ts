import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from '@/api/createClient'
import { AuthSessionInvalidatedError } from '@/api/authSession'
import type { ApiTransport } from '@/api/transport'
import { ApiError } from '@/api/types'

describe('API client request scope', () => {
  it('does not deduplicate GET requests across authentication sessions', async () => {
    let scope = 1
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: { ok: true },
    })
    const client = createApiClient({ request } as ApiTransport, {
      getRequestScope: () => scope,
    })

    const first = client.get('/api/user/self')
    scope = 2
    const second = client.get('/api/user/self')

    await expect(first).rejects.toMatchObject({
      status: 409,
      code: 'AUTH_SESSION_CHANGED',
    })
    await expect(second).resolves.toEqual({ ok: true })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not report an obsolete 401 as an unauthorized current session', async () => {
    let scope = 1
    let rejectRequest: ((error: ApiError) => void) | undefined
    const pendingRequest = new Promise<never>((_resolve, reject) => {
      rejectRequest = reject
    })
    const onUnauthorized = vi.fn()
    const client = createApiClient(
      { request: vi.fn().mockReturnValue(pendingRequest) } as ApiTransport,
      { getRequestScope: () => scope, onUnauthorized }
    )

    const pending = client.get('/api/user/self')
    scope = 2
    rejectRequest?.(new ApiError('Unauthorized', { status: 401 }))

    await expect(pending).rejects.toMatchObject({
      status: 409,
      code: 'AUTH_SESSION_CHANGED',
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('reports a conditional refresh invalidation after the scope is cleared', async () => {
    let scope = 1
    const onUnauthorized = vi.fn()
    const request = vi.fn().mockImplementation(async () => {
      scope = 2
      throw new AuthSessionInvalidatedError()
    })
    const client = createApiClient({ request } as ApiTransport, {
      getRequestScope: () => scope,
      onUnauthorized,
    })

    await expect(client.get('/api/user/self')).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_SESSION_INVALIDATED',
    })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
