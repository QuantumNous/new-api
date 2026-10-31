import { describe, expect, it, vi } from 'vitest'
import {
  createCsrfMiddleware,
  csrfSymbol,
  getCsrfRequestValidationResult,
  isCsrfRequestAllowed,
} from '@tanstack/start-client-core'
import type { RequestServerOptions } from '@tanstack/start-client-core'
import type { Register } from '@tanstack/router-core'

const requestOrigin = 'https://app.example.com'

function trackHeaders(init: Record<string, string>) {
  const headers = new Map(
    Object.entries(init).map(([key, value]) => [key.toLowerCase(), value]),
  )
  const reads: Array<string> = []

  return {
    reads,
    request: {
      url: `${requestOrigin}/_serverFn/test`,
      headers: {
        get(name: string) {
          reads.push(name)
          return headers.get(name.toLowerCase()) ?? null
        },
      },
    } as Request,
  }
}

function createContext(init: {
  headers?: Record<string, string>
  handlerType?: 'serverFn' | 'router'
  origin?: string
}): RequestServerOptions<Register, undefined> {
  const { request } = trackHeaders(init.headers ?? {})
  return {
    request,
    pathname: new URL(request.url).pathname,
    context: undefined,
    next: (() => undefined) as any,
    handlerType: init.handlerType ?? 'serverFn',
  }
}

async function runMiddleware(
  middleware: ReturnType<typeof createCsrfMiddleware>,
  ctx: RequestServerOptions<Register, undefined>,
) {
  const next = vi.fn(() => ({ request: ctx.request, pathname: ctx.pathname }))
  const result = await middleware.options.server!({
    ...ctx,
    next,
  } as any)
  return { result, next }
}

describe('getCsrfRequestValidationResult', () => {
  it('allows same-origin fetch metadata without reading Origin or Referer', async () => {
    const { request, reads } = trackHeaders({
      'Sec-Fetch-Site': 'same-origin',
      Origin: 'https://evil.example.com',
      Referer: 'https://evil.example.com/path',
    })

    await expect(
      getCsrfRequestValidationResult({}, createContextFromRequest(request)),
    ).resolves.toBe(true)
    expect(reads).toEqual(['Sec-Fetch-Site'])
  })

  it.each(['same-site', 'cross-site', 'none', 'invalid'])(
    'rejects %s fetch metadata',
    async (fetchSite) => {
      const ctx = createContext({
        headers: {
          'Sec-Fetch-Site': fetchSite,
          Origin: requestOrigin,
          Referer: `${requestOrigin}/path`,
        },
      })

      await expect(getCsrfRequestValidationResult({}, ctx)).resolves.toBe(false)
    },
  )

  it('allows matching Origin without reading Referer', async () => {
    const { request, reads } = trackHeaders({
      Origin: requestOrigin,
      Referer: 'https://evil.example.com/path',
    })

    await expect(
      getCsrfRequestValidationResult({}, createContextFromRequest(request)),
    ).resolves.toBe(true)
    expect(reads).toEqual(['Sec-Fetch-Site', 'Origin'])
  })

  it('rejects mismatched Origin without reading Referer', async () => {
    const { request, reads } = trackHeaders({
      Origin: 'https://evil.example.com',
      Referer: `${requestOrigin}/path`,
    })

    await expect(
      getCsrfRequestValidationResult({}, createContextFromRequest(request)),
    ).resolves.toBe(false)
    expect(reads).toEqual(['Sec-Fetch-Site', 'Origin'])
  })

  it.each([
    requestOrigin,
    `${requestOrigin}/path`,
    `${requestOrigin}?query=1`,
    `${requestOrigin}#hash`,
  ])('allows same-origin Referer fallback: %s', async (referer) => {
    const ctx = createContext({ headers: { Referer: referer } })

    await expect(getCsrfRequestValidationResult({}, ctx)).resolves.toBe(true)
  })

  it.each([
    'https://evil.example.com/path',
    `${requestOrigin}.evil/path`,
    `${requestOrigin}:443/path`,
  ])('rejects cross-origin Referer fallback: %s', async (referer) => {
    const ctx = createContext({ headers: { Referer: referer } })

    await expect(getCsrfRequestValidationResult({}, ctx)).resolves.toBe(false)
  })

  it('returns undefined for requests without origin check headers', async () => {
    const ctx = createContext({})

    await expect(
      getCsrfRequestValidationResult({}, ctx),
    ).resolves.toBeUndefined()
  })

  it('rejects empty Referer header as known invalid origin check', async () => {
    const ctx = createContext({ headers: { Referer: '' } })

    await expect(getCsrfRequestValidationResult({}, ctx)).resolves.toBe(false)
  })

  it('rejects missing origin check headers by default', async () => {
    const ctx = createContext({})

    await expect(isCsrfRequestAllowed({}, ctx)).resolves.toBe(false)
  })

  it('allows missing origin check headers with the opt-in', async () => {
    const ctx = createContext({})

    await expect(
      isCsrfRequestAllowed({ allowRequestsWithoutOriginCheck: true }, ctx),
    ).resolves.toBe(true)
  })

  it('does not allow invalid origin check headers with the opt-in', async () => {
    const ctx = createContext({ headers: { 'Sec-Fetch-Site': 'cross-site' } })

    await expect(
      isCsrfRequestAllowed({ allowRequestsWithoutOriginCheck: true }, ctx),
    ).resolves.toBe(false)
  })

  it('uses custom origin matchers', async () => {
    const ctx = createContext({
      headers: { Origin: 'https://preview.example.com' },
    })

    await expect(
      getCsrfRequestValidationResult(
        { origin: ['https://app.example.com', 'https://preview.example.com'] },
        ctx,
      ),
    ).resolves.toBe(true)
  })

  it('uses custom Sec-Fetch-Site matchers', async () => {
    const ctx = createContext({ headers: { 'Sec-Fetch-Site': 'same-site' } })

    await expect(
      getCsrfRequestValidationResult(
        { secFetchSite: ['same-origin', 'same-site'] },
        ctx,
      ),
    ).resolves.toBe(true)
  })

  it('reads request URL origin only when needed', async () => {
    const getUrl = vi.fn(() => `${requestOrigin}/_serverFn/test`)
    const sameOriginFetch = createContext({
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    })
    Object.defineProperty(sameOriginFetch.request, 'url', { get: getUrl })

    await expect(
      getCsrfRequestValidationResult({}, sameOriginFetch),
    ).resolves.toBe(true)
    expect(getUrl).not.toHaveBeenCalled()

    const originFallback = createContext({
      headers: { Origin: requestOrigin },
    })
    Object.defineProperty(originFallback.request, 'url', { get: getUrl })

    await expect(
      getCsrfRequestValidationResult({}, originFallback),
    ).resolves.toBe(true)
    expect(getUrl).toHaveBeenCalledTimes(1)
  })
})

