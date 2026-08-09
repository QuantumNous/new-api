import type {
  AdminRedemptionCode,
  AdminRedemptionSortBy,
  AdminRedemptionStatus,
  AdminRedemptionType,
} from '@/types/console'
import { QUOTA_PER_DOLLAR } from '@/utils/format'

export const ADMIN_REDEMPTION_TYPES: readonly AdminRedemptionType[] = ['quota']

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
  'createdTime',
  'expiry',
] as const

export type AdminRedemptionOptionalField =
  (typeof ADMIN_REDEMPTION_OPTIONAL_FIELDS)[number]

export const ADMIN_REDEMPTION_DEFAULT_VISIBLE_FIELDS: AdminRedemptionOptionalField[] =
  ['name', 'createdTime']

export const ADMIN_REDEMPTION_VISIBLE_FIELDS_STORAGE_KEY =
  'ren2hub_admin_redemption_visible_fields'

export function sanitizeAdminRedemptionVisibleFields(
  fields: readonly string[]
): AdminRedemptionOptionalField[] {
  return ADMIN_REDEMPTION_OPTIONAL_FIELDS.filter((field) =>
    fields.includes(field)
  )
}

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

export function adminRedemptionStatusLabelKey(
  status: AdminRedemptionStatus
): string {
  return `redemption.status${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

export function formatRedemptionValue(
  code: Pick<AdminRedemptionCode, 'amount' | 'quota'>
): string {
  const amount =
    Number.isFinite(code.amount) && code.amount > 0
      ? code.amount
      : code.quota / QUOTA_PER_DOLLAR
  return `$${amount.toFixed(2)}`
}

export function maskRedemptionCode(code: string): string {
  if (code.length <= 12) return code
  return `${code.slice(0, 8)}${'*'.repeat(8)}${code.slice(-4)}`
}
