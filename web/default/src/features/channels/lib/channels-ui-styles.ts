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
  '[&_input]:border-[#DBEAFE] [&_input]:bg-white [&_input]:text-slate-800',
  '[&_input::placeholder]:text-slate-400'
)

export const channelsTableHeaderClassName = cn(
  'bg-[#F4F8FD] text-slate-700',
  '[&_th]:border-[#DBEAFE] [&_th]:text-slate-700',
  '[&_th_.font-semibold]:text-slate-700',
  '[&_th_button]:text-slate-700 [&_th_button]:hover:text-blue-700',
  '[&_th_button]:hover:bg-blue-50',
  '[&_th_svg]:text-slate-500 [&_th_button:hover_svg]:text-blue-600',
  '[&_[data-slot=checkbox]]:border-slate-300'
)

export const channelsDisabledRowDesktopClassName = cn(
  '[&>td:first-child]:border-l-slate-300 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1',
  'bg-slate-50/90 hover:bg-slate-100/80 text-slate-500',
  '[&_.text-muted-foreground]:text-slate-400'
)

export const channelsDisabledRowMobileClassName = cn(
  'border-l-4 border-l-slate-300 bg-slate-50/90 text-slate-500'
)

export const channelsSelectedRowClassName = cn(
  'data-[state=selected]:!bg-blue-50',
  'data-[state=selected]:hover:!bg-blue-100/60',
  'data-[state=selected]:!text-slate-900',
  'data-[state=selected]:ring-1 data-[state=selected]:ring-blue-200/80',
  '[&[data-state=selected]_.text-muted-foreground]:!text-slate-500',
  '[&[data-state=selected]_[data-slot=checkbox]]:border-blue-400/60'
)

export const channelsTableClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-800',
  '[&_[data-slot=empty-title]]:text-slate-800',
  '[&_[data-slot=empty-description]]:text-slate-500',
  '[&_[data-slot=empty-icon]]:text-slate-400',
  '[&_[data-slot=table-container]]:overflow-x-auto',
  '[&_[data-slot=table-container]]:overscroll-x-contain',
  '[&_[data-slot=table]]:min-w-max',
  '[&_[data-slot=table-row]:hover]:!bg-[#EFF6FF]',
  '[&_[data-slot=table-row][data-state=selected]]:!bg-blue-50',
  '[&_[data-slot=table-row][data-state=selected]:hover]:!bg-blue-100/60',
  '[&_[data-slot=table-row][data-state=selected]]:!text-slate-900',
  '[&_[data-slot=table-row][data-state=selected]_.text-muted-foreground]:!text-slate-500',
  '[&_[data-slot=table-row][data-state=selected]_[data-slot=checkbox]]:border-blue-400/60',
  '[&_[data-slot=table-cell]]:text-slate-800',
  '[&_.text-muted-foreground]:text-slate-500',
  '[&_[data-slot=checkbox]]:border-slate-300',
  '[&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:z-20',
  '[&_th:last-child]:border-l [&_th:last-child]:border-[#DBEAFE]',
  '[&_th:last-child]:bg-[#F4F8FD]',
  '[&_th:last-child]:shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.06)]',
  '[&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:z-10',
  '[&_td:last-child]:border-l [&_td:last-child]:border-[#DBEAFE]',
  '[&_td:last-child]:bg-white',
  '[&_td:last-child]:shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.06)]',
  '[&_[data-slot=table-row][data-state=selected]_td:last-child]:!bg-blue-50',
  '[&_[data-slot=table-row]:hover_td:last-child]:bg-[#EFF6FF]'
)

export const channelsBulkPanelClassName = cn(
  'border-[#DBEAFE] bg-white shadow-lg'
)

export const channelsBulkCountTextClassName = 'text-slate-700'

export const channelsBulkClearButtonClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-700',
  '[&_svg]:text-slate-600',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:[&_svg]:text-blue-600',
  'disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:opacity-60'
)

export const channelsBulkIconButtonClassName = cn(
  'size-8 border-[#DBEAFE] bg-white text-slate-700',
  '[&_svg]:text-slate-600',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:[&_svg]:text-blue-600',
  'disabled:pointer-events-auto disabled:bg-slate-50 disabled:text-slate-400',
  'disabled:border-slate-200 disabled:opacity-60 disabled:[&_svg]:text-slate-400'
)

export const channelsBulkDeleteButtonClassName = cn(
  'size-8 border-rose-200 bg-rose-50 text-rose-600',
  '[&_svg]:text-rose-600',
  'hover:bg-rose-100 hover:text-rose-700 hover:[&_svg]:text-rose-700',
  'disabled:pointer-events-auto disabled:bg-slate-50 disabled:text-slate-400',
  'disabled:border-slate-200 disabled:opacity-60 disabled:[&_svg]:text-slate-400'
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
