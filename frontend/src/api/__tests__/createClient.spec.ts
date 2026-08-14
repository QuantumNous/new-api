import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from '@/api/createClient'
import { AuthSessionInvalidatedError } from '@/api/authSession'
import type { ApiTransport } from '@/api/transport'
import { ApiError } from '@/api/types'

describe('API client request scope', () => {
  it('forwards PATCH bodies through the transport', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: { updated: true },
    })
    const client = createApiClient({ request } as ApiTransport)

    await expect(
      client.patch('/api/subscription/admin/plans/1', { enabled: false })
    ).resolves.toEqual({ updated: true })
    expect(request).toHaveBeenCalledWith(
      'PATCH',
      '/api/subscription/admin/plans/1',
      { data: { enabled: false } }
    )
  })

  it('rejects nonstandard response envelopes for every endpoint', async () => {
    const endpoints = [
      '/api/next/wallet/topup',
      '/api/user/pay',
      '/api/subscription/epay/pay',
    ]
    for (const url of endpoints) {
      const client = createApiClient({
        request: vi.fn().mockResolvedValue({
          message: 'success',
          data: { checkout_url: `https://pay.test/${url.length}` },
        }),
      } as ApiTransport)
      await expect(client.post(url)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      })
    }
  })

  it.each([null, { success: 'true', data: {} }, { success: true }])(
    'rejects malformed unified envelopes: %j',
    async (envelope) => {
      const client = createApiClient({
        request: vi.fn().mockResolvedValue(envelope),
      } as unknown as ApiTransport)

      await expect(client.get('/api/user/self')).rejects.toMatchObject({
        status: 502,
        code: 'INVALID_RESPONSE',
      })
    }
  )

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

  it('keeps business, unauthorized, network, and malformed responses distinct', async () => {
    const onUnauthorized = vi.fn()
    const businessClient = createApiClient({
      request: vi.fn().mockResolvedValue({
        success: false,
        message: 'quota exhausted',
      }),
    } as ApiTransport)
    await expect(businessClient.get('/api/token/')).rejects.toMatchObject({
      business: true,
      message: 'quota exhausted',
    })

    const unauthorizedClient = createApiClient(
      {
        request: vi
          .fn()
          .mockRejectedValue(new ApiError('Unauthorized', { status: 401 })),
      } as ApiTransport,
      { onUnauthorized }
    )
    await expect(
      unauthorizedClient.get('/api/user/self')
    ).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()

    const networkError = new Error('network unavailable')
    const networkClient = createApiClient({
      request: vi.fn().mockRejectedValue(networkError),
    } as ApiTransport)
    await expect(networkClient.get('/api/user/self')).rejects.toBe(networkError)

    const malformedClient = createApiClient({
      request: vi.fn().mockResolvedValue({ message: 'success', data: {} }),
    } as ApiTransport)
    await expect(malformedClient.get('/api/user/self')).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    })
  })

  it('preserves data returned with business failures', async () => {
    const client = createApiClient({
      request: vi.fn().mockResolvedValue({
        success: false,
        message: 'upstream failed',
        data: { response_time: 523, test_time: 1_725_000_000 },
      }),
    } as ApiTransport)

    await expect(client.get('/api/channel/test/7')).rejects.toMatchObject({
      business: true,
      message: 'upstream failed',
      data: { response_time: 523, test_time: 1_725_000_000 },
    })
  })
})
