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
  CodexModelGovernanceListParams,
  CodexModelGovernanceRecord,
  CodexModelGovernanceReviewRequest,
} from './types'

export const codexModelGovernanceQueryKeys = {
  all: ['codex-model-governance'] as const,
  list: (params: CodexModelGovernanceListParams = {}) =>
    [...codexModelGovernanceQueryKeys.all, 'list', params] as const,
}

export function getDefaultCodexModelGovernanceListParams(): CodexModelGovernanceListParams {
  return {}
}

export async function getCodexModelGovernanceRecords(
  params: CodexModelGovernanceListParams = {}
): Promise<ApiResponse<CodexModelGovernanceRecord[]>> {
  const res = await api.get('/api/codex_model_governance/', { params })
  return res.data
}

export async function reviewCodexModelGovernanceRecord(
  id: number,
  data: CodexModelGovernanceReviewRequest
): Promise<ApiResponse> {
  const res = await api.post(`/api/codex_model_governance/${id}/review`, data)
  return res.data
}
