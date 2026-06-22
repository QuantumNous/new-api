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

/**
 * Default styles for data-table toolbar controls on light ops console layouts.
 */
export const dataTableFilterTriggerClassName = cn(
  'h-8 border-dashed',
  'border-[#DBEAFE] bg-white text-slate-700',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  'aria-expanded:border-blue-200 aria-expanded:bg-blue-50 aria-expanded:text-blue-700',
  '[&_svg]:text-slate-500',
  'hover:[&_svg]:text-blue-600 aria-expanded:[&_svg]:text-blue-600',
  'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60'
)

/** Filter controls on light ops console layouts. */
const dataTableFilterControlBaseClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-800 shadow-none',
  'placeholder:text-slate-400',
  'hover:border-blue-200 hover:bg-blue-50/50',
  'focus-visible:border-blue-300 focus-visible:ring-1 focus-visible:ring-blue-200/80'
)

/** Filter text inputs — overrides default Input border/placeholder. */
export const dataTableFilterSearchInputClassName = cn(
  'h-8',
  dataTableFilterControlBaseClassName
)

/** Filter Select triggers. */
export const dataTableFilterSelectTriggerClassName = cn(
  'h-8 w-full min-w-[7.5rem] justify-between gap-2 px-2.5 py-0 font-normal',
  dataTableFilterControlBaseClassName,
  'data-placeholder:text-slate-400',
  '[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-slate-800',
  '[&_svg]:pointer-events-none [&_svg]:!size-4 [&_svg]:shrink-0 [&_svg]:!text-slate-500 [&_svg]:!opacity-100',
  'aria-expanded:border-blue-300 aria-expanded:bg-blue-50/60'
)

/** Date-range popover trigger on filter toolbars. */
export const dataTableFilterDateTriggerClassName = cn(
  'h-8 w-full justify-start gap-2 px-2.5 font-mono text-xs font-normal',
  dataTableFilterControlBaseClassName,
  '[&_svg]:!text-slate-500 [&_svg]:!opacity-100'
)

export const dataTableResetGhostClassName = cn(
  'gap-1 px-2',
  'border border-[#DBEAFE] bg-white text-slate-700',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  '[&_svg]:text-slate-500',
  'hover:[&_svg]:text-blue-600'
)

export const dataTableResetOutlineClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-700',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60'
)

/** Column visibility ("View") trigger on data-table toolbars. */
export const dataTableViewTriggerClassName = cn(
  'shrink-0',
  'border-[#DBEAFE] bg-white text-slate-700',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  'aria-expanded:border-blue-200 aria-expanded:bg-blue-50 aria-expanded:text-blue-700',
  '[&_svg]:text-slate-500',
  'hover:[&_svg]:text-blue-600 aria-expanded:[&_svg]:text-blue-600',
  'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60',
  'data-disabled:border-slate-200 data-disabled:bg-slate-50 data-disabled:text-slate-400 data-disabled:opacity-60'
)

/** Table footer pagination on light ops console layouts. */
export const dataTablePaginationTextClassName = 'text-slate-600'

export const dataTablePaginationSelectTriggerClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-700',
  'data-placeholder:text-slate-400',
  '[&_[data-slot=select-value]]:text-slate-700',
  '[&_svg]:!text-slate-500'
)

export const dataTablePaginationSelectContentClassName = cn(
  'border border-[#DBEAFE] bg-white text-slate-800 ring-blue-100/50',
  '[&_[data-slot=select-item]]:text-slate-700',
  'focus:[&_[data-slot=select-item]]:bg-blue-50',
  'focus:[&_[data-slot=select-item]]:text-blue-700'
)

export const dataTablePaginationSelectItemClassName = cn(
  'text-slate-700 focus:bg-blue-50 focus:text-blue-700'
)

export const dataTablePaginationOutlineButtonClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-700',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  '[&_svg]:text-slate-500',
  'hover:[&_svg]:text-blue-600',
  'disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50',
  'disabled:text-slate-400 disabled:opacity-60',
  'disabled:[&_svg]:text-slate-400'
)

export const dataTablePaginationActivePageClassName = cn(
  'border-blue-500/50 bg-blue-600 text-white',
  'hover:bg-blue-500 hover:text-white'
)
