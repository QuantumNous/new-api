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
import type { StatusBadgeProps } from '@/components/status-badge'
import type {
  AffiliateProfileFilters,
  AffiliateProfileFormValues,
  AffiliateProfilePayload,
  AffiliateProfilesParams,
} from './types'

type Translate = (key: string) => string

function normalizePositiveInteger(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.trunc(number)
}

export function buildAffiliateProfilesParams(
  filters: AffiliateProfileFilters,
  page: number,
  pageSize: number
): AffiliateProfilesParams {
  const userId = normalizePositiveInteger(filters.userId)
  const level = normalizePositiveInteger(filters.level)
  const status = String(filters.status || '').trim()

  return {
    p: page || 1,
    page_size: pageSize || 10,
    user_id: userId || undefined,
    level: level === 1 || level === 2 ? level : undefined,
    status: status || undefined,
  }
}

export function buildAffiliateProfilesQuery({
  page = 1,
  pageSize = 10,
  filters = {},
}: {
  page?: number
  pageSize?: number
  filters?: AffiliateProfileFilters
} = {}): string {
  const params = buildAffiliateProfilesParams(filters, page, pageSize)
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })

  return `/api/affiliate/admin/profiles?${query.toString()}`
}

export function buildAffiliateProfilePayload(
  values: AffiliateProfileFormValues = {}
): AffiliateProfilePayload {
  const level = normalizePositiveInteger(values.level)
  return {
    user_id: normalizePositiveInteger(values.userId),
    level,
    parent_user_id:
      level === 2 ? normalizePositiveInteger(values.parentUserId) : 0,
    invite_code: String(values.inviteCode || '').trim(),
    reason: String(values.reason || '').trim(),
  }
}

export function validateAffiliateProfilePayload(
  payload: AffiliateProfilePayload,
  t: Translate
): string {
  if (!payload.user_id) {
    return t('User ID is required')
  }
  if (payload.level !== 1 && payload.level !== 2) {
    return t('Please select an affiliate level')
  }
  if (payload.level === 2 && !payload.parent_user_id) {
    return t('Second-level affiliate requires a level-one parent user ID')
  }
  if (payload.level === 2 && payload.parent_user_id === payload.user_id) {
    return t('Second-level affiliate parent cannot be itself')
  }
  return ''
}

export function getAffiliateProfileStatusMeta(
  status: string,
  t: Translate
): { label: string; variant: StatusBadgeProps['variant'] } {
  switch (status) {
    case 'active':
      return { label: t('Active'), variant: 'success' }
    case 'disabled':
      return { label: t('Disabled'), variant: 'danger' }
    default:
      return { label: status || t('Unknown'), variant: 'neutral' }
  }
}

export function getAffiliateProfileLevelLabel(
  level: number,
  t: Translate
): string {
  if (Number(level) === 1) return t('Level-one affiliate')
  if (Number(level) === 2) return t('Level-two affiliate')
  return t('Not set')
}
