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
import type { User } from '@/features/users/types'
import { ROLE } from '@/lib/roles'

import { sanitizeAuthRedirect } from './auth-redirect'

type PostLoginUser = Pick<User, 'role'>
type PostLoginAccessRequirement =
  | 'dashboard'
  | 'user'
  | 'agent'
  | 'admin'
  | 'root'

const ROOT_PREFIXES = ['/system-settings', '/system-info'] as const
const ADMIN_PREFIXES = [
  '/agent-admin',
  '/channels',
  '/redemption-codes',
  '/users',
  '/subscriptions',
  '/models',
] as const
const AUTH_OR_ERROR_PREFIXES = ['/403', '/sign-in', '/sign-up', '/otp'] as const

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

export function getPostLoginAccessRequirement(
  path: string
): PostLoginAccessRequirement {
  if (ROOT_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return 'root'
  }
  if (ADMIN_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return 'admin'
  }
  if (matchesPrefix(path, '/agents')) return 'agent'
  if (path === '/dashboard') return 'dashboard'
  return 'user'
}

export async function resolvePostLoginTarget(
  redirectTo: string | undefined,
  user: PostLoginUser | undefined,
  probeAgentAccess: () => Promise<boolean>
): Promise<string> {
  const path = sanitizeAuthRedirect(redirectTo, window.location.origin)
  if (!path || !user) return '/dashboard'

  const pathname = new URL(path, window.location.origin).pathname
  if (
    AUTH_OR_ERROR_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  ) {
    return '/dashboard'
  }

  const requirement = getPostLoginAccessRequirement(pathname)

  if (requirement === 'root' && user.role !== ROLE.SUPER_ADMIN) {
    return '/dashboard'
  }
  if (requirement === 'admin' && user.role < ROLE.ADMIN) {
    return '/dashboard'
  }
  if (requirement === 'agent') {
    try {
      return (await probeAgentAccess()) ? path : '/dashboard'
    } catch {
      return '/dashboard'
    }
  }
  return path
}
