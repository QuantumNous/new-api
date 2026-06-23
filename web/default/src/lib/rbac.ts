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
import type { AuthUser } from '@/stores/auth-store'

import { ROLE } from './roles'

export const PERMISSION = {
  RBAC_MANAGE: 'rbac.manage',
  PROVIDER_MANAGE: 'provider.manage',
  PROVIDER_SELF_MANAGE: 'provider.self.manage',
  MARKETPLACE_MANAGE: 'marketplace.manage',
  MARKETPLACE_SELF_MANAGE: 'marketplace.self.manage',
  MARKETPLACE_VIEW: 'marketplace.view',
  MARKETPLACE_KEY_MANAGE: 'marketplace.key.manage',
  MARKETPLACE_SELF_KEY_MANAGE: 'marketplace.self.key.manage',
  FINANCE_MANAGE: 'finance.manage',
  FINANCE_VIEW: 'finance.view',
  AUDIT_VIEW: 'audit.view',
} as const

export type PermissionCode = (typeof PERMISSION)[keyof typeof PERMISSION]

export function getPermissionCodes(user?: AuthUser | null): string[] {
  const raw = user?.permissions?.permission_codes
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string')
    : []
}

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: PermissionCode
): boolean {
  if (!user) return false
  if (user.role >= ROLE.SUPER_ADMIN) return true
  return getPermissionCodes(user).includes(permission)
}

export function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: PermissionCode[]
): boolean {
  return permissions.some((permission) => hasPermission(user, permission))
}
