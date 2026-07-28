import axios, { AxiosError } from 'axios'

import { ApiError, type ApiResponse } from './types'
import type { ApiTransport, HttpMethod, RequestOptions } from './transport'

const http = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 15_000,
})

export const httpTransport: ApiTransport = {
  async request<T>(
    method: HttpMethod,
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await http.request<ApiResponse<T>>({
        method,
        url,
        params: options.params,
        data: options.data,
        signal: options.signal,
        headers: options.headers,
      })
      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new ApiError(error.message || 'Network request failed', {
          status: error.response?.status,
          cause: error,
        })
      }
      throw error
    }
  },
}
