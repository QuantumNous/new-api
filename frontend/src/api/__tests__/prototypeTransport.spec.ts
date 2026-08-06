import { describe, expect, it } from 'vitest'

import { isPrototypeEndpoint, prototypeRequest } from '@/api/prototypeTransport'

describe('read-only prototype transport', () => {
  it('returns deterministic fixtures only for explicitly supported GET routes', async () => {
    expect(isPrototypeEndpoint('/api/market/catalog')).toBe(true)
    expect(isPrototypeEndpoint('/api/market/catalog/1')).toBe(true)
    expect(isPrototypeEndpoint('/api/user/search')).toBe(true)
    expect(isPrototypeEndpoint('/api/user/self')).toBe(false)

    const response = await prototypeRequest<{ listings: unknown[] }>(
      'GET',
      '/api/market/catalog'
    )
    expect(response.success).toBe(true)
    expect(response.data).toMatchObject({ listings: expect.any(Array) })
  })

  it('rejects every write before a network transport can be reached', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      await expect(
        prototypeRequest(method, '/api/market/listings', {
          data: { title: 'must not be sent' },
        })
      ).rejects.toMatchObject({
        status: 501,
        code: 'PROTOTYPE_READ_ONLY',
      })
    }
  })

  it('fails closed when a fixture route is missing', async () => {
    await expect(
      prototypeRequest('GET', '/api/market/unknown')
    ).rejects.toMatchObject({
      status: 404,
      code: 'PROTOTYPE_FIXTURE_NOT_FOUND',
    })
  })
})
