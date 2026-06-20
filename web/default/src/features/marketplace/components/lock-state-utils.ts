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
import type { SkillLockReason } from '../types'

export type LockStateKind =
  | 'plan_required'
  | 'subscription_inactive'
  | 'quota_exceeded'
  | 'kids_blocked'
  | 'unavailable'

export function normalizeLockState(
  reason?: SkillLockReason | string | null
): LockStateKind | null {
  switch (reason) {
    case 'plan_required':
    case 'SKILL_PLAN_REQUIRED':
      return 'plan_required'
    case 'subscription_inactive':
    case 'SKILL_SUBSCRIPTION_INACTIVE':
      return 'subscription_inactive'
    case 'quota_exceeded':
    case 'SKILL_QUOTA_EXCEEDED':
      return 'quota_exceeded'
    case 'kids_blocked':
    case 'kids_mode_blocked':
    case 'SKILL_KIDS_MODE_BLOCKED':
      return 'kids_blocked'
    case 'skill_not_published':
    case 'SKILL_NOT_PUBLISHED':
      return 'unavailable'
    default:
      return null
  }
}
