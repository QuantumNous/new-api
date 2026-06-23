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
import type { TFunction } from 'i18next'
import type { StatusVariant } from '@/components/status-badge'
import type { SkillPlan, SkillStatus } from '@/features/marketplace/types'
import type { AdminSkillKidsApprovalStatus } from './types'

export const ADMIN_SKILL_STATUSES: SkillStatus[] = [
  'draft',
  'published',
  'deprecated',
  'archived',
]

export const ADMIN_SKILL_PLANS: SkillPlan[] = ['free', 'pro', 'enterprise']

export const ADMIN_SKILL_KIDS_STATUSES: AdminSkillKidsApprovalStatus[] = [
  'not_required',
  'pending',
  'approved',
  'emergency_approved',
  'rejected',
  'revoked',
]

export const skillStatusVariant: Record<SkillStatus, StatusVariant> = {
  draft: 'neutral',
  published: 'success',
  deprecated: 'warning',
  archived: 'danger',
}

export const skillPlanVariant: Record<SkillPlan, StatusVariant> = {
  free: 'green',
  pro: 'blue',
  enterprise: 'purple',
}

export const kidsStatusVariant: Record<
  AdminSkillKidsApprovalStatus,
  StatusVariant
> = {
  not_required: 'neutral',
  pending: 'warning',
  approved: 'success',
  emergency_approved: 'info',
  rejected: 'danger',
  revoked: 'danger',
}

export function labelFromValue(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getAdminSkillStatusOptions(t: TFunction) {
  return ADMIN_SKILL_STATUSES.map((value) => ({
    label: t(labelFromValue(value)),
    value,
  }))
}

export function getAdminSkillPlanOptions(t: TFunction) {
  return ADMIN_SKILL_PLANS.map((value) => ({
    label: t(labelFromValue(value)),
    value,
  }))
}

export function getAdminSkillKidsOptions(t: TFunction) {
  return ADMIN_SKILL_KIDS_STATUSES.map((value) => ({
    label: t(labelFromValue(value)),
    value,
  }))
}
