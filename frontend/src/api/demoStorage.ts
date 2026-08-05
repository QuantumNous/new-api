import type { UserInfo } from '@/types/auth'

export const DEMO_USER_STORAGE_KEY = 'ren2hub_demo_user'
export const DEMO_UID_STORAGE_KEY = 'ren2hub_demo_uid'

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isDemoUser(value: unknown): value is UserInfo {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return (
    Number.isSafeInteger(user.id) &&
    Number(user.id) > 0 &&
    isString(user.username) &&
    isString(user.display_name) &&
    isString(user.email) &&
    user.role === 1 &&
    Number.isFinite(user.quota) &&
    Number.isFinite(user.used_quota)
    // `group` is intentionally not validated: the concept is retired, and a
    // record persisted before that still carries the field. Unknown extra keys
    // must not invalidate a session, or every existing demo user is logged out.
  )
}

export function readDemoUser(): UserInfo | null {
  try {
    const raw = window.localStorage.getItem(DEMO_USER_STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (isDemoUser(value)) return value
    clearDemoUser()
  } catch {
    // Restricted storage or malformed JSON invalidates the demo session.
    clearDemoUser()
  }
  return null
}

export function writeDemoUser(user: UserInfo): void {
  if (!isDemoUser(user)) throw new TypeError('Invalid demo user schema')
  window.localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user))
  window.localStorage.setItem(DEMO_UID_STORAGE_KEY, String(user.id))
}

export function clearDemoUser(): void {
  try {
    window.localStorage.removeItem(DEMO_USER_STORAGE_KEY)
    window.localStorage.removeItem(DEMO_UID_STORAGE_KEY)
  } catch {
    // The in-memory auth store is still cleared when storage is unavailable.
  }
}
