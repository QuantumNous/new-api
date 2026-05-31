export class ApiError extends Error {
  code: number
  data: unknown
  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.code = code
    this.data = data
  }
}

export function getAuthHeaders(): Record<string, string> {
  const userId = localStorage.getItem('vynex-user-id')
  if (!userId) return {}
  const token = localStorage.getItem('vynex-access-token') || ''
  const headers: Record<string, string> = {
    'New-Api-User': userId,
  }
  if (token) {
    headers['Authorization'] = token
  }
  return headers
}

async function request<T>(
  path: string,
  opts: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (opts.params) {
    Object.entries(opts.params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v))
    })
  }
  const { params, headers: customHeaders, ...rest } = opts
  const baseHeaders: Record<string, string> = {}
  if (rest.method && rest.method !== 'GET') {
    baseHeaders['Content-Type'] = 'application/json'
  }
  const res = await fetch(url.toString(), {
    ...rest,
    credentials: 'include',
    headers: {
      ...baseHeaders,
      ...getAuthHeaders(),
      ...(customHeaders as Record<string, string>),
    },
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new ApiError(res.status, json.message || `HTTP ${res.status}`, json.data)
  }
  return json.data as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(path, { method: 'GET', params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  del: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}

export function saveAuth(token: string, userId: number) {
  localStorage.setItem('vynex-access-token', token)
  localStorage.setItem('vynex-user-id', String(userId))
}

export function clearAuth() {
  localStorage.removeItem('vynex-access-token')
  localStorage.removeItem('vynex-user-id')
}

export function hasAuthToken(): boolean {
  return !!localStorage.getItem('vynex-user-id')
}

/* ---- typed interfaces ---- */

export interface User {
  id: number
  username: string
  display_name: string
  email: string
  role: number
  status: number
  group: string
  quota: number
  used_quota: number
  request_count: number
  aff_code: string
  invite_url: string
  access_token: string
}

export interface Token {
  id: number
  user_id: number
  key: string
  status: number
  name: string
  created_time: number
  accessed_time: number
  expired_time: number
  remain_quota: number
  unlimited_quota: boolean
  used_quota: number
  models: string
  subnet: string
  group: string
}

export interface Channel {
  id: number
  type: number
  key: string
  openai_organization?: string
  test_model?: string
  status: number
  weight: number
  created_time: number
  test_time: number
  response_time: number
  base_url: string
  other: string
  balance: number
  balance_updated_time: number
  models: string
  group: string
  used_quota: number
  model_mapping?: string
  priority: number
  auto_ban: number
  other_info: string
  tag: string
  name: string
}

export interface LogEntry {
  id: number
  user_id: number
  created_at: number
  type: number
  content: string
  username: string
  token_name: string
  model_name: string
  quota: number
  channel: number
  token_id: number
  group: string
  request_id: string
  upstream_request_id: string
  ip: string
  detail: string
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface StatusData {
  system_name: string
  logo?: string
  footer_html?: string
  version?: string
  register_enabled: boolean
  email_verification: boolean
  turnstile_check: boolean
  turnstile_site_key?: string
  github_oauth: boolean
  discord_oauth: boolean
  oidc_oauth: boolean
  linuxdo_oauth: boolean
  telegram_oauth: boolean
  wechat_oauth: boolean
  passkey_login_enabled: boolean
  password_login_enabled: boolean
  checkin_enabled: boolean
  custom_currency_symbol: string
  custom_currency_exchange_rate: number
  group_ratio: string
  announcements: Array<{ title: string; content: string }>
  api_info: Array<Record<string, string>>
  pricing_enabled: boolean
  rankings_enabled: boolean
  header_nav_modules: string
  sidebar_modules: string
}

export const ROLE = { USER: 1, ADMIN: 10, ROOT: 100 } as const
