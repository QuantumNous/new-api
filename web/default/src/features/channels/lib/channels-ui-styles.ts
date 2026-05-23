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
import {
  dataTablePaginationOutlineButtonClassName,
  dataTablePaginationTextClassName,
} from '@/components/data-table/toolbar-button-styles'
import { systemSettingsOutlineButtonClassName } from '@/lib/ops-ui-styles'

export {
  CHANNEL_BILLING_GROUP_PRICING_PATH,
  CHANNEL_BILLING_MODEL_PRICING_PATH,
} from './channel-error-display'

export const channelsToolbarClassName = cn(
  '[&_input]:border-white/15 [&_input]:bg-slate-950/50 [&_input]:text-slate-100',
  '[&_input::placeholder]:text-slate-500'
)

export const channelsTableHeaderClassName = cn(
  'bg-slate-900/80 text-slate-200',
  '[&_th]:border-white/10 [&_th]:text-slate-100',
  '[&_th_.font-semibold]:text-slate-100',
  '[&_th_button]:text-slate-100 [&_th_button]:hover:text-white',
  '[&_th_button]:hover:bg-white/10',
  '[&_th_svg]:text-slate-300 [&_th_button:hover_svg]:text-slate-100',
  '[&_[data-slot=checkbox]]:border-white/25'
)

export const channelsDisabledRowDesktopClassName = cn(
  '[&>td:first-child]:border-l-slate-500/50 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1',
  'bg-slate-900/55 hover:bg-slate-900/65 text-slate-300',
  '[&_.text-muted-foreground]:text-slate-400'
)

export const channelsDisabledRowMobileClassName = cn(
  'border-l-4 border-l-slate-500/50 bg-slate-900/55 text-slate-300'
)

export const channelsSelectedRowClassName = cn(
  'data-[state=selected]:!bg-cyan-500/10',
  'data-[state=selected]:hover:!bg-cyan-500/15',
  'data-[state=selected]:!text-slate-100',
  'data-[state=selected]:ring-1 data-[state=selected]:ring-cyan-400/30',
  '[&[data-state=selected]_.text-muted-foreground]:!text-slate-300',
  '[&[data-state=selected]_[data-slot=checkbox]]:border-cyan-400/50'
)

export const channelsTableClassName = cn(
  'border-white/10 bg-slate-900/40 text-slate-100',
  '[&_[data-slot=empty-title]]:text-slate-100',
  '[&_[data-slot=empty-description]]:text-slate-400',
  '[&_[data-slot=empty-icon]]:text-slate-300',
  '[&_[data-slot=table-container]]:overflow-x-auto',
  '[&_[data-slot=table-container]]:overscroll-x-contain',
  '[&_[data-slot=table]]:min-w-max',
  '[&_[data-slot=table-row]:hover]:!bg-white/5',
  '[&_[data-slot=table-row][data-state=selected]]:!bg-cyan-500/10',
  '[&_[data-slot=table-row][data-state=selected]:hover]:!bg-cyan-500/15',
  '[&_[data-slot=table-row][data-state=selected]]:!text-slate-100',
  '[&_[data-slot=table-row][data-state=selected]_.text-muted-foreground]:!text-slate-300',
  '[&_[data-slot=table-row][data-state=selected]_[data-slot=checkbox]]:border-cyan-400/50',
  '[&_[data-slot=table-cell]]:text-slate-100',
  '[&_.text-muted-foreground]:text-slate-300',
  '[&_[data-slot=checkbox]]:border-white/25',
  '[&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:z-20',
  '[&_th:last-child]:border-l [&_th:last-child]:border-white/10',
  '[&_th:last-child]:bg-slate-900/95',
  '[&_th:last-child]:shadow-[-10px_0_16px_-10px_rgba(0,0,0,0.65)]',
  '[&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:z-10',
  '[&_td:last-child]:border-l [&_td:last-child]:border-white/10',
  '[&_td:last-child]:bg-slate-900/95',
  '[&_td:last-child]:shadow-[-10px_0_16px_-10px_rgba(0,0,0,0.65)]',
  '[&_[data-slot=table-row][data-state=selected]_td:last-child]:!bg-slate-900',
  '[&_[data-slot=table-row]:hover_td:last-child]:bg-slate-900'
)

export const channelsBulkPanelClassName = cn(
  'border-white/10 bg-slate-950/90 shadow-black/40 backdrop-blur-md'
)

export const channelsBulkCountTextClassName = 'text-slate-100'

export const channelsBulkClearButtonClassName = cn(
  'border-white/15 bg-white/10 text-slate-100',
  '[&_svg]:text-slate-100',
  'hover:bg-white/15 hover:text-white hover:[&_svg]:text-white',
  'disabled:bg-white/5 disabled:text-slate-400 disabled:border-white/10 disabled:opacity-60'
)

export const channelsBulkIconButtonClassName = cn(
  'size-8 border-white/15 bg-white/10 text-slate-100',
  '[&_svg]:text-slate-100',
  'hover:bg-white/15 hover:text-white hover:[&_svg]:text-white',
  'disabled:pointer-events-auto disabled:bg-white/5 disabled:text-slate-400',
  'disabled:border-white/10 disabled:opacity-60 disabled:[&_svg]:text-slate-400'
)

export const channelsBulkDeleteButtonClassName = cn(
  'size-8 border-red-400/30 bg-red-500/10 text-red-300',
  '[&_svg]:text-red-300',
  'hover:bg-red-500/15 hover:text-red-200 hover:[&_svg]:text-red-200',
  'disabled:pointer-events-auto disabled:bg-white/5 disabled:text-slate-400',
  'disabled:border-white/10 disabled:opacity-60 disabled:[&_svg]:text-slate-400'
)

export const channelTestDialogContentClassName = cn(
  'border-white/10 bg-slate-950 text-slate-100',
  '[&_[data-slot=dialog-title]]:text-slate-50',
  '[&_[data-slot=dialog-description]]:text-slate-300',
  '[&_[data-slot=form-label]]:text-slate-200',
  '[&_.text-muted-foreground]:text-slate-300',
  '[&_input]:border-white/15 [&_input]:bg-slate-900/80 [&_input]:text-slate-100',
  '[&_input::placeholder]:text-slate-400'
)

export const channelTestDialogTableScopeClassName = cn(
  'overflow-hidden rounded-md border border-white/10 bg-slate-900/60',
  '[&_[data-slot=table]]:text-slate-100',
  '[&_thead]:bg-slate-900/95 [&_thead]:text-slate-200',
  '[&_th]:border-white/10 [&_th]:text-slate-200',
  '[&_tbody_tr]:border-white/10',
  '[&_tbody_tr:hover]:bg-white/[0.05]',
  '[&_[data-slot=table-row][data-state=selected]]:!bg-cyan-500/10',
  '[&_[data-slot=table-row][data-state=selected]:hover]:!bg-cyan-500/15',
  '[&_[data-slot=table-row][data-state=selected]]:!text-slate-100',
  '[&_[data-slot=table-row][data-state=selected]_.text-muted-foreground]:!text-slate-300',
  '[&_.text-muted-foreground]:text-slate-300',
  '[&_[data-slot=checkbox]]:border-white/25'
)

export const channelTestDialogPaginationClassName = dataTablePaginationTextClassName

export const channelTestDialogOutlineButtonClassName =
  systemSettingsOutlineButtonClassName

export const channelTestDialogPaginationButtonClassName =
  dataTablePaginationOutlineButtonClassName
