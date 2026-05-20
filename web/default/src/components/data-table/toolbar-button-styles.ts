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
 * Default styles for data-table toolbar controls on dark cockpit layouts
 * (dark gradient shell with light-theme CSS variables).
 */
export const dataTableFilterTriggerClassName = cn(
  'h-8 border-dashed',
  'border-white/15 bg-slate-900/70 text-slate-100',
  'hover:bg-white/15 hover:text-white',
  'aria-expanded:border-white/15 aria-expanded:bg-white/15 aria-expanded:text-white',
  '[&_svg]:text-slate-300',
  'hover:[&_svg]:text-white aria-expanded:[&_svg]:text-white',
  'disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-300 disabled:opacity-60'
)

export const dataTableResetGhostClassName = cn(
  'gap-1 px-2',
  'border border-white/15 bg-white/10 text-slate-100',
  'hover:border-white/15 hover:bg-white/15 hover:text-white',
  '[&_svg]:text-slate-300',
  'hover:[&_svg]:text-white'
)

export const dataTableResetOutlineClassName = cn(
  'border-white/15 bg-slate-900/70 text-slate-100',
  'hover:bg-white/15 hover:text-white',
  'disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-300 disabled:opacity-60'
)

/** Column visibility ("View") trigger on data-table toolbars. */
export const dataTableViewTriggerClassName = cn(
  'shrink-0',
  'border-white/15 bg-slate-900/70 text-slate-100',
  'hover:bg-white/15 hover:text-white',
  'aria-expanded:border-white/15 aria-expanded:bg-white/15 aria-expanded:text-white',
  '[&_svg]:text-slate-300',
  'hover:[&_svg]:text-white aria-expanded:[&_svg]:text-white',
  'disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-300 disabled:opacity-60',
  'data-disabled:border-white/10 data-disabled:bg-white/10 data-disabled:text-slate-300 data-disabled:opacity-60'
)
