import type {
  AdminRedemptionCode,
  AdminRedemptionSortBy,
  AdminRedemptionStatus,
  AdminRedemptionType,
} from '@/types/console'

export const ADMIN_REDEMPTION_TYPES: readonly AdminRedemptionType[] = [
  'quota',
  'concurrency',
  'subscription',
  'invite',
]

export const ADMIN_REDEMPTION_STATUSES: readonly AdminRedemptionStatus[] = [
  'unused',
  'used',
  'expired',
  'disabled',
]

export const ADMIN_REDEMPTION_SORT_FIELDS: AdminRedemptionSortBy[] = [
  'id',
  'created_time',
  'used_time',
]

export const ADMIN_REDEMPTION_OPTIONAL_FIELDS = [
  'name',
  'type',
  'createdTime',
  'expiry',
] as const

export type AdminRedemptionOptionalField =
  (typeof ADMIN_REDEMPTION_OPTIONAL_FIELDS)[number]

export const ADMIN_REDEMPTION_DEFAULT_VISIBLE_FIELDS: AdminRedemptionOptionalField[] =
  ['name', 'type', 'createdTime']

export const ADMIN_REDEMPTION_VISIBLE_FIELDS_STORAGE_KEY =
  'ren2hub_admin_redemption_visible_fields'

export function sanitizeAdminRedemptionVisibleFields(
  fields: readonly string[]
): AdminRedemptionOptionalField[] {
  return ADMIN_REDEMPTION_OPTIONAL_FIELDS.filter((field) =>
    fields.includes(field)
  )
}

/** StatusChip tone for each code type. */
export function adminRedemptionTypeTone(
  type: AdminRedemptionType
): 'accent' | 'info' | 'success' | 'neutral' {
  switch (type) {
    case 'quota':
      return 'accent'
    case 'subscription':
      return 'info'
    case 'concurrency':
      return 'success'
    case 'invite':
      return 'neutral'
  }
}

/** StatusChip tone for each lifecycle state. */
export function adminRedemptionStatusTone(
  status: AdminRedemptionStatus
): 'success' | 'neutral' | 'warning' | 'danger' {
  switch (status) {
    case 'unused':
      return 'success'
    case 'used':
      return 'neutral'
    case 'expired':
      return 'warning'
    case 'disabled':
      return 'danger'
  }
}

export function adminRedemptionTypeLabelKey(type: AdminRedemptionType): string {
  return `redemption.type${type.charAt(0).toUpperCase()}${type.slice(1)}`
}

export function adminRedemptionStatusLabelKey(
  status: AdminRedemptionStatus
): string {
  return `redemption.status${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

/** QUOTA_PER_DOLLAR = 500_000, mirrored from data.ts to avoid a circular import. */
const QUOTA_PER_DOLLAR = 500_000

/**
 * Human-readable face value for a redemption code.
 * Returns e.g. "$5.00", "3 并发", "专业版", "邀请码".
 */
export function formatRedemptionValue(
  code: Pick<AdminRedemptionCode, 'type' | 'amount' | 'quota' | 'concurrency'>,
  /** Resolved plan name for subscription codes; falls back to a generic label. */
  planName?: string
): string {
  switch (code.type) {
    case 'quota': {
      const usd =
        code.amount != null
          ? code.amount
          : code.quota != null
            ? code.quota / QUOTA_PER_DOLLAR
            : 0
      return `$${usd.toFixed(2)}`
    }
    case 'concurrency':
      return `${code.concurrency ?? 0} 并发`
    case 'subscription':
      // The catalogue now has two shapes, so a bare "订阅" would be wrong for a
      // traffic pack. Callers that know the plan pass its name instead.
      return planName ?? '套餐'
    case 'invite':
      return '邀请码'
  }
}

/** First 8 + *** + last 4 masking strategy. */
export function maskRedemptionCode(code: string): string {
  if (code.length <= 12) return code
  return `${code.slice(0, 8)}${'*'.repeat(8)}${code.slice(-4)}`
}
