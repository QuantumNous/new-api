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
import { ROLE } from '@/lib/roles'
import type { AuthUser } from '@/stores/auth-store'

const DEV_AUTH_STORAGE_KEY = 'dev_auth_session:v1'

type DevAuthSession = {
  username: string
}

function createDevUser(username: string): AuthUser {
  const displayName = username.trim()
  return {
    id: 1,
    username: displayName,
    display_name: displayName,
    email: displayName.includes('@') ? displayName : undefined,
    role: ROLE.SUPER_ADMIN,
    status: 1,
    group: 'default',
    quota: 1_000_000_000,
    used_quota: 0,
    request_count: 0,
    permissions: {
      sidebar_settings: true,
      sidebar_modules: {},
    },
  }
}

export function getDevAuthUser(): AuthUser | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null

  try {
    const saved = window.localStorage.getItem(DEV_AUTH_STORAGE_KEY)
    if (!saved) return null

    const session = JSON.parse(saved) as Partial<DevAuthSession>
    if (typeof session.username !== 'string' || !session.username.trim()) {
      window.localStorage.removeItem(DEV_AUTH_STORAGE_KEY)
      return null
    }

    return createDevUser(session.username)
  } catch {
    window.localStorage.removeItem(DEV_AUTH_STORAGE_KEY)
    return null
  }
}

export function startDevAuthSession(username: string): AuthUser | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null

  const user = createDevUser(username)
  const session: DevAuthSession = { username: user.username }
  window.localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify(session))
  window.localStorage.removeItem('uid')
  return user
}

export function clearDevAuthSession(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  window.localStorage.removeItem(DEV_AUTH_STORAGE_KEY)
  window.localStorage.removeItem('uid')
}

export function isDevAuthSession(): boolean {
  return getDevAuthUser() !== null
}