describe('createCsrfMiddleware', () => {
  it('marks middleware with csrfSymbol in non-production environments', () => {
    const middleware = createCsrfMiddleware()

    expect(csrfSymbol in middleware).toBe(true)
  })

  it('protects router requests by default', async () => {
    const middleware = createCsrfMiddleware()
    const ctx = createContext({ handlerType: 'router' })

    const { result, next } = await runMiddleware(middleware, ctx)

    expect(next).not.toHaveBeenCalled()
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('protects server function requests by default', async () => {
    const middleware = createCsrfMiddleware()
    const ctx = createContext({ handlerType: 'serverFn' })

    const { result, next } = await runMiddleware(middleware, ctx)

    expect(next).not.toHaveBeenCalled()
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('filters requests', async () => {
    const middleware = createCsrfMiddleware({ filter: () => false })
    const ctx = createContext({ handlerType: 'serverFn' })

    const { next } = await runMiddleware(middleware, ctx)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('can filter to server function requests', async () => {
    const middleware = createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === 'serverFn',
    })
    const ctx = createContext({ handlerType: 'router' })

    const { next } = await runMiddleware(middleware, ctx)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('uses custom failure responses', async () => {
    const middleware = createCsrfMiddleware({
      failureResponse: new Response('CSRF failed', { status: 419 }),
    })
    const ctx = createContext({ handlerType: 'serverFn' })

    const { result } = await runMiddleware(middleware, ctx)

    expect((result as Response).status).toBe(419)
    await expect((result as Response).text()).resolves.toBe('CSRF failed')
  })
})

function createContextFromRequest(
  request: Request,
): RequestServerOptions<Register, undefined> {
  return {
    request,
    pathname: new URL(request.url).pathname,
    context: undefined,
    next: (() => undefined) as any,
    handlerType: 'serverFn',
  }
}
