import { ApiError } from './types'
import type { ApiTransport, RequestOptions } from './transport'

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

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export function createApiClient(transport: ApiTransport): ApiClient {
  const inflightGet = new Map<string, Promise<unknown>>()

  async function request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const dedupKey =
      method === 'GET' && !options.signal
        ? `${url}::${JSON.stringify(options.params ?? {})}`
        : null
    if (dedupKey && inflightGet.has(dedupKey)) {
      return inflightGet.get(dedupKey) as Promise<T>
    }

    const execution = transport
      .request<T>(method, url, options)
      .then((envelope) => {
        if (!envelope.success) {
          throw new ApiError(envelope.message || 'Request failed', {
            status: 200,
            business: true,
          })
        }
        return envelope.data
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          unauthorizedHandler?.()
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
