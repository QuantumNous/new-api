export const ROLE = {
  GUEST: 0, // 后续如果需要用到这个角色那就再加，同语先留一下
  USER: 1,
  ADMIN: 10,
  SUPER_ADMIN: 100,
} as const

export type RoleValue = (typeof ROLE)[keyof typeof ROLE]

export function getRoleLabel(
  role?: number
): 'Super Admin' | 'Admin' | 'User' | 'Guest' {
  if (role === ROLE.SUPER_ADMIN) return 'Super Admin'
  if (role === ROLE.ADMIN) return 'Admin'
  if (role === ROLE.USER) return 'User'
  return 'Guest'
}
