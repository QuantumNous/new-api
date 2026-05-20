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
/**
 * Dark ops-center UI tokens for application access keys (/keys).
 */
import { cn } from '@/lib/utils'

export const keysFilterToolbarClassName = cn(
  '[&_input]:border-white/15 [&_input]:bg-slate-950/50 [&_input]:text-slate-100',
  '[&_input::placeholder]:text-slate-400',
  '[&_button]:border-white/15 [&_button]:bg-slate-950/30 [&_button]:text-slate-100',
  '[&_button_svg]:text-slate-400',
  '[&_button:hover]:border-white/25 [&_button:hover]:bg-white/5 [&_button:hover]:text-white',
  '[&_button:hover_svg]:text-slate-200'
)

export const keysTableHeaderClassName = cn(
  'sticky top-0 z-10 border-b border-white/10 bg-slate-900/80',
  '[&_th]:text-slate-100',
  '[&_th_button]:font-medium [&_th_button]:text-slate-100',
  '[&_th_button:hover]:bg-white/10 [&_th_button:hover]:text-white',
  '[&_th_svg]:text-slate-300',
  '[&_[data-slot=checkbox]]:border-white/25'
)

export const keysColumnHeaderClassName = cn(
  'font-medium text-slate-100',
  '[&_button]:text-slate-100',
  '[&_svg]:text-slate-300'
)

export const keysTableClassName = cn(
  'border-white/10 bg-slate-900/40',
  '[&_[data-slot=empty-title]]:text-slate-100',
  '[&_[data-slot=empty-description]]:text-slate-400',
  '[&_[data-slot=empty-icon]]:text-slate-300'
)

export const keysMobileShellClassName =
  'overflow-hidden rounded-lg border border-white/10 bg-slate-900/40'

export const keysTablePrimaryClass = 'text-slate-100'

export const keysTableMetaClass = 'text-xs font-medium text-slate-300'

export const keysTableEmptyClass = 'text-xs text-slate-400'

export const keysCheckboxClassName =
  'translate-y-[2px] border-white/25 data-[state=checked]:border-indigo-400 data-[state=checked]:bg-indigo-500/80'

export const keysGhostIconButtonClassName = cn(
  'text-slate-300 hover:bg-white/10 hover:text-slate-100',
  'disabled:text-slate-500'
)

export const keysOutlineIconButtonClassName = cn(
  'border-white/15 bg-slate-950/30 text-slate-100',
  'hover:border-white/25 hover:bg-white/5 hover:text-white',
  '[&_svg]:text-slate-300'
)

export const keysBulkPanelClassName = cn(
  'border-white/15 bg-slate-900/95 text-slate-100 shadow-lg',
  '[&_button]:text-slate-200'
)

export const keysBulkCountTextClassName = 'text-slate-200'

export const keysDialogTitleClassName = 'text-base font-semibold text-slate-950'

export const keysDialogDescriptionClassName = 'text-sm text-slate-600'

export const keysSheetSectionClassName = cn(
  'rounded-lg border border-slate-200 bg-white',
  '[&_h3]:text-slate-900 [&_p]:text-slate-600'
)

export const keysSheetInputClassName = cn(
  'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
)

export const keysPopoverPanelClassName =
  'border-slate-200 bg-white text-slate-900'

export const keysTooltipContentClassName =
  'border-slate-200 bg-white text-slate-900'
