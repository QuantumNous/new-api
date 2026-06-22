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
 * Light ops-console UI tokens for usage-logs.
 */
import { cn } from '@/lib/utils'
import {
  opsConsoleOutlineButtonClassName,
  opsConsoleTableBodyRowClassName,
  opsConsoleTableHeaderClassName,
  opsConsoleTableShellClassName,
} from '@/lib/ops-ui-styles'

// —— A/B/C: Filter toolbar controls (40px row, text-sm) —— //

const usageLogsToolbarControlHeightClassName = 'h-10 min-h-10 max-h-10'

const usageLogsFilterTextClassName = cn(
  '!text-sm leading-none',
  'placeholder:!text-sm placeholder:text-slate-400'
)

export const usageLogsFilterControlBaseClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'rounded-md border border-[#DBEAFE] bg-white text-slate-800 shadow-none',
  usageLogsFilterTextClassName,
  'hover:border-blue-200 hover:bg-blue-50/50',
  'focus-visible:border-blue-300 focus-visible:ring-1 focus-visible:ring-blue-200/80'
)

/** Text filter inputs (model, group, token, etc.). */
export const usageLogsFilterSearchInputClassName = cn(
  'w-full min-w-0',
  usageLogsFilterControlBaseClassName
)

/** Select / faceted filter triggers (e.g. log type). */
export const usageLogsFilterSelectTriggerClassName = cn(
  'w-full min-w-[7.5rem] justify-between gap-1.5 px-3 py-0 text-sm font-normal',
  usageLogsFilterControlBaseClassName,
  'data-placeholder:text-slate-400',
  '[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-sm',
  '[&_svg]:pointer-events-none [&_svg]:!size-4 [&_svg]:shrink-0 [&_svg]:text-slate-500'
)

/** Date-range popover trigger (outline Button). */
export const usageLogsFilterDateTriggerClassName = cn(
  'w-full justify-start gap-2 px-3 font-mono text-sm font-normal',
  usageLogsFilterControlBaseClassName
)

/** Right-aligned search icon inside filter text inputs. */
export const usageLogsFilterSearchIconClassName = cn(
  'pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400',
  'group-focus-within:text-blue-500'
)

/** Filter text input with room for right search icon. */
export const usageLogsFilterSearchInputFieldClassName = cn(
  'w-full cursor-text px-3 pr-9 text-left',
  usageLogsFilterSearchInputClassName
)

/** Compact vertical rhythm for common logs filter toolbar. */
export const usageLogsToolbarLayoutClassName = '!gap-1.5'

export const usageLogsToolbarStatsRowClassName = 'flex flex-wrap items-center gap-1.5'

// —— D: Stats toolbar badges (40px, label sm / value 15px) —— //

export const usageLogsStatBadgeClassName = cn(
  'inline-flex items-center gap-2 rounded-md border px-3 shadow-none',
  usageLogsToolbarControlHeightClassName,
  'border-[#DBEAFE] bg-white'
)

export const usageLogsStatBadgeAccentClassName =
  'h-3 w-px shrink-0 rounded-full'

export const usageLogsStatBadgeLabelClassName =
  'shrink-0 text-sm font-normal leading-none text-slate-500'

export const usageLogsStatBadgeValueClassName = cn(
  'font-mono text-[15px] font-semibold leading-none tabular-nums text-slate-800'
)

export const usageLogsToolbarIconButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'w-10 shrink-0 border border-[#DBEAFE] bg-white p-0 text-slate-700',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  '[&_svg]:size-4 [&_svg]:text-slate-500 hover:[&_svg]:text-blue-600'
)

/** Primary apply / query action on usage-logs toolbars. */
export const usageLogsToolbarQueryButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'shrink-0 px-3 text-sm font-medium shadow-sm',
  'border-blue-500/50 bg-blue-600 text-white',
  'hover:border-blue-400/60 hover:bg-blue-500',
  'disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'
)

/** Expand / more-filters toggle on usage-logs toolbars. */
export const usageLogsToolbarExpandButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'shrink-0 gap-1 px-2.5 text-sm text-slate-600',
  'hover:bg-blue-50 hover:text-blue-700',
  'data-[active=true]:text-blue-700'
)

/** Plaintext toggle next to stats — same 40px height as stat badges. */
export const usageLogsToolbarPlaintextButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'shrink-0 gap-1.5 border border-[#DBEAFE] bg-white px-3 text-sm font-normal text-slate-700 shadow-none',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-slate-500',
  'hover:[&_svg]:text-blue-600'
)

