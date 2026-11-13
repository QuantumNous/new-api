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
import { api } from '@/lib/api'

import type {
  PayloadLogDetail,
  PayloadLogListData,
  SwitchAuditListData,
} from './types'

export interface GetPayloadLogsParams {
  page?: number
  page_size?: number
  model_name?: string
  request_id?: string
}

// isAdmin selects between the all-users endpoint and the caller's own-logs
// endpoint, so a regular user can only ever see their own calls.
export async function getPayloadLogs(
  params: GetPayloadLogsParams,
  isAdmin: boolean
) {
  const res = await api.get<{ data: PayloadLogListData }>(
    isAdmin ? '/api/payload_log/' : '/api/payload_log/self',
    { params }
  )
  return res.data?.data
}

export async function getPayloadLogDetail(id: number, isAdmin: boolean) {
  const url = isAdmin
    ? `/api/payload_log/detail/${id}`
    : `/api/payload_log/self/detail/${id}`
  const res = await api.get<{ data: PayloadLogDetail }>(url)
  return res.data?.data
}

export async function getSwitchStatus() {
  const res = await api.get<{ data: { enabled: boolean } }>(
    '/api/payload_log/switch'
  )
  return res.data?.data?.enabled ?? false
}

// Root only (enforced server-side). Records who flipped the switch.
export async function setSwitch(enabled: boolean) {
  const res = await api.post('/api/payload_log/switch', { enabled })
  return res.data
}

export async function getSwitchAudits(
  params: { page?: number; page_size?: number } = {}
) {
  const res = await api.get<{ data: SwitchAuditListData }>(
    '/api/payload_log/switch/audits',
    { params }
  )
  return res.data?.data
}
