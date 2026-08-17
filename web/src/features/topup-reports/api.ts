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

import type { MezonTopupReportData, MezonTopupReportResponse } from './types'

export async function getMezonTopupReport(
  year: number,
  month: number
): Promise<MezonTopupReportData> {
  const response = await api.get('/api/user/topup/mezon/report', {
    params: { year, month },
  })
  const result = response.data as MezonTopupReportResponse
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Failed to load Mezon top-up report')
  }
  return result.data
}

export async function downloadMezonTopupReport(
  year: number,
  month: number
): Promise<void> {
  const response = await api.get('/api/user/topup/mezon/report', {
    params: { year, month, format: 'pdf' },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mezon-topup-${year}-${String(month).padStart(2, '0')}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
