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
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type ModelStatusProbe = {
  checked: boolean
  alive: boolean
  test_time?: number
  latency_ms?: number
}

export type ModelStatusEntry = {
  name: string
  request_count: number
  success_rate: number | null
  avg_latency_ms?: number
  probe: ModelStatusProbe
}

export type ModelStatusData = {
  success: boolean
  message?: string
  data: {
    models: ModelStatusEntry[]
  }
}

const REFRESH_INTERVAL_MS = 60_000

export async function getModelStatus(): Promise<ModelStatusData> {
  const res = await api.get<ModelStatusData>('/api/status/models')
  return res.data
}

export function useModelStatus() {
  return useQuery({
    queryKey: ['model-status'],
    queryFn: getModelStatus,
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 30_000,
  })
}
