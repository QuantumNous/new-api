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
 * Dark ops-center UI tokens for usage-logs (cockpit layouts).
 * Do not use light-theme text (slate-700/800/900) — default to bright text on dark surfaces.
 */
import { cn } from '@/lib/utils'

// —— A/B/C: Filter toolbar controls (40px row, text-sm) —— //

const usageLogsToolbarControlHeightClassName = 'h-10 min-h-10 max-h-10'

const usageLogsFilterTextClassName = cn(
  '!text-sm leading-none',
  'placeholder:!text-sm placeholder:text-slate-400'
)

export const usageLogsFilterControlBaseClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'rounded-md border border-white/15 bg-slate-950/45 text-slate-100 shadow-none',
  usageLogsFilterTextClassName,
  'hover:border-white/25 hover:bg-white/5',
  'focus-visible:border-cyan-300/50 focus-visible:ring-1 focus-visible:ring-cyan-400/40'
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
  '[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-sm [&_[data-slot=select-value]]:text-slate-100',
  '[&_svg]:pointer-events-none [&_svg]:!size-4 [&_svg]:shrink-0 [&_svg]:!text-slate-400 [&_svg]:!opacity-100',
  'hover:[&_svg]:!text-slate-300',
  'aria-expanded:border-cyan-300/50 aria-expanded:ring-1 aria-expanded:ring-cyan-400/40'
)

/** Date-range popover trigger. */
export const usageLogsFilterDateTriggerClassName = cn(
  'w-full justify-start gap-2 px-3 font-mono text-sm font-normal text-slate-100',
  usageLogsFilterControlBaseClassName,
  '[&_svg]:!size-4 [&_svg]:!text-slate-400 [&_svg]:!opacity-100',
  'hover:[&_svg]:!text-slate-300'
)

/** Right-aligned search icon inside filter text inputs. */
export const usageLogsFilterSearchIconClassName = cn(
  'pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400',
  'group-focus-within:text-slate-300'
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
  'border-white/15 bg-slate-950/45'
)

export const usageLogsStatBadgeAccentClassName =
  'h-3 w-px shrink-0 rounded-full'

export const usageLogsStatBadgeLabelClassName =
  'shrink-0 text-sm font-normal leading-none text-slate-400'

export const usageLogsStatBadgeValueClassName = cn(
  'font-mono text-[15px] font-semibold leading-none tabular-nums text-slate-100'
)

export const usageLogsToolbarIconButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'w-10 shrink-0 border border-white/15 bg-slate-950/45 p-0 text-slate-100',
  'hover:border-white/25 hover:bg-white/5 hover:text-white',
  '[&_svg]:size-4 [&_svg]:text-slate-400 hover:[&_svg]:text-slate-200'
)

/** Primary apply / query action on usage-logs toolbars. */
export const usageLogsToolbarQueryButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'shrink-0 px-3 text-sm font-medium shadow-sm',
  'border-cyan-500/60 bg-cyan-600 text-white',
  'hover:border-cyan-400/70 hover:bg-cyan-500',
  'disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-400'
)

/** Expand / more-filters toggle on usage-logs toolbars. */
export const usageLogsToolbarExpandButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'shrink-0 gap-1 px-2.5 text-sm text-slate-200',
  'hover:bg-white/10 hover:text-white',
  'data-[active=true]:text-cyan-300'
)

/** Plaintext toggle next to stats — same 40px height as stat badges. */
export const usageLogsToolbarPlaintextButtonClassName = cn(
  usageLogsToolbarControlHeightClassName,
  'shrink-0 gap-1.5 border border-white/15 bg-slate-950/45 px-3 text-sm font-normal text-slate-100 shadow-none',
  'hover:border-white/25 hover:bg-white/5 hover:text-white',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-slate-400',
  'hover:[&_svg]:text-slate-300'
)

// —— E: Table header —— //

export const usageLogsColumnHeaderClassName = 'font-semibold text-slate-100'

export const usageLogsTableHeaderClassName = cn(
  'sticky top-0 z-10 border-b border-white/10 bg-white/5',
  '[&_th]:text-slate-100',
  '[&_th_button]:font-semibold [&_th_button]:text-slate-100',
  '[&_th_button:hover]:bg-white/10 [&_th_button:hover]:text-white',
  '[&_th_div.font-semibold]:text-slate-100',
  '[&_th_svg]:text-slate-300'
)

// —— F: Table body —— //

export const usageLogsTablePrimaryClass = 'text-slate-100'

export const usageLogsTableMetaClass = 'text-xs font-medium text-slate-300'

export const usageLogsTableEmptyClass = 'text-xs text-slate-400'

export const usageLogsInlinePillClass = cn(
  'inline-flex max-w-[11rem] items-center truncate rounded-md border border-white/15',
  'bg-white/5 px-1.5 py-0.5 font-mono text-xs text-slate-100'
)

/** Subscription billing badge on common logs quota column */
export const usageLogsSubscriptionBadgeClassName = cn(
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
  'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
)

/** Masked avatar on dark ops tables */
export const usageLogsMaskedAvatarClassName =
  'bg-white/10 text-slate-400 ring-1 ring-white/15'

/** Common logs error/refund row tint — subtle, not full-row blocks */
export const usageLogsCommonRowErrorTintClassName =
  'bg-rose-500/[0.06] hover:bg-rose-500/10'

