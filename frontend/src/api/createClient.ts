import { ApiError } from './types'
import type { ApiTransport, RequestOptions } from './transport'
import { AuthSessionInvalidatedError } from './authSession'

export interface ApiClient {
  get<T>(
    url: string,
    params?: Record<string, unknown>,
    options?: Pick<RequestOptions, 'signal'>
  ): Promise<T>
  post<T>(
    url: string,
    data?: unknown,
    options?: Pick<RequestOptions, 'signal'>
  ): Promise<T>
  put<T>(
    url: string,
    data?: unknown,
    options?: Pick<RequestOptions, 'signal'>
  ): Promise<T>
  patch<T>(
    url: string,
    data?: unknown,
    options?: Pick<RequestOptions, 'signal'>
  ): Promise<T>
  delete<T>(
    url: string,
    params?: Record<string, unknown>,
    options?: Pick<RequestOptions, 'signal'>
  ): Promise<T>
}

export interface ApiClientOptions {
  onUnauthorized?: () => void
  getRequestScope?: () => number
}

const LEGACY_PAYMENT_ENDPOINTS = new Set([
  '/api/user/amount',
  '/api/user/pay',
  '/api/user/stripe/amount',
  '/api/user/stripe/pay',
  '/api/user/creem/pay',
  '/api/user/waffo/amount',
  '/api/user/waffo/pay',
  '/api/user/waffo-pancake/amount',
  '/api/user/waffo-pancake/pay',
  '/api/subscription/epay/pay',
  '/api/subscription/stripe/pay',
  '/api/subscription/creem/pay',
  '/api/subscription/waffo-pancake/pay',
])

export function createApiClient(
  transport: ApiTransport,
  clientOptions: ApiClientOptions = {}
): ApiClient {
  const inflightGet = new Map<string, Promise<unknown>>()

  function isRequestScopeCurrent(requestScope: number | undefined): boolean {
    return (
      requestScope === undefined ||
      clientOptions.getRequestScope?.() === requestScope
    )
  }

  function isCurrentSessionInvalidation(error: unknown): boolean {
    return error instanceof AuthSessionInvalidatedError
  }

  async function request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const requestScope = clientOptions.getRequestScope?.()
    const dedupKey =
      method === 'GET' && !options.signal
        ? `${requestScope ?? 'global'}::${url}::${JSON.stringify(options.params ?? {})}`
        : null
    if (dedupKey && inflightGet.has(dedupKey)) {
      return inflightGet.get(dedupKey) as Promise<T>
    }

    const execution = transport
      .request<T>(method, url, options)
      .then((envelope) => {
        if (!isRequestScopeCurrent(requestScope)) {
          throw new ApiError(
            'Authentication session changed while the request was pending',
            { status: 409, code: 'AUTH_SESSION_CHANGED' }
          )
        }
        // A few legacy payment endpoints predate the common envelope and
        // answer {message: "success"|"error", data: ...}. Keep that wire
        // contract readable without weakening normal {success, data} checks.
        const legacy = envelope as unknown as {
          success?: boolean
          message?: string
          data?: unknown
        }
        if (legacy.success === undefined && LEGACY_PAYMENT_ENDPOINTS.has(url)) {
          if (legacy.message === 'success') {
            if ('url' in legacy) return legacy as unknown as T
            return legacy.data as T
          }
          throw new ApiError(
            typeof legacy.data === 'string'
              ? legacy.data
              : legacy.message || 'Request failed',
            { status: 200, business: true }
          )
        }
        if (legacy.success === undefined) {
          throw new ApiError('Invalid API response envelope', {
            status: 502,
            code: 'INVALID_RESPONSE',
          })
        }
        if (!envelope.success) {
          throw new ApiError(envelope.message || 'Request failed', {
            status: 200,
            business: true,
          })
        }
        return envelope.data
      })
      .catch((error: unknown) => {
        if (
          !isRequestScopeCurrent(requestScope) &&
          !isCurrentSessionInvalidation(error)
        ) {
          throw new ApiError(
            'Authentication session changed while the request was pending',
            { status: 409, code: 'AUTH_SESSION_CHANGED', cause: error }
          )
        }
        if (error instanceof ApiError && error.status === 401) {
          clientOptions.onUnauthorized?.()
        }
        throw error
      })

    if (dedupKey) {
      inflightGet.set(dedupKey, execution)
      execution.then(
        () => inflightGet.delete(dedupKey),
        () => inflightGet.delete(dedupKey)
      )
    }
    return execution
  }

  return {
    get: (url, params, options) => request('GET', url, { ...options, params }),
    post: (url, data, options) => request('POST', url, { ...options, data }),
    put: (url, data, options) => request('PUT', url, { ...options, data }),
    patch: (url, data, options) => request('PATCH', url, { ...options, data }),
    delete: (url, params, options) =>
      request('DELETE', url, { ...options, params }),
  }
}
