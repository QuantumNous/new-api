import type { PolicyConfig } from '@/shared/features/request-policies/api'
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
/**
 * Request policy settings API.
 *
 * The types stay in `@/shared/features/request-policies/api` because the
 * client usage-logs feature reads the event shapes; the admin endpoints live
 * here so the client bundle never includes them.
 */
import { api } from '@/shared/lib/api'
import { requireServerSuccess } from '@/shared/lib/server-error-message'

export * from '@/shared/features/request-policies/api'

type Response<T> = { success: boolean; message?: string; data: T }
export async function getPolicyConfig() {
  const response = await api.get<Response<PolicyConfig>>(
    '/api/option/request_policy'
  )
  return requireServerSuccess(response.data).data
}
export async function savePolicyConfig(options: Record<string, string>) {
  const response = await api.patch<Response<PolicyConfig>>(
    '/api/option/request_policy',
    { options }
  )
  return requireServerSuccess(response.data).data
}
