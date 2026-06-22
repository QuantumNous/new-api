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

/** Dashboard display-only: raw 词元额度 (no currency symbol). */
export function formatQuotaForCockpit(value: number): string {
  return formatTokenQuotaDisplay(value, { digitsLarge: 0 })
}

export const COCKPIT_PANEL_CLASS =
  'border-[#DBEAFE]/80 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

export const COCKPIT_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-[#DBEAFE]/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

/** KPI grid item surface inside summary section. */
export const COCKPIT_STAT_CARD_CLASS =
  'rounded-xl border border-[#DBEAFE]/70 bg-white p-3'

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
