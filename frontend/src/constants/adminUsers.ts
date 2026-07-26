import type {
  AdminUser,
  AdminUserRole,
  AdminUserSortBy,
  AdminUserStatus,
} from '@/types/console'

/** Backend role ladder (common/constants.go). Ascending privilege. */
export const ADMIN_USER_ROLES: readonly AdminUserRole[] = [0, 1, 10, 100]

/** Roles that can be assigned from the form. Guests are registration-only. */
export const ADMIN_USER_ASSIGNABLE_ROLES: readonly AdminUserRole[] = [
  1, 10, 100,
]

export const ADMIN_USER_OPTIONAL_FIELDS = [
  'id',
  'status',
  'role',
  'quota',
  'invite',
  'lastLogin',
  'createdTime',
] as const

export type AdminUserOptionalField = (typeof ADMIN_USER_OPTIONAL_FIELDS)[number]

/** ID and registration time stay off by default to keep the table narrow. */
export const ADMIN_USER_DEFAULT_VISIBLE_FIELDS: AdminUserOptionalField[] =
  ADMIN_USER_OPTIONAL_FIELDS.filter(
    (field) => field !== 'id' && field !== 'createdTime'
  )

export const ADMIN_USER_VISIBLE_FIELDS_STORAGE_KEY =
  'ren2hub_admin_user_visible_fields'

export function sanitizeAdminUserVisibleFields(
  fields: readonly string[]
): AdminUserOptionalField[] {
  return ADMIN_USER_OPTIONAL_FIELDS.filter((field) => fields.includes(field))
}

export const ADMIN_USER_SORT_FIELDS: AdminUserSortBy[] = [
  'id',
  'username',
  'quota',
  'used_quota',
  'created_time',
  'last_login_time',
]

export function adminUserStatusTone(
  status: AdminUserStatus
): 'success' | 'danger' {
  return status === 1 ? 'success' : 'danger'
}

export type AdminUserQuotaState = 'normal' | 'low' | 'exhausted'

export interface AdminUserQuotaMeter {
  state: AdminUserQuotaState
  /** Consumed share of the lifetime allowance, 0-100. */
  percent: number
  /** Remaining share, 0-100 — what the "only N% left" note reports. */
  remainingPercent: number
  color: string
}

/** Below this remaining share the row is worth an operator's attention. */
const QUOTA_LOW_REMAINING_RATIO = 0.1

/**
 * Deliberately NOT CapacityMeter's policy. Channel capacity is a hard ceiling —
 * at 80% it is nearly unroutable, so it warns early. A user's quota is a soft
 * balance that a top-up refills, so 80% consumed means nothing; only "almost
 * out" and "out" are worth signalling. Same reason the users table stopped
 * rendering a used/total pair: the total is not a real domain value.
 */
export function adminUserQuotaMeter(
  user: Pick<AdminUser, 'quota' | 'used_quota'>
): AdminUserQuotaMeter {
  const lifetime = user.quota + user.used_quota
  const percent =
    lifetime > 0
      ? Math.min(100, Math.max(0, (user.used_quota / lifetime) * 100))
      : 0
  const remainingRatio = lifetime > 0 ? user.quota / lifetime : 0

  // quota <= 0 covers both a spent-out account and one never funded; either way
  // the operator's takeaway is identical — this user cannot spend.
  const state: AdminUserQuotaState =
    user.quota <= 0
      ? 'exhausted'
      : remainingRatio < QUOTA_LOW_REMAINING_RATIO
        ? 'low'
        : 'normal'

  return {
    state,
    percent,
    remainingPercent: Math.round(remainingRatio * 100),
    color:
      state === 'exhausted'
        ? 'var(--status-danger)'
        : state === 'low'
          ? 'var(--status-warning)'
          : 'var(--signal)',
  }
}

export function adminUserStatusLabelKey(
  status: AdminUserStatus
): 'users.statusEnabled' | 'users.statusDisabled' {
  return status === 1 ? 'users.statusEnabled' : 'users.statusDisabled'
}

/**
 * Single source of truth for the role→tone ladder, shared by the admin table
 * and the profile page. Rust red marks root because red already reads as the
 * "administration" signal in this console, not as an error.
 */
export function adminUserRoleTone(
  role: number
): 'danger' | 'warning' | 'neutral' {
  if (role >= 100) return 'danger'
  if (role >= 10) return 'warning'
  return 'neutral'
}

export function adminUserRoleLabelKey(
  role: number
): 'users.roleRoot' | 'users.roleAdmin' | 'users.roleUser' | 'users.roleGuest' {
  if (role >= 100) return 'users.roleRoot'
  if (role >= 10) return 'users.roleAdmin'
  if (role >= 1) return 'users.roleUser'
  return 'users.roleGuest'
}

/**
 * The operator's authority level, which is deliberately NOT `user.role`.
 * `isDemoUser` pins the persisted demo identity to `role === 1` as an
 * anti-escalation boundary (see api/demoStorage.ts and its spec), so the level
 * has to come from the store's capability flags instead. When real
 * authorization lands, those flags start reflecting the server and this mapping
 * keeps working unchanged.
 */
export function adminOperatorLevel(capabilities: {
  isRoot?: boolean
  isAdmin?: boolean
}): number {
  if (capabilities.isRoot) return 100
  if (capabilities.isAdmin) return 10
  return 1
}

/**
 * UI-side guard only — never an authorization boundary. The server must reject
 * the same cases independently.
 *
 * An operator may act on a target only when the target ranks strictly lower.
 * That blocks peer-on-peer administration (admin editing admin) and any action
 * on your own row; self-service edits belong on the profile page.
 */
export function canManageAdminUser(
  target: Pick<AdminUser, 'id' | 'role'>,
  operator: { id: number; level: number } | null | undefined
): boolean {
  if (!operator) return false
  if (target.id === operator.id) return false
  return target.role < operator.level
}
