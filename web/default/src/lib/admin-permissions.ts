import { ROLE } from './roles'
import type { AuthUser } from '@/stores/auth-store'

export type AdminPermissionMatrix = Record<string, Record<string, boolean>>
export type AdminCapabilities = AdminPermissionMatrix

export const ADMIN_PERMISSION_RESOURCES = {
  CHANNEL: 'channel',
} as const

export const ADMIN_PERMISSION_ACTIONS = {
  READ: 'read',
  OPERATE: 'operate',
  WRITE: 'write',
  SENSITIVE_WRITE: 'sensitive_write',
  SECRET_VIEW: 'secret_view',
} as const

export const ADMIN_PERMISSION_CATALOG = [
  {
    resource: ADMIN_PERMISSION_RESOURCES.CHANNEL,
    labelKey: 'Channel Management',
    actions: [
      {
        value: ADMIN_PERMISSION_ACTIONS.READ,
        labelKey: 'Read channels',
        descriptionKey: 'View channel lists and details without secrets.',
        defaultAdmin: true,
      },
      {
        value: ADMIN_PERMISSION_ACTIONS.OPERATE,
        labelKey: 'Operate channels',
        descriptionKey: 'Test channels, update balances, and toggle availability.',
        defaultAdmin: true,
      },
      {
        value: ADMIN_PERMISSION_ACTIONS.WRITE,
        labelKey: 'Edit channel routing',
        descriptionKey: 'Edit non-sensitive routing fields such as models and groups.',
        defaultAdmin: true,
      },
      {
        value: ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE,
        labelKey: 'Edit sensitive channel settings',
        descriptionKey: 'Create channels or edit keys, base URLs, and overrides.',
        defaultAdmin: false,
      },
      {
        value: ADMIN_PERMISSION_ACTIONS.SECRET_VIEW,
        labelKey: 'View channel secrets',
        descriptionKey:
          'Reserved for viewing complete channel keys after secure verification.',
        defaultAdmin: false,
      },
    ],
  },
] as const

export function hasPermission(
  user: AuthUser | null | undefined,
  resource: string,
  action: string
): boolean {
  if (!user) return false
  if (user.role === ROLE.SUPER_ADMIN) return true
  return user.permissions?.admin_permissions?.[resource]?.[action] === true
}

export function normalizeAdminPermissions(
  value: AdminPermissionMatrix | null | undefined
): AdminPermissionMatrix {
  const normalized: AdminPermissionMatrix = {}
  for (const resource of ADMIN_PERMISSION_CATALOG) {
    const actions: Record<string, boolean> = {}
    for (const action of resource.actions) {
      actions[action.value] =
        value?.[resource.resource]?.[action.value] ?? action.defaultAdmin
    }
    normalized[resource.resource] = actions
  }
  return normalized
}