export const usageLogsCommonRowRefundTintClassName =
  'bg-cyan-500/[0.06] hover:bg-cyan-500/10'

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
  'text-sm leading-snug text-slate-300'

/** Task/drawing table rows — override global muted hover on dark ops tables */
export const usageLogsTableBodyRowClassName = cn(
  'hover:!bg-cyan-500/10 dark:hover:!bg-white/5',
  'data-[state=selected]:!bg-cyan-500/10 data-[state=selected]:!text-slate-100'
)

export const usageLogsTableClickableLinkClass =
  'text-sm text-cyan-300 hover:text-cyan-200 hover:underline'

export const usageLogsTableFailReasonClass =
  'truncate text-sm leading-snug text-rose-300 group-hover:underline'

// —— G: Details dialog (light popover — dark text for contrast) —— //

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
  'min-w-0 space-y-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-2.5 max-sm:p-2'
)

export const usageLogsDialogSectionDangerClassName = cn(
  'min-w-0 space-y-1 overflow-hidden rounded-md border border-red-200 bg-red-50 p-2.5 max-sm:p-2'
)

export const usageLogsDialogSectionDangerLabelClassName =
  'flex items-center gap-1.5 text-sm font-semibold text-red-700'

export const usageLogsDialogContentPanelClassName = cn(
  'relative min-w-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-3'
)

export const usageLogsDialogContentTextClassName =
  'min-w-0 pr-8 text-sm leading-relaxed break-all whitespace-pre-wrap text-slate-900 sm:break-words'

export const usageLogsDialogMutedInlineClassName = 'text-slate-600'

export const usageLogsDialogCopyButtonClassName = cn(
  'absolute top-1.5 right-1.5 h-6 w-6 p-0 text-slate-600',
  'hover:bg-slate-200 hover:text-slate-900',
  '[&_svg]:size-3.5 [&_svg]:text-slate-600',
  'hover:[&_svg]:text-slate-800'
)

export const usageLogsDialogCopyButtonInlineClassName = cn(
  'absolute top-0 right-0 h-6 w-6 p-0 text-slate-600',
  'hover:bg-slate-200 hover:text-slate-900',
  '[&_svg]:size-3.5 [&_svg]:text-slate-600',
  'hover:[&_svg]:text-slate-800'
)

export const usageLogsDialogTimingSuccessClassName = 'text-emerald-700'

export const usageLogsDialogTimingWarningClassName = 'text-amber-700'

export const usageLogsDialogTimingDangerClassName = 'text-rose-700'

export const usageLogsDialogTieredPanelClassName = cn(
  'min-w-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 px-3 max-sm:px-2'
)

export const usageLogsDialogBackendTextClassName =
  'text-sm leading-relaxed break-words text-slate-800'

export const usageLogsDialogBackendPreClassName = cn(
  'mt-1 max-h-32 overflow-y-auto rounded border border-slate-200 bg-slate-100 p-2',
  'font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-900'
)

export const usageLogsDialogParamOverrideRowClassName = cn(
  'flex min-w-0 flex-col gap-1.5 rounded border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-start sm:gap-2'
)

export const usageLogsDialogParamOverrideContentClassName =
  'min-w-0 font-mono text-xs leading-relaxed break-all text-slate-900 sm:break-words'

export const usageLogsDialogWarningTextClassName = 'text-sm text-amber-800'

// —— H: Drawing / task content dialogs (dark ops-center) —— //

export const usageLogsContentDialogSurfaceClassName =
  'border-white/15 bg-slate-900 text-slate-100 sm:max-w-lg'

export const usageLogsContentDialogSurfaceWideClassName =
  'border-white/15 bg-slate-900 text-slate-100 sm:max-w-3xl'

export const usageLogsContentDialogTitleClassName =
  'text-base font-semibold text-slate-100'

export const usageLogsContentDialogDescClassName = 'text-sm text-slate-400'

export const usageLogsContentDialogLabelClassName =
  'text-sm font-semibold text-slate-200'

export const usageLogsContentDialogPanelClassName =
  'relative rounded-md border border-white/15 bg-slate-950/50 p-3'

export const usageLogsContentDialogDangerPanelClassName =
  'relative rounded-md border border-rose-500/30 bg-rose-950/30 p-3'

export const usageLogsContentDialogTextClassName =
  'pr-10 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-100'

export const usageLogsContentDialogDangerTextClassName =
  'overflow-wrap-anywhere pr-10 text-sm leading-relaxed break-all whitespace-pre-wrap text-rose-300'

export const usageLogsContentDialogCopyButtonClassName = cn(
  'absolute top-2 right-2 h-8 w-8 p-0 text-slate-300',
  'hover:bg-white/10 hover:text-slate-100',
  '[&_svg]:size-4'
)

export const usageLogsContentDialogImageFrameClassName =
  'relative flex min-h-[300px] items-center justify-center rounded-lg border border-white/15 bg-slate-950/40'

export const usageLogsContentDialogImageErrorClassName = 'text-sm text-slate-400'

export const usageLogsContentDialogUrlPanelClassName =
  'mt-4 rounded-md border border-white/15 bg-slate-950/50 p-3'

export const usageLogsContentDialogUrlTextClassName =
  'font-mono text-xs leading-relaxed break-all text-slate-300'

export const usageLogsDrawingTaskIdBadgeClassName = cn(
  'max-w-full truncate rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono'
)

export const usageLogsPromptPreviewClassName =
  'truncate text-xs leading-snug text-slate-300 group-hover:text-slate-100'
