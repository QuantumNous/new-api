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
import { cn } from '@/lib/utils'

/** Reference mockup page canvas */
export const OVERVIEW_PAGE_CLASS = 'flex flex-col gap-2.5'

/** Standard white KPI / panel card */
export const OVERVIEW_CARD_CLASS = cn(
  'rounded-lg border border-[#EBEEF2] bg-white',
  'shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
)

/** Compact KPI tile (row 1 & row 2 small cards) */
export const OVERVIEW_KPI_TILE_CLASS = cn(
  OVERVIEW_CARD_CLASS,
  'flex min-h-[4rem] flex-col justify-between gap-1 p-2.5'
)

/** Wide quota card — spans 2 columns in 4-col grid */
export const OVERVIEW_QUOTA_TILE_CLASS = cn(
  OVERVIEW_CARD_CLASS,
  'col-span-2 flex min-h-[4rem] items-stretch justify-between gap-2 p-2.5 sm:gap-3 sm:p-3'
)

/** Middle chart row — trend ~2/3, channel health ~1/3 */
export const OVERVIEW_MIDDLE_ROW_CLASS =
  'grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-stretch'

/** Middle row chart / channel body — balanced main analysis layer */
export const OVERVIEW_MIDDLE_BODY_CLASS =
  'relative h-[148px] w-full shrink-0 px-3 pb-2 pt-1 sm:px-4'

/** @deprecated alias — use OVERVIEW_MIDDLE_BODY_CLASS */
export const OVERVIEW_CHART_BODY_CLASS = OVERVIEW_MIDDLE_BODY_CLASS

/** Bottom row — 24h overview + tenant ranking */
export const OVERVIEW_BOTTOM_ROW_CLASS =
  'grid grid-cols-1 gap-2 lg:grid-cols-2 lg:items-stretch'

/** Bottom panel content area — third layer presence */
export const OVERVIEW_BOTTOM_PANEL_BODY_CLASS = 'min-h-[6.25rem]'

export const OVERVIEW_SECTION_MIN_HEIGHT = 'min-h-0'

/** Section card (trend, tables, 24h, ranking) */
export const OVERVIEW_SECTION_CLASS = cn(
  OVERVIEW_CARD_CLASS,
  'overflow-hidden'
)

export const OVERVIEW_SECTION_HEADER_CLASS =
  'flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F2F5] px-4 py-2.5'

/** Compact header for middle row (trend + channel health) */
export const OVERVIEW_MIDDLE_SECTION_HEADER_CLASS =
  'flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F2F5] px-4 py-2.5'

/** Bottom row section headers — stronger third-layer presence */
export const OVERVIEW_BOTTOM_SECTION_HEADER_CLASS =
  'flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F2F5] bg-[#FAFBFC] px-4 py-2.5'

export const OVERVIEW_SECTION_TITLE_CLASS =
  'text-[15px] font-semibold text-[#1F2937]'

export const OVERVIEW_MIDDLE_SECTION_TITLE_CLASS =
  'text-[14px] font-semibold text-[#1F2937]'

export const OVERVIEW_LINK_CLASS =
  'text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] hover:underline'

export const OVERVIEW_TAB_LIST_CLASS =
  'inline-flex gap-0.5 rounded-md bg-[#F3F4F6] p-0.5'

export const OVERVIEW_TAB_ACTIVE_CLASS =
  'rounded bg-white px-3 py-1 text-[13px] font-medium text-[#2563EB] shadow-sm'

export const OVERVIEW_TAB_INACTIVE_CLASS =
  'rounded px-3 py-1 text-[13px] font-medium text-[#6B7280] hover:text-[#374151]'

export const OVERVIEW_CONTROL_SELECT_CLASS = cn(
  'inline-flex h-8 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5',
  'text-[13px] font-medium text-[#374151] shadow-sm'
)

export const OVERVIEW_CONTROL_BUTTON_CLASS = cn(
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3',
  'text-[13px] font-medium text-[#374151] shadow-sm hover:bg-[#F9FAFB]'
)

export const OVERVIEW_STATUS_PILL_CLASS = cn(
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3',
  'text-[13px] font-medium text-[#374151] shadow-sm'
)

/** Compact header controls — dense title toolbar */
export const OVERVIEW_HEADER_CONTROL_SELECT_CLASS = cn(
  'inline-flex h-6 items-center gap-0.5 rounded-md border border-[#E5E7EB] bg-white px-1.5',
  'text-[11px] font-medium leading-none text-[#374151] shadow-sm'
)

export const OVERVIEW_HEADER_CONTROL_BUTTON_CLASS = cn(
  'inline-flex h-6 items-center gap-0.5 rounded-md border border-[#E5E7EB] bg-white px-2',
  'text-[11px] font-medium leading-none text-[#374151] shadow-sm hover:bg-[#F9FAFB]'
)

export const OVERVIEW_HEADER_STATUS_PILL_CLASS = cn(
  'inline-flex h-6 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2',
  'text-[11px] font-medium leading-none text-[#374151] shadow-sm'
)

export const OVERVIEW_HEADER_PRIMARY_BUTTON_CLASS = cn(
  'inline-flex h-7 items-center justify-center rounded-md bg-[#2563EB] px-3',
  'text-[12px] font-medium leading-none text-white shadow-sm hover:bg-[#1D4ED8]'
)

export const OVERVIEW_PRIMARY_BUTTON_CLASS = cn(
  'inline-flex h-9 items-center justify-center rounded-md bg-[#2563EB] px-5',
  'text-[13px] font-medium text-white shadow-sm hover:bg-[#1D4ED8]'
)

export const OVERVIEW_TABLE_HEAD_CLASS =
  'border-b border-[#F0F2F5] bg-[#FAFBFC] text-[12px] font-medium text-[#6B7280]'

export const OVERVIEW_TABLE_ROW_CLASS =
  'border-b border-[#F5F6F8] last:border-0 hover:bg-[#F8FAFC]'
