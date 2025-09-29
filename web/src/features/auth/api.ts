import { api } from '@/lib/api'

export interface LoginPayload {
  username: string
  password: string
  turnstile?: string
}

export interface LoginResponse {
  success: boolean
  message: string
  data?: { require_2fa?: boolean }
}

export interface TwoFAPayload {
  code: string
}

export interface UserSelfResponse {
  success: boolean
  message: string
  data?: any
}

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

export async function login2fa(payload: TwoFAPayload) {
  const res = await api.post<LoginResponse>('/api/user/login/2fa', payload)
  return res.data
}

export async function logout() {
  const res = await api.get('/api/user/logout')
  return res.data
}

export async function getSelf() {
  const res = await api.get<UserSelfResponse>('/api/user/self')
  return res.data
}

export async function sendPasswordResetEmail(
  email: string,
  turnstile?: string
) {
  const res = await api.get('/api/reset_password', {
    params: { email, turnstile },
  })
  return res.data
}

export async function githubOAuthStart(clientId: string, state: string) {
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}&scope=user:email`
  window.open(url)
}

export async function getOAuthState(): Promise<string> {
  const aff =
    typeof window !== 'undefined' ? (localStorage.getItem('aff') ?? '') : ''
  const res = await api.get('/api/oauth/state', { params: { aff } })
  if (res.data?.success) return res.data.data
  return ''
}

export async function getStatus() {
  const res = await api.get('/api/status')
  return res.data?.data as any
}

export interface RegisterPayload {
  username: string
  password: string
  email?: string
  verification_code?: string
  aff?: string
  turnstile?: string
}

export async function register(payload: RegisterPayload) {
  const res = await api.post(`/api/user/register`, payload, {
    params: { turnstile: payload.turnstile ?? '' },
  })
  return res.data
}

export async function sendEmailVerification(email: string, turnstile?: string) {
  const res = await api.get('/api/verification', {
    params: { email, turnstile },
  })
  return res.data
}

export async function bindEmail(email: string, code: string) {
  const res = await api.get('/api/oauth/email/bind', {
    params: { email, code },
  })
  return res.data
}

export async function wechatLoginByCode(code: string) {
  const res = await api.get('/api/oauth/wechat', { params: { code } })
  return res.data
}

// 2FA management
export async function get2FAStatus() {
  const res = await api.get('/api/user/2fa/status')
  return res.data
}
export async function setup2FA() {
  const res = await api.post('/api/user/2fa/setup')
  return res.data
}
export async function enable2FA(code: string) {
  const res = await api.post('/api/user/2fa/enable', { code })
  return res.data
}
export async function disable2FA(code: string) {
  const res = await api.post('/api/user/2fa/disable', { code })
  return res.data
}
export async function regenerate2FABackupCodes(code: string) {
  const res = await api.post('/api/user/2fa/backup_codes', { code })
  return res.data
}
