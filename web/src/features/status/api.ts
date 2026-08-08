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

import type { StatusCardsPayload, StatusPageSettingsPayload } from './types'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
}

export async function getStatusPageCards(): Promise<StatusCardsPayload> {
  const res = await api.get<ApiEnvelope<StatusCardsPayload>>(
    '/api/status/cards',
    { headers: NO_CACHE_HEADERS, params: { _t: Date.now() } }
  )
  return res.data.data
}

export async function getStatusPageSettings(): Promise<StatusPageSettingsPayload> {
  const res = await api.get<ApiEnvelope<StatusPageSettingsPayload>>(
    '/api/status/settings',
    { headers: NO_CACHE_HEADERS, params: { _t: Date.now() } }
  )
  return res.data.data
}

export async function updateStatusPageSettings(
  payload: StatusPageSettingsPayload
): Promise<StatusPageSettingsPayload> {
  const res = await api.put<ApiEnvelope<StatusPageSettingsPayload>>(
    '/api/status/settings',
    payload,
    { headers: NO_CACHE_HEADERS }
  )
  return res.data.data
}
