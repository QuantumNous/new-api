import { t } from 'i18next'

export const ROLE = {
  GUEST: 0, // 后续如果需要用到这个角色那就再加，同语先留一下
  USER: 1,
  ADMIN: 10,
  SUPER_ADMIN: 100,
} as const

export type RoleValue = (typeof ROLE)[keyof typeof ROLE]

const DEFAULT_ROLE = ROLE.GUEST

const ROLE_LABEL_KEYS: Record<RoleValue, string> = {
  [ROLE.SUPER_ADMIN]: 'Super Admin',
  [ROLE.ADMIN]: 'Admin',
  [ROLE.USER]: 'User',
  [ROLE.GUEST]: 'Guest',
}

export function getRoleLabelKey(role?: number): string {
  return ROLE_LABEL_KEYS[role as RoleValue] ?? ROLE_LABEL_KEYS[DEFAULT_ROLE]
}

export function getRoleLabel(role?: number): string {
  return t(getRoleLabelKey(role))
}
