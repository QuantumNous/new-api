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
import { formatQuota } from '@/lib/format'

/** Dashboard display-only: normalize quota/currency strings to RMB presentation. */
export function formatQuotaForCockpit(value: number): string {
  return formatQuota(value)
    .replace(/\$/g, '¥')
    .replace(/\bUSD\b/gi, 'CNY')
    .replace(/美元/g, '人民币')
    .replace(/\bdollars?\b/gi, '人民币')
}

export const COCKPIT_PANEL_CLASS =
  'border-violet-500/20 bg-slate-900/60 text-slate-100 shadow-lg shadow-indigo-950/20 backdrop-blur-sm'

export const COCKPIT_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-violet-500/20 bg-slate-900/60 shadow-lg shadow-indigo-950/20 backdrop-blur-sm'
