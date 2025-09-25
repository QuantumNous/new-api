// 统一 http 封装：超时、JSON、错误语义、鉴权头
import { getStoredUserId } from '@/lib/auth'
import { getCookie } from '@/lib/cookies'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type JsonBody = Record<string, unknown> | Array<unknown> | undefined

export interface HttpError {
  status: number
  message: string
  details?: unknown
}

async function safeMessage(res: Response): Promise<string> {
  try {
    const data = await res.clone().json()
    if (typeof data?.message === 'string') return data.message
    return JSON.stringify(data)
  } catch {
    try {
      return await res.clone().text()
    } catch {
      return res.statusText || 'Request failed'
    }
  }
}

const DEFAULT_TIMEOUT_MS = 30000
const ACCESS_TOKEN = 'thisisjustarandomstring'

export async function http<T>(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number; asText?: boolean } = {}
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  )

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  }

  // 从 cookie 读取 token，并自动附带
  const token = getCookie(ACCESS_TOKEN)
  if (token) {
    ;(headers as Record<string, string>)['Authorization'] =
      `Bearer ${JSON.parse(token)}`
  }

  // 携带 New-Api-User 以通过后端鉴权
  const userId = getStoredUserId()
  if (typeof userId === 'number' && userId > 0) {
    ;(headers as Record<string, string>)['New-Api-User'] = String(userId)
  }

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const message = await safeMessage(response)
      const error: HttpError = { status: response.status, message }
      throw error
    }

    if (init.asText) {
      return (await response.text()) as unknown as T
    }
    // 缺省按 JSON 解析
    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export async function get<T>(url: string, init?: RequestInit) {
  return http<T>(url, { ...init, method: 'GET' })
}

export async function post<T>(
  url: string,
  body?: JsonBody,
  init?: RequestInit
) {
  return http<T>(url, {
    ...init,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function put<T>(url: string, body?: JsonBody, init?: RequestInit) {
  return http<T>(url, {
    ...init,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function patch<T>(
  url: string,
  body?: JsonBody,
  init?: RequestInit
) {
  return http<T>(url, {
    ...init,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function del<T>(url: string, init?: RequestInit) {
  return http<T>(url, { ...init, method: 'DELETE' })
}
