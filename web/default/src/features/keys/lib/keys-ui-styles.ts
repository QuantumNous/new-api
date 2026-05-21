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

/** Header alignment — matches cell wrappers in api-keys-columns */
export const keysHeaderLeftClassName = cn(
  keysColumnHeaderClassName,
  'flex w-full min-w-0 items-center justify-start text-left',
  '[&_button]:-ms-0 [&_button]:px-1'
)

export const keysHeaderCenterClassName = cn(
  keysColumnHeaderClassName,
  'flex w-full min-w-0 items-center justify-center text-center',
  '[&_button]:-ms-0 [&_button]:justify-center [&_button]:gap-1 [&_button]:px-1',
  '[&_svg]:!ms-1'
)

/** Title visually centered; sort icon anchored to title's right edge */
export const keysHeaderVisualCenterClassName =
  'relative flex w-full min-w-0 items-center justify-center'

export const keysHeaderSortButtonClassName = cn(
  'relative h-8 shrink-0 px-1.5 font-medium text-slate-100',
  'hover:bg-white/10 hover:text-white',
  'data-popup-open:bg-white/10'
)

export const keysHeaderSortIconClassName =
  'pointer-events-none absolute start-full top-1/2 ms-0.5 size-4 -translate-y-1/2 text-slate-300'

/** Access key cell: masked key centered, copy icon beside key (not in center calc) */
export const keysAccessKeyCellClassName =
  'relative flex w-full min-w-0 justify-center'

export const keysAccessKeyInnerClassName = 'relative inline-flex max-w-full items-center'

export const keysCellLeftClassName =
  'flex w-full min-w-0 items-center justify-start text-left'

export const keysCellCenterClassName =
  'flex w-full min-w-0 items-center justify-center text-center'

export const keysTableClassName = cn(
  'border-white/10 bg-slate-900/40',
  '[&_[data-slot=table-container]]:overflow-x-auto',
  '[&_[data-slot=table]]:table-fixed',
  '[&_[data-slot=table]]:!w-max',
  '[&_[data-slot=table]]:min-w-[1647px]',
  '[&_th]:box-border [&_th]:px-2.5 [&_th]:py-1.5',
  '[&_td]:box-border [&_td]:px-2.5 [&_td]:py-1.5',
  '[&_th:has([role=checkbox])]:px-1.5 [&_td:has([role=checkbox])]:px-1.5',
  '[&_th:nth-child(2)]:text-center [&_th:nth-child(3)]:text-center [&_th:nth-child(4)]:text-center',
  '[&_td:nth-child(2)]:text-center [&_td:nth-child(3)]:text-center [&_td:nth-child(4)]:text-center',
  '[&_[data-slot=empty-title]]:text-slate-100',
  '[&_[data-slot=empty-description]]:text-slate-400',
  '[&_[data-slot=empty-icon]]:text-slate-300'
)

/** Sticky actions column — narrow, blends with row background */
export const keysActionsStickyCellClassName = cn(
  'relative sticky right-0 z-10 box-border',
  'w-[68px] min-w-[64px] max-w-[72px] !px-2',
  'border-l border-white/10 bg-slate-900/95'
)

/** Actions header — matches cell width and padding */
export const keysTableActionsHeaderClassName = cn(
  '[&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:z-20',
  '[&_th:last-child]:box-border',
  '[&_th:last-child]:w-[68px] [&_th:last-child]:min-w-[64px] [&_th:last-child]:max-w-[72px]',
  '[&_th:last-child]:!px-2 [&_th:last-child]:text-center',
  '[&_th:last-child]:border-l [&_th:last-child]:border-white/10',
  '[&_th:last-child]:bg-slate-900/95'
)

export const keysActionsHeaderClassName = cn(
  'flex w-full items-center justify-center text-sm font-medium',
  keysColumnHeaderClassName
)

/** Base row — overrides global TableRow muted/primary tints */
export const keysTableRowBaseClassName = cn(
  'border-b border-white/10 transition-colors',
  'hover:!bg-white/5',
  'has-aria-expanded:!bg-slate-800/60',
  'data-[state=selected]:!bg-cyan-500/10',
  'data-[state=selected]:hover:!bg-cyan-500/15',
  'data-[state=selected]:!text-slate-100',
  '[&>td]:align-middle',
  '[&>td]:!text-slate-100',
  '[&>td_span]:!text-slate-100',
  '[&>td_p]:!text-slate-100',
  '[&>td_.text-muted-foreground]:!text-slate-300',
  '[&>td_.text-slate-700]:!text-slate-100',
  '[&[data-state=selected]>td:last-child]:!bg-slate-900'
)

