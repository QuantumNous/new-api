import type { ApiResponse } from './types'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestOptions {
  params?: Record<string, unknown>
  data?: unknown
  signal?: AbortSignal
  headers?: Record<string, string>
}

export interface ApiTransport {
  request<T>(
    method: HttpMethod,
    url: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>>
}
