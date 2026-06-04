/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'
import type {
  LoginPayload,
  LoginResponse,
  Login2FAResponse,
  TwoFAPayload,
  RegisterPayload,
  SmsRegisterPayload,
  SmsPhoneLoginPayload,
  ApiResponse,
} from './types'

// ============================================================================
// Authentication APIs
// ============================================================================

// ----------------------------------------------------------------------------
// Login & Logout
// ----------------------------------------------------------------------------

// User login with username and password
export async function login(payload: LoginPayload) {
  const turnstile = payload.turnstile ?? ''
  const res = await api.post<LoginResponse>(
    `/api/user/login?turnstile=${turnstile}`,
    {
      username: payload.username,
      password: payload.password,
    }
  )
  return res.data
}

// Two-factor authentication login
export async function login2fa(payload: TwoFAPayload) {
  const res = await api.post<Login2FAResponse>('/api/user/login/2fa', payload)
  return res.data
}

// User logout
export async function logout(): Promise<ApiResponse> {
  const res = await api.get('/api/user/logout')
  return res.data
}

// ----------------------------------------------------------------------------
// Password Management
// ----------------------------------------------------------------------------

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  turnstile?: string
): Promise<ApiResponse> {
  const res = await api.get('/api/reset_password', {
    params: { email, turnstile },
  })
  return res.data
}

// ----------------------------------------------------------------------------
// OAuth
// ----------------------------------------------------------------------------

// Start GitHub OAuth flow
export async function githubOAuthStart(clientId: string, state: string) {
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}&scope=user:email`
  window.open(url)
}

// Get OAuth state for CSRF protection
export async function getOAuthState(): Promise<string> {
  const aff =
    typeof window !== 'undefined' ? (localStorage.getItem('aff') ?? '') : ''
  const res = await api.get('/api/oauth/state', { params: { aff } })
  if (res.data?.success) return res.data.data
  return ''
}

// WeChat login by authorization code
export async function wechatLoginByCode(code: string): Promise<ApiResponse> {
  const res = await api.get('/api/oauth/wechat', { params: { code } })
  return res.data
}

// ----------------------------------------------------------------------------
// Registration
// ----------------------------------------------------------------------------

// User registration
export async function register(payload: RegisterPayload): Promise<ApiResponse> {
  const res = await api.post(`/api/user/register`, payload, {
    params: { turnstile: payload.turnstile ?? '' },
  })
  return res.data
}

export function buildSmsRegisterCodeRequest(phone: string, turnstile?: string) {
  return {
    url: '/api/user/sms/register/code',
    data: {
      phone,
    },
    config: {
      params: {
        turnstile: turnstile ?? '',
      },
    },
  }
}

export function buildSmsRegisterRequest(payload: SmsRegisterPayload) {
  return {
    url: '/api/user/sms/register',
    data: {
      username: payload.username,
      password: payload.password,
      phone: payload.phone,
      verification_code: payload.verification_code,
      aff_code: payload.aff_code,
    },
    config: {
      params: {
        turnstile: payload.turnstile ?? '',
      },
    },
  }
}

export async function sendSmsRegisterCode(
  phone: string,
  turnstile?: string
): Promise<ApiResponse> {
  const request = buildSmsRegisterCodeRequest(phone, turnstile)
  const res = await api.post(request.url, request.data, request.config)
  return res.data
}

export async function smsRegister(
  payload: SmsRegisterPayload
): Promise<ApiResponse> {
  const request = buildSmsRegisterRequest(payload)
  const res = await api.post(request.url, request.data, request.config)
  return res.data
}

export function buildSmsLoginCodeRequest(phone: string, turnstile?: string) {
  return {
    url: '/api/user/sms/login/code',
    data: {
      phone,
    },
    config: {
      params: {
        turnstile: turnstile ?? '',
      },
    },
  }
}

export function buildSmsPhoneLoginRequest(payload: SmsPhoneLoginPayload) {
  return {
    url: '/api/user/login/phone',
    data: {
      phone: payload.phone,
      verification_code: payload.verification_code,
    },
    config: {
      params: {
        turnstile: payload.turnstile ?? '',
      },
    },
  }
}

export async function sendSmsLoginCode(
  phone: string,
  turnstile?: string
): Promise<ApiResponse> {
  const request = buildSmsLoginCodeRequest(phone, turnstile)
  const res = await api.post(request.url, request.data, request.config)
  return res.data
}

export async function smsPhoneLogin(
  payload: SmsPhoneLoginPayload
): Promise<LoginResponse> {
  const request = buildSmsPhoneLoginRequest(payload)
  const res = await api.post<LoginResponse>(
    request.url,
    request.data,
    request.config
  )
  return res.data
}

// Send email verification code
export async function sendEmailVerification(
  email: string,
  turnstile?: string
): Promise<ApiResponse> {
  const res = await api.get('/api/verification', {
    params: { email, turnstile },
  })
  return res.data
}

// Bind email to OAuth account
export async function bindEmail(
  email: string,
  code: string
): Promise<ApiResponse> {
  const res = await api.post('/api/oauth/email/bind', {
    email,
    code,
  })
  return res.data
}
