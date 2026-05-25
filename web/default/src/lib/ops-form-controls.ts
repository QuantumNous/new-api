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
 * Shared dark ops-center form control tokens (presentation only).
 *
 * Global UI review checklist (dark theme):
 * - input, select, combobox, date/range picker, dropdown, dialog, popover
 * - table filter, search input
 * Verify hover / focus / active / open / disabled states keep readable text
 * (avoid muted bg + muted text, outline Button aria-expanded defaults).
 */
import { cn } from '@/lib/utils'

/** Override outline Button / popover trigger open states on dark ops toolbars. */
export const opsDarkOutlineTriggerStateClassName = cn(
  '!text-slate-100 hover:!text-slate-100 focus-visible:!text-slate-100 active:!text-slate-100',
  'aria-expanded:!text-slate-100 data-[popup-open]:!text-slate-100 data-open:!text-slate-100',
  'dark:!border-white/15 dark:!bg-slate-950/45',
  'dark:hover:!border-white/25 dark:hover:!bg-white/5 dark:hover:!text-slate-100',
  'aria-expanded:!border-cyan-300/50 aria-expanded:!bg-slate-950/45 aria-expanded:ring-1 aria-expanded:ring-cyan-400/40',
  'data-[popup-open]:!border-cyan-300/50 data-[popup-open]:!bg-slate-950/45 data-[popup-open]:ring-1 data-[popup-open]:ring-cyan-400/40',
  'focus-visible:!border-cyan-300/50 focus-visible:ring-1 focus-visible:ring-cyan-400/40',
  '[&_span]:text-slate-100 hover:[&_span]:text-slate-100 focus-visible:[&_span]:text-slate-100 active:[&_span]:text-slate-100',
  'aria-expanded:[&_span]:!text-slate-100 data-[popup-open]:[&_span]:!text-slate-100 data-open:[&_span]:!text-slate-100',
  'data-empty:[&_span]:text-slate-400 data-empty:hover:[&_span]:text-slate-400',
  'data-empty:focus-visible:[&_span]:text-slate-400 data-empty:aria-expanded:[&_span]:text-slate-400',
  'data-empty:data-[popup-open]:[&_span]:text-slate-400',
  '[&_[data-slot=select-value]]:text-slate-100',
  'aria-expanded:[&_[data-slot=select-value]]:!text-slate-100 data-[popup-open]:[&_[data-slot=select-value]]:!text-slate-100',
  '[&_svg]:!text-slate-400 [&_svg]:!opacity-100 hover:[&_svg]:!text-slate-300',
  'focus-visible:[&_svg]:!text-slate-300 aria-expanded:[&_svg]:!text-slate-300 data-[popup-open]:[&_svg]:!text-slate-300'
)

/** datetime-local inputs inside dark ops popovers. */
export const opsDarkFilterDateInputClassName = cn(
  'h-8 border-white/15 bg-slate-950/85 font-mono text-xs text-slate-100 shadow-none',
  'placeholder:text-slate-400',
  'hover:border-white/25 hover:bg-slate-950/85 hover:text-slate-100',
  'focus-visible:border-cyan-300/50 focus-visible:text-slate-100 focus-visible:ring-1 focus-visible:ring-cyan-400/40',
  'dark:border-white/15 dark:bg-slate-950/85 dark:text-slate-100 dark:hover:bg-slate-950/85'
)