// —— E: Table header —— //

export const usageLogsColumnHeaderClassName = 'font-semibold text-slate-700'

export const usageLogsTableHeaderClassName = cn(
  opsConsoleTableHeaderClassName,
  '[&_th]:text-slate-700',
  '[&_th_button]:font-semibold [&_th_button]:text-slate-700',
  '[&_th_div.font-semibold]:text-slate-700'
)

export const usageLogsTableShellClassName = opsConsoleTableShellClassName

// —— F: Table body —— //

export const usageLogsTablePrimaryClass = 'text-slate-800'

export const usageLogsTableMetaClass = 'text-xs font-medium text-slate-500'

export const usageLogsTableEmptyClass = 'text-xs text-slate-500'

export const usageLogsInlinePillClass = cn(
  'inline-flex max-w-[11rem] items-center truncate rounded-md border border-[#DBEAFE]',
  'bg-[#F8FBFF] px-1.5 py-0.5 font-mono text-xs text-slate-700'
)

/** Subscription billing badge on common logs quota column */
export const usageLogsSubscriptionBadgeClassName = cn(
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
  'border-emerald-200 bg-emerald-50 text-emerald-700'
)

/** Masked avatar on ops tables */
export const usageLogsMaskedAvatarClassName =
  'bg-slate-100 text-slate-500 ring-1 ring-[#DBEAFE]'

/** Common logs error/refund row tint — subtle, not full-row blocks */
export const usageLogsCommonRowErrorTintClassName =
  'bg-rose-50/80 hover:bg-rose-50'

export const usageLogsCommonRowRefundTintClassName =
  'bg-cyan-50/80 hover:bg-cyan-50'

/** Common table body cell vertical padding (tighter than task/drawing) */
export const usageLogsCommonTableCellClassName = 'py-1.5 align-middle'

/** Muted log-type chip under timestamp (common logs only) */
export const usageLogsLogTypeBadgeBaseClassName = cn(
  'inline-flex w-fit max-w-[10rem] truncate rounded px-2 py-0.5',
  'text-[11px] font-medium leading-none'
)

/** Truncated badge/pill in table cells */
export const usageLogsTableBadgeMaxClassName = 'max-w-[11rem] truncate'

export const usageLogsDetailSummaryClass =
  'text-sm leading-snug text-slate-600'

/** Task/drawing table rows */
export const usageLogsTableBodyRowClassName = opsConsoleTableBodyRowClassName

export const usageLogsTableClickableLinkClass =
  'text-sm text-blue-600 hover:text-blue-700 hover:underline'

export const usageLogsTableFailReasonClass =
  'truncate text-sm leading-snug text-rose-600 group-hover:underline'

// —— G: Details dialog (light popover) —— //

export const usageLogsDialogTitleClassName =
  'text-base font-semibold text-slate-950'

export const usageLogsDialogLabelClassName =
  'min-w-0 text-sm font-medium text-slate-700'

export const usageLogsDialogValueClassName =
  'max-w-full min-w-0 text-sm break-all text-slate-900 sm:break-words'

export const usageLogsDialogValueMutedClassName =
  'max-w-full min-w-0 text-sm break-all text-slate-600 sm:break-words'

export const usageLogsDialogSectionLabelClassName =
  'flex items-center gap-1.5 text-sm font-semibold text-slate-800'

export const usageLogsDialogSectionPanelClassName = cn(
  'min-w-0 space-y-1 overflow-hidden rounded-md border border-[#DBEAFE] bg-[#F8FBFF] p-2.5 max-sm:p-2'
)

export const usageLogsDialogSectionDangerClassName = cn(
  'min-w-0 space-y-1 overflow-hidden rounded-md border border-red-200 bg-red-50 p-2.5 max-sm:p-2'
)

export const usageLogsDialogSectionDangerLabelClassName =
  'flex items-center gap-1.5 text-sm font-semibold text-red-700'

export const usageLogsDialogContentPanelClassName = cn(
  'relative min-w-0 overflow-hidden rounded-md border border-[#DBEAFE] bg-[#F8FBFF] p-3'
)

export const usageLogsDialogContentTextClassName =
  'min-w-0 pr-8 text-sm leading-relaxed break-all whitespace-pre-wrap text-slate-900 sm:break-words'

