/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'

import type { AvailabilityBadgeStatus } from './lib/status'

export type AvailabilityRecord = {
  created_at: number
  use_time: number
  ok: boolean
}

export type AvailabilityGroup = {
  group: string
  records: AvailabilityRecord[]
  success_rate: number
  avg_use_time: number
  status: AvailabilityBadgeStatus
  total: number
  success_count: number
}

export type AvailabilityResponse = {
  groups: AvailabilityGroup[]
}

export async function getExtensionsAvailability(): Promise<AvailabilityResponse> {
  const res = await api.get('/api/extensions/availability')
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Failed to load availability')
  }
  return (res.data.data || { groups: [] }) as AvailabilityResponse
}
