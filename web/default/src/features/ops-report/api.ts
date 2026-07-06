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
import type { ApiResponse, OpsReportData, OpsStripeReport } from './types'

export type OpsDauScope = 'plg' | 'all'

export const opsReportQueryKeys = {
  all: ['ops-report'] as const,
  report: (days: number, dauScope: OpsDauScope) =>
    [...opsReportQueryKeys.all, days, dauScope] as const,
  stripe: (days: number) => [...opsReportQueryKeys.all, 'stripe', days] as const,
}

export async function getOpsReport(
  days: number,
  dauScope: OpsDauScope
): Promise<ApiResponse<OpsReportData>> {
  const res = await api.get('/api/data/ops_report', {
    params: { days, dau_scope: dauScope },
  })
  return res.data
}

export async function getOpsStripeReport(
  days: number
): Promise<ApiResponse<OpsStripeReport>> {
  const res = await api.get('/api/data/ops_report_stripe', {
    params: { days },
  })
  return res.data
}
