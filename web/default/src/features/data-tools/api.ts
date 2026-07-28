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
  ApiResponse,
  DataToolInspection,
  DataToolList,
  DataToolListParams,
  DataToolRunResult,
} from './types'

export const dataToolQueryKeys = {
  all: ['data-tools'] as const,
  list: (params: DataToolListParams) =>
    [...dataToolQueryKeys.all, 'list', params] as const,
  inspect: (id: string) => [...dataToolQueryKeys.all, 'inspect', id] as const,
}

export async function getDataTools(
  params: DataToolListParams
): Promise<DataToolList> {
  const response = await api.get<ApiResponse<DataToolList>>('/api/data-tools', {
    params,
  })
  if (!response.data.success) {
    throw new Error(response.data.message)
  }
  return response.data.data
}

export async function inspectDataTool(id: string): Promise<DataToolInspection> {
  const response = await api.get<ApiResponse<DataToolInspection>>(
    '/api/data-tools/inspect',
    { params: { id } }
  )
  if (!response.data.success) {
    throw new Error(response.data.message)
  }
  return response.data.data
}

export async function runDataTool(
  id: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
  apiKey: string
): Promise<DataToolRunResult> {
  const response = await api.post<ApiResponse<DataToolRunResult>>(
    '/api/data-tools/run',
    { id, input },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      disableDuplicate: true,
    }
  )
  if (!response.data.success) {
    throw new Error(response.data.message)
  }
  return response.data.data
}
