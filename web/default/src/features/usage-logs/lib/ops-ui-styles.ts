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

// —— A/B/C: Filter toolbar controls —— //

export const usageLogsFilterControlBaseClassName = cn(
  'border border-white/15 bg-slate-950/30 text-slate-100 shadow-none',
  'placeholder:text-slate-400',
  'hover:border-white/25 hover:bg-white/5',
  'focus-visible:border-cyan-300/50 focus-visible:ring-1 focus-visible:ring-cyan-400/30'
)

/** Text filter inputs (model, group, token, etc.). */
export const usageLogsFilterSearchInputClassName = cn(
  'h-8 w-full min-w-0',
  usageLogsFilterControlBaseClassName
)

/** Select / faceted filter triggers (e.g. log type). */
export const usageLogsFilterSelectTriggerClassName = cn(
  'h-8 w-full min-w-[7.5rem] justify-between gap-2 px-2.5 py-0 font-normal',
  usageLogsFilterControlBaseClassName,
  'data-placeholder:text-slate-400',
  '[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-slate-100',
  '[&_svg]:pointer-events-none [&_svg]:!size-4 [&_svg]:shrink-0 [&_svg]:!text-slate-400 [&_svg]:!opacity-100',
  'hover:[&_svg]:!text-slate-300',
  'aria-expanded:border-cyan-300/50 aria-expanded:ring-1 aria-expanded:ring-cyan-400/30'
)

/** Date-range popover trigger. */
export const usageLogsFilterDateTriggerClassName = cn(
  'h-8 w-full justify-start gap-2 px-2.5 font-mono text-xs font-normal text-slate-100',
  usageLogsFilterControlBaseClassName,
  '[&_svg]:!text-slate-400 [&_svg]:!opacity-100',
  'hover:[&_svg]:!text-slate-300'
)

/** Right-aligned search icon inside filter text inputs. */
export const usageLogsFilterSearchIconClassName = cn(
  'pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-400',
  'group-focus-within:text-slate-300'
)

/** Filter text input with room for right search icon. */
export const usageLogsFilterSearchInputFieldClassName = cn(
  'h-8 w-full cursor-text px-2.5 pr-9 text-left',
  usageLogsFilterSearchInputClassName
)

// —— D: Stats toolbar badges —— //

export const usageLogsStatBadgeClassName = cn(
  'inline-flex h-8 min-h-8 items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs',
  'border-white/15 bg-slate-950/30'
)

export const usageLogsStatBadgeLabelClassName = 'font-medium text-slate-300'

export const usageLogsStatBadgeValueClassName =
  'font-mono text-sm font-bold tabular-nums text-slate-100'

export const usageLogsToolbarIconButtonClassName = cn(
  'size-8 border border-white/15 bg-slate-950/30 text-slate-100',
  'hover:border-white/25 hover:bg-white/5 hover:text-white',
  '[&_svg]:text-slate-400 hover:[&_svg]:text-slate-200'
)

/** Primary apply / query action on usage-logs toolbars. */
export const usageLogsToolbarQueryButtonClassName = cn(
  'h-8 border-cyan-500/60 bg-cyan-600 text-white shadow-sm',
  'hover:border-cyan-400/70 hover:bg-cyan-500',
  'disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-400'
)

/** Expand / more-filters toggle on usage-logs toolbars. */
export const usageLogsToolbarExpandButtonClassName = cn(
  'h-8 gap-1 px-2 text-slate-200',
  'hover:bg-white/10 hover:text-white',
  'data-[active=true]:text-cyan-300'
)

/** Plaintext toggle next to stats (outline, readable by default). */
export const usageLogsToolbarPlaintextButtonClassName = cn(
  'h-8 gap-1.5 border border-white/15 bg-slate-950/30 px-2.5 text-sm text-slate-100 shadow-none',
  'hover:border-white/25 hover:bg-white/5',
  '[&_svg]:size-4 [&_svg]:text-slate-300'
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

export const usageLogsInlinePillClass =
  'inline-flex items-center rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-slate-100'

export const usageLogsLogTypeBadgeClass =
  'shrink-0 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs font-semibold text-slate-200'

export const usageLogsDetailSummaryClass =
  'text-sm leading-snug text-slate-300'
