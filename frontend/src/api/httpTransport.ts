import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

import { ApiError, type ApiResponse } from './types'
import type { ApiTransport, HttpMethod, RequestOptions } from './transport'
import {
  AuthSessionInvalidatedError,
  clearAuthBundleIfCurrent,
  getAuthSessionSnapshot,
  isAuthSessionCurrent,
  isAuthSessionIdentityCurrent,
  parseAuthBundle,
  replaceAuthBundleIfCurrent,
  setAuthBundleIfCurrent,
  type AuthSessionSnapshot,
} from './authSession'

const http = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 15_000,
})

const publicHttp = axios.create({
  baseURL: '',
  withCredentials: false,
  timeout: 15_000,
})

const AUTH_ENDPOINTS = new Set([
  '/api/user/login',
  '/api/user/login/2fa',
  '/api/user/register',
  '/api/user/auth/refresh',
  '/api/user/auth/logout',
  '/api/reset_password',
  '/api/user/reset',
])
const REFRESH_RACE_DELAYS_MS = [50, 100, 200] as const

function staleSessionError(cause?: unknown): ApiError {
  return new ApiError(
    'Authentication session changed while the request was pending',
    { status: 409, code: 'AUTH_SESSION_CHANGED', cause }
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function errorPayload(error: unknown): Record<string, unknown> | null {
  if (!axios.isAxiosError(error) || !isRecord(error.response?.data)) return null
  return error.response.data
}

function toApiError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const payload = errorPayload(error)
    const message =
      typeof payload?.message === 'string' && payload.message
        ? payload.message
        : error.message || 'Network request failed'
    throw new ApiError(message, {
      status: error.response?.status,
      code: typeof payload?.code === 'string' ? payload.code : undefined,
      cause: error,
    })
  }
  throw error
}

