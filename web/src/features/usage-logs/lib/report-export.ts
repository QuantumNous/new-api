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
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { quotaUnitsToDollars } from '@/lib/format'

export function buildUsageReportCsv(
  rows: Array<{ date: string; requests: number; tokens: number; quota: number }>
): string {
  const { meta } = getCurrencyDisplay()
  const unit =
    meta.kind === 'tokens' ? 'Quota (tokens)' : `Billed (${getCurrencyLabel()})`
  const header =
    unit.includes(',') || unit.includes('"') || unit.includes('\n')
      ? `"${unit.replaceAll('"', '""')}"`
      : unit
  const body = rows
    .map(
      (row) =>
        `${row.date},${row.requests},${row.tokens},${quotaUnitsToDollars(row.quota)}`
    )
    .join('\n')
  return `Date,Requests,Tokens,${header}\n${body}\n`
}
