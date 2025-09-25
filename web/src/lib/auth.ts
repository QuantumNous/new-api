import type { User } from '@/types/api'

const LS_USER_KEY = 'user'

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null) {
  try {
    if (user) localStorage.setItem(LS_USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(LS_USER_KEY)
  } catch {
    // ignore
  }
}

export function getStoredUserId(): number | undefined {
  const user = getStoredUser()
  if (!user) return undefined
  return (user as any).id as number
}

export function clearStoredUser() {
  setStoredUser(null)
}
