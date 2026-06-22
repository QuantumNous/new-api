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
import { formatTokenQuotaDisplay } from '@/lib/ops-billing-display'
import { cn } from '@/lib/utils'

/** Dashboard display-only: raw 词元额度 (no currency symbol). */
export function formatQuotaForCockpit(value: number): string {
  return formatTokenQuotaDisplay(value, { digitsLarge: 0 })
}

export const COCKPIT_PANEL_CLASS =
  'border-[#DBEAFE]/80 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

export const COCKPIT_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-[#DBEAFE]/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

/** Compact KPI tile — reference layout (dense, icon + value + sparkline). */
export const OVERVIEW_KPI_CARD_CLASS = cn(
  'rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
)

/** Horizontal quota balance banner spanning bottom KPI row. */
export const OVERVIEW_QUOTA_BANNER_CLASS = cn(
  'flex flex-col gap-3 rounded-lg border border-[#DBEAFE] bg-gradient-to-r from-white via-[#F8FBFF] to-[#EFF6FF]/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between sm:p-4 xl:col-span-8'
)

/** Segmented health bar for channel KPI. */
export const OVERVIEW_CHANNEL_SEGMENTS_CLASS =
  'flex h-2 overflow-hidden rounded-full bg-slate-100'

/** KPI grid item surface inside summary section. */
export const COCKPIT_STAT_CARD_CLASS =
  'rounded-lg border border-[#E5E7EB] bg-white p-3'

/** Outer wrapper for KPI + balance column. */
export const COCKPIT_SECTION_CLASS =
  'overflow-hidden rounded-2xl border border-[#DBEAFE]/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

/** Right-hand token balance column in summary cards. */
export const COCKPIT_BALANCE_PANEL_CLASS =
  'flex flex-col justify-between gap-4 border-t border-[#DBEAFE]/70 bg-[#EFF6FF]/60 p-4 sm:p-5 xl:border-t-0 xl:border-l xl:border-[#DBEAFE]/70'

/** Hero banner at top of overview. */
export const COCKPIT_HEADER_CLASS =
  'relative overflow-hidden rounded-2xl border border-[#DBEAFE]/80 bg-gradient-to-br from-white via-[#F8FBFF] to-[#EFF6FF]/50 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6'

/** Nested mini stat / inset surfaces inside overview cards. */
export const COCKPIT_INSET_SURFACE_CLASS =
  'rounded-lg border border-[#DBEAFE]/70 bg-[#F8FBFF]'
