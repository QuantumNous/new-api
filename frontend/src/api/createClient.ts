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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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
    delete: (url, params, options) =>
      request('DELETE', url, { ...options, params }),
  }
}
