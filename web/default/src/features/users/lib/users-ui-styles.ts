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
  opsConsoleDropdownMenuContentClassName,
  opsConsoleDropdownMenuItemClassName,
  opsConsoleFilterToolbarClassName,
  opsConsoleGhostIconButtonClassName,
  opsConsoleOutlineButtonClassName,
  opsConsoleTableBodyRowClassName,
  opsConsoleTableHeaderClassName,
  opsConsoleTableSelectedRowClassName,
  opsConsoleTableShellClassName,
  opsConsoleTableStickyActionsCellClassName,
  opsConsoleTableStickyActionsHeaderClassName,
} from '@/lib/ops-ui-styles'

export const usersToolbarClassName = opsConsoleFilterToolbarClassName

export const usersTableHeaderClassName = cn(
  opsConsoleTableHeaderClassName,
  '[&_[data-slot=table-head]_div]:!font-semibold [&_[data-slot=table-head]_div]:!text-slate-700',
  '[&_[data-slot=table-head]_span]:!font-semibold [&_[data-slot=table-head]_span]:!text-slate-700',
  '[&_button]:font-semibold [&_button]:!text-slate-700',
  '[&_button:hover]:!text-blue-700',
  '[&_button:hover_svg]:!text-blue-600'
)

export const usersDisabledRowClassName = cn(
  '[&>td:first-child]:border-l-muted-foreground/35 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1',
  'bg-slate-50/90 hover:bg-slate-100/80 text-slate-500',
  '[&_.text-muted-foreground]:text-slate-400'
)

export const usersSelectedRowClassName = cn(
  opsConsoleTableSelectedRowClassName,
  'data-[state=selected]:!border-blue-200/80',
  '[&[data-state=selected]_span.text-muted-foreground]:!text-slate-500',
  '[&[data-state=selected]_[data-slot=progress]]:opacity-100',
  '[&[data-state=selected]_[data-slot=checkbox][data-state=checked]]:border-blue-500',
  '[&[data-state=selected]_[data-slot=checkbox][data-state=checked]]:bg-blue-600'
)

export const usersTableClassName = cn(
  opsConsoleTableShellClassName,
  opsConsoleTableStickyActionsHeaderClassName,
  opsConsoleTableStickyActionsCellClassName,
  opsConsoleTableBodyRowClassName
)

export const usersActionsTriggerClassName = cn(
  'h-8 min-w-[5.5rem] gap-1.5 px-2.5',
  opsConsoleOutlineButtonClassName,
  'data-popup-open:border-blue-300 data-popup-open:bg-blue-50 data-popup-open:text-blue-700'
)

export const usersDropdownMenuContentClassName =
  opsConsoleDropdownMenuContentClassName

export const usersDropdownMenuItemClassName = cn(
  opsConsoleDropdownMenuItemClassName,
  'font-medium focus:bg-blue-50'
)

export const usersGhostIconButtonClassName = opsConsoleGhostIconButtonClassName