/** Disabled key rows — dark only, no light gray wash */
export const keysDisabledRowDesktopClassName = cn(
  '[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-slate-500/50 [&>td:first-child]:pl-1',
  '!bg-slate-900/60 hover:!bg-slate-800/60',
  'data-[state=selected]:!bg-cyan-500/10',
  'data-[state=selected]:hover:!bg-cyan-500/15',
  '[&>td]:opacity-100',
  '[&>td:last-child]:!bg-slate-900/95'
)

export const keysDisabledRowMobileClassName = cn(
  'border-l-4 border-l-slate-500/50 !bg-slate-900/60'
)

export const keysSelectedRowClassName = cn(
  'data-[state=selected]:!bg-cyan-500/10',
  'data-[state=selected]:hover:!bg-cyan-500/15',
  'data-[state=selected]:!text-slate-100',
  'data-[state=selected]:ring-1 data-[state=selected]:ring-cyan-400/25'
)

/** Actions button row inside sticky cell */
export const keysActionsCellClassName =
  'relative z-[1] flex w-full items-center justify-center gap-0'

/** Dev-only: third-party chat client menu (VITE_KEYS_SHOW_DEV_CLIENT_MENU=true) */
export const keysShowDevClientMenu =
  typeof import.meta !== 'undefined' &&
  import.meta.env.VITE_KEYS_SHOW_DEV_CLIENT_MENU === 'true'

export const keysDropdownMenuContentClassName = cn(
  'min-w-[220px] border border-white/10 bg-slate-950/95 p-1 text-slate-100 shadow-2xl ring-1 ring-white/10'
)

export const keysDropdownMenuItemClassName = cn(
  'text-slate-100 focus:bg-white/10 focus:text-slate-100',
  'data-[variant=destructive]:text-rose-300 data-[variant=destructive]:focus:bg-rose-500/15 data-[variant=destructive]:focus:text-rose-200',
  '[&_svg]:text-slate-400'
)

export const keysDropdownMenuSubTriggerClassName = cn(
  'text-slate-100 focus:bg-white/10 focus:text-slate-100',
  '[&_svg]:text-slate-400'
)

export const keysDropdownMenuSubContentClassName = keysDropdownMenuContentClassName

export const keysDropdownMenuSeparatorClassName = 'bg-white/10'

export const keysDropdownMenuShortcutClassName = 'text-slate-500'

/** Subdued group ratio badge (keys table only) */
export const keysGroupRatioBadgeClassName = cn(
  'inline-flex shrink-0 cursor-default items-center rounded border border-white/10',
  'bg-white/5 px-0.5 py-px font-mono text-[9px] leading-none tabular-nums text-slate-400'
)

export const keysMobileShellClassName =
  'overflow-hidden rounded-lg border border-white/10 bg-slate-900/40'

export const keysTablePrimaryClass = 'text-slate-100'

export const keysTableMetaClass = 'text-xs font-medium text-slate-300'

export const keysTableEmptyClass = 'text-xs text-slate-400'

export const keysCheckboxClassName =
  'translate-y-[2px] border-white/25 data-[state=checked]:border-indigo-400 data-[state=checked]:bg-indigo-500/80'

export const keysGhostIconButtonClassName = cn(
  'text-slate-200 hover:bg-white/10 hover:text-slate-100',
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

/** Drawer helper text — readable on light sheet background */
export const keysSheetFormDescriptionClassName =
  'text-xs leading-relaxed text-slate-600'

export const keysSheetSectionDescClassName =
  'mt-0.5 text-xs leading-relaxed text-slate-600 sm:mt-1'

export const keysSheetInputClassName = cn(
  'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
)

export const keysPopoverPanelClassName =
  'border-slate-200 bg-white text-slate-900'

export const keysTooltipContentClassName = cn(
  'border border-white/10 bg-slate-950/95 text-slate-100 shadow-lg'
)
