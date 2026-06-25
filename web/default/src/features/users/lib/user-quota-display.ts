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
import { formatQuota } from '@/lib/format'
import type { User } from '../types'

type UserQuotaFields = Pick<User, 'quota' | 'used_quota'>

export function getUserQuotaSummary(user: UserQuotaFields) {
  const used = user.used_quota
  const remaining = user.quota
  const total = used + remaining
  const percentage = total > 0 ? (remaining / total) * 100 : 0

  return {
    used,
    remaining,
    total,
    percentage,
    isEmpty: total === 0,
  }
}

export function formatUserQuotaDisplay(
  user: UserQuotaFields,
  noQuotaLabel = 'No Quota'
): string {
  const summary = getUserQuotaSummary(user)
  if (summary.isEmpty) {
    return noQuotaLabel
  }
  return formatQuota(summary.remaining)
}