export function createHttpTransport(client: AxiosInstance): ApiTransport {
  type RefreshOutcome = 'refreshed' | 'invalid' | 'stale'
  interface RefreshTask {
    revision: number
    sid: string
    promise: Promise<RefreshOutcome>
  }

  let refreshTask: RefreshTask | null = null

  async function refreshAuthentication(
    snapshot: AuthSessionSnapshot
  ): Promise<RefreshOutcome> {
    const sid = snapshot.bundle?.session.sid
    if (!sid) return 'invalid'

    if (refreshTask) {
      if (
        refreshTask.revision === snapshot.revision &&
        refreshTask.sid === sid
      ) {
        return refreshTask.promise
      }
      try {
        await refreshTask.promise
      } catch {
        // A refresh for an obsolete session must not block the current one.
      }
      if (!isAuthSessionCurrent(snapshot)) return 'stale'
      return refreshAuthentication(snapshot)
    }

    const promise = (async (): Promise<RefreshOutcome> => {
      let expectedSid: string | undefined = sid
      let allowMismatchRecovery = true
      let raceAttempt = 0

      while (true) {
        try {
          const response: AxiosResponse<ApiResponse<unknown>> =
            await client.request<ApiResponse<unknown>>({
              method: 'POST',
              url: '/api/user/auth/refresh',
              headers: expectedSid
                ? { 'X-Auth-Session': expectedSid }
                : undefined,
            })
          const bundle = response.data.success
            ? parseAuthBundle(response.data.data)
            : null
          if (!bundle || (expectedSid && bundle.session.sid !== expectedSid)) {
            return clearAuthBundleIfCurrent(snapshot) ? 'invalid' : 'stale'
          }
          const accepted = expectedSid
            ? setAuthBundleIfCurrent(snapshot, bundle)
            : snapshot.bundle?.user.id === bundle.user.id
              ? replaceAuthBundleIfCurrent(snapshot, bundle)
              : false
          if (!expectedSid && !accepted) {
            return clearAuthBundleIfCurrent(snapshot) ? 'invalid' : 'stale'
          }
          return accepted ? 'refreshed' : 'stale'
        } catch (error) {
          const status = axios.isAxiosError(error)
            ? error.response?.status
            : undefined
          const code = errorPayload(error)?.code
          if (status === 409 && code === 'AUTH_REFRESH_RACE') {
            const delay = REFRESH_RACE_DELAYS_MS[raceAttempt]
            if (delay !== undefined) {
              raceAttempt++
              await new Promise((resolve) =>
                globalThis.setTimeout(resolve, delay)
              )
              if (!isAuthSessionCurrent(snapshot)) return 'stale'
              continue
            }
          }
          if (
            status === 409 &&
            code === 'AUTH_SESSION_MISMATCH' &&
            allowMismatchRecovery
          ) {
            if (!isAuthSessionCurrent(snapshot)) return 'stale'
            expectedSid = undefined
            allowMismatchRecovery = false
            raceAttempt = 0
            continue
          }
          if (
            status === 401 ||
            (status === 409 && code === 'AUTH_SESSION_MISMATCH')
          ) {
            return clearAuthBundleIfCurrent(snapshot) ? 'invalid' : 'stale'
          }
          throw error
        }
      }
    })()
    const task: RefreshTask = { revision: snapshot.revision, sid, promise }
    refreshTask = task
    const clearTask = () => {
      if (refreshTask === task) refreshTask = null
    }
    void promise.then(clearTask, clearTask)

    return promise
  }

  async function requestOnce<T>(
    method: HttpMethod,
    url: string,
    options: RequestOptions,
    retry: boolean
  ): Promise<ApiResponse<T>> {
    const snapshot = getAuthSessionSnapshot()
    const bundle = snapshot.bundle
    const headers = { ...options.headers }
    if (bundle)
      headers.Authorization = `${bundle.token_type} ${bundle.access_token}`
    if (url === '/api/user/auth/logout' && bundle?.session.sid) {
      headers['X-Auth-Session'] = bundle.session.sid
    }

    try {
      const response = await client.request<ApiResponse<T>>({
        method,
        url,
        params: options.params,
        data: options.data,
        signal: options.signal,
        headers,
      })
      if (!isAuthSessionIdentityCurrent(snapshot)) {
        throw staleSessionError()
      }
      return response.data
    } catch (error) {
      if (!isAuthSessionIdentityCurrent(snapshot)) {
        throw staleSessionError(error)
      }
      const canRefresh = Boolean(
        retry &&
        bundle &&
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !AUTH_ENDPOINTS.has(url)
      )
      if (canRefresh) {
        const current = getAuthSessionSnapshot()
        if (current.revision !== snapshot.revision) {
          return requestOnce(method, url, options, false)
        }

        let outcome: RefreshOutcome
        try {
          outcome = await refreshAuthentication(snapshot)
        } catch (refreshError) {
          return toApiError(refreshError)
        }
        if (outcome === 'refreshed') {
          return requestOnce(method, url, options, false)
        }
        if (outcome === 'stale') {
          throw staleSessionError(error)
        }
        if (outcome === 'invalid') {
          throw new AuthSessionInvalidatedError(error)
        }
      }
      return toApiError(error)
    }
  }

  return {
    request<T>(
      method: HttpMethod,
      url: string,
      options: RequestOptions = {}
    ): Promise<ApiResponse<T>> {
      return requestOnce(method, url, options, true)
    },
  }
}

export const httpTransport = createHttpTransport(http)

export function createPublicHttpTransport(client: AxiosInstance): ApiTransport {
  return {
    async request<T>(
      method: HttpMethod,
      url: string,
      options: RequestOptions = {}
    ): Promise<ApiResponse<T>> {
      try {
        const response = await client.request<ApiResponse<T>>({
          method,
          url,
          params: options.params,
          data: options.data,
          signal: options.signal,
          headers: options.headers,
        })
        return response.data
      } catch (error) {
        return toApiError(error)
      }
    },
  }
}

export const publicHttpTransport = createPublicHttpTransport(publicHttp)
