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
import type { ApiResponse, ComputeNodesResult } from './types'

export const computeQueryKeys = {
  all: ['compute'] as const,
  nodes: () => [...computeQueryKeys.all, 'nodes'] as const,
}

export async function getComputeNodes(): Promise<
  ApiResponse<ComputeNodesResult>
> {
  const res = await api.get('/api/compute/nodes')
  return res.data
}

export async function stopComputeNode(
  id: number
): Promise<ApiResponse<{ id: number; status: string }>> {
  const res = await api.post(`/api/compute/nodes/${id}/stop`, {})
  return res.data
}