export const usageLogsDialogMutedInlineClassName = 'text-slate-600'

export const usageLogsDialogCopyButtonClassName = cn(
  'absolute top-1.5 right-1.5 h-6 w-6 p-0 text-slate-600',
  'hover:bg-blue-50 hover:text-blue-700',
  '[&_svg]:size-3.5 [&_svg]:text-slate-600',
  'hover:[&_svg]:text-blue-600'
)

export const usageLogsDialogCopyButtonInlineClassName = cn(
  'absolute top-0 right-0 h-6 w-6 p-0 text-slate-600',
  'hover:bg-blue-50 hover:text-blue-700',
  '[&_svg]:size-3.5 [&_svg]:text-slate-600',
  'hover:[&_svg]:text-blue-600'
)

export const usageLogsDialogTimingSuccessClassName = 'text-emerald-700'

export const usageLogsDialogTimingWarningClassName = 'text-amber-700'

export const usageLogsDialogTimingDangerClassName = 'text-rose-700'

export const usageLogsDialogTieredPanelClassName = cn(
  'min-w-0 overflow-hidden rounded-md border border-[#DBEAFE] bg-[#F8FBFF] px-3 max-sm:px-2'
)

export const usageLogsDialogBackendTextClassName =
  'text-sm leading-relaxed break-words text-slate-800'

export const usageLogsDialogBackendPreClassName = cn(
  'mt-1 max-h-32 overflow-y-auto rounded border border-[#DBEAFE] bg-white p-2',
  'font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-900'
)

export const usageLogsDialogParamOverrideRowClassName = cn(
  'flex min-w-0 flex-col gap-1.5 rounded border border-[#DBEAFE] bg-white p-2 sm:flex-row sm:items-start sm:gap-2'
)

export const usageLogsDialogParamOverrideContentClassName =
  'min-w-0 font-mono text-xs leading-relaxed break-all text-slate-900 sm:break-words'

export const usageLogsDialogWarningTextClassName = 'text-sm text-amber-800'

// —— H: Drawing / task content dialogs —— //

export const usageLogsContentDialogSurfaceClassName =
  'border-[#DBEAFE] bg-white text-slate-800 sm:max-w-lg'

export const usageLogsContentDialogSurfaceWideClassName =
  'border-[#DBEAFE] bg-white text-slate-800 sm:max-w-3xl'

export const usageLogsContentDialogTitleClassName =
  'text-base font-semibold text-slate-900'

export const usageLogsContentDialogDescClassName = 'text-sm text-slate-500'

export const usageLogsContentDialogLabelClassName =
  'text-sm font-semibold text-slate-700'

export const usageLogsContentDialogPanelClassName =
  'relative rounded-md border border-[#DBEAFE] bg-[#F8FBFF] p-3'

export const usageLogsContentDialogDangerPanelClassName =
  'relative rounded-md border border-rose-200 bg-rose-50 p-3'

export const usageLogsContentDialogTextClassName =
  'pr-10 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-800'

export const usageLogsContentDialogDangerTextClassName =
  'overflow-wrap-anywhere pr-10 text-sm leading-relaxed break-all whitespace-pre-wrap text-rose-700'

export const usageLogsContentDialogCopyButtonClassName = cn(
  'absolute top-2 right-2 h-8 w-8 p-0 text-slate-500',
  'hover:bg-blue-50 hover:text-blue-700',
  '[&_svg]:size-4'
)

export const usageLogsContentDialogImageFrameClassName =
  'relative flex min-h-[300px] items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F8FBFF]'

export const usageLogsContentDialogImageErrorClassName = 'text-sm text-slate-500'

export const usageLogsContentDialogUrlPanelClassName =
  'mt-4 rounded-md border border-[#DBEAFE] bg-[#F8FBFF] p-3'

export const usageLogsContentDialogUrlTextClassName =
  'font-mono text-xs leading-relaxed break-all text-slate-600'

export const usageLogsDrawingTaskIdBadgeClassName = cn(
  'max-w-full truncate rounded-md border border-[#DBEAFE] bg-[#F8FBFF] px-1.5 py-0.5 font-mono text-slate-700'
)

export const usageLogsPromptPreviewClassName =
  'truncate text-xs leading-snug text-slate-500 group-hover:text-slate-800'

export const usageLogsContentDialogOutlineButtonClassName =
  opsConsoleOutlineButtonClassName
