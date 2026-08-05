import type {
  AuthBundle,
  AuthTokenRotation,
  LoginResponse,
  UserInfo,
  UserProfilePatch,
} from '@/types/auth'

import { api } from './client'
import { ApiError } from './types'
import {
  clearAuthBundleIfCurrent,
  getAuthSessionSnapshot,
  parseAuthBundle,
  parseAuthRotation,
  parseTwoFactorChallenge,
  setAuthBundleIfCurrent,
} from './authSession'

function invalidAuthResponse(endpoint: string): never {
  throw new ApiError(`Invalid authentication response: ${endpoint}`, {
    status: 502,
  })
}

function parseLoginResponse(value: unknown, endpoint: string): LoginResponse {
  return (
    parseAuthBundle(value) ??
    parseTwoFactorChallenge(value) ??
    invalidAuthResponse(endpoint)
  )
}

async function refreshSession(): Promise<AuthBundle> {
  const value = await api.post<unknown>('/api/user/auth/refresh')
  return parseAuthBundle(value) ?? invalidAuthResponse('/api/user/auth/refresh')
}

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    return parseLoginResponse(
      await api.post<unknown>('/api/user/login', { username, password }),
      '/api/user/login'
    )
  },
  async verifyTwoFactor(flowToken: string, code: string): Promise<AuthBundle> {
    const value = await api.post<unknown>('/api/user/login/2fa', {
      flow_token: flowToken,
      code,
    })
    return parseAuthBundle(value) ?? invalidAuthResponse('/api/user/login/2fa')
  },
  register: (payload: { username: string; email: string; password: string }) =>
    api.post<{ message: string }>('/api/user/register', payload),
  resetPassword: (email: string) =>
    api.get<unknown>('/api/reset_password', { email }),
  refreshSession,
  async logout(): Promise<void> {
    const snapshot = getAuthSessionSnapshot()
    try {
      await api.post('/api/user/auth/logout')
      return
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status !== 409 ||
        error.code !== 'AUTH_SESSION_MISMATCH'
      ) {
        throw error
      }
    }

    if (!clearAuthBundleIfCurrent(snapshot)) {
      throw new ApiError('Authentication session changed during logout', {
        status: 409,
      })
    }
    const recoverySnapshot = getAuthSessionSnapshot()
    let bundle: AuthBundle
    try {
      bundle = await refreshSession()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return
      throw error
    }
    if (!setAuthBundleIfCurrent(recoverySnapshot, bundle)) {
      throw new ApiError('Authentication session changed during logout', {
        status: 409,
      })
    }
    await api.post('/api/user/auth/logout')
  },
  self: () => api.get<UserInfo>('/api/user/self'),
  deleteSelf: () => api.delete<{ message: string }>('/api/user/self'),
  updateProfile: (patch: UserProfilePatch) =>
    api.put<unknown>('/api/user/self', patch),
  async changePassword(
    originalPassword: string,
    password: string
  ): Promise<AuthTokenRotation> {
    const value = await api.put<unknown>('/api/user/self', {
      original_password: originalPassword,
      password,
    })
    return parseAuthRotation(value) ?? invalidAuthResponse('/api/user/self')
  },
}
