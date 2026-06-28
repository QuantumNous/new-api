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
import type { ApiKey } from '../types'

export type QuotaPolicyDisableState = 'active' | 'recovering' | null

export function getQuotaPolicyDisableState(
  apiKey: ApiKey
): QuotaPolicyDisableState {
  const policy = apiKey.quota_policy
  if (!policy?.enabled || policy.quota <= 0 || policy.next_reset_at <= 0) {
    return null
  }
  if (policy.exhausted_at <= 0 && policy.used_quota < policy.quota) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  return policy.next_reset_at <= now ? 'recovering' : 'active'
}

export function isTemporarilyDisabledByQuota(apiKey: ApiKey) {
  return getQuotaPolicyDisableState(apiKey) != null
}
