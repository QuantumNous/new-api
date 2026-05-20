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
import { type TFunction } from 'i18next'

// ============================================================================
// Duration Unit Options
// ============================================================================

export const DURATION_UNITS = [
  { value: 'year', labelKey: 'subs.duration.year' },
  { value: 'month', labelKey: 'subs.duration.month' },
  { value: 'day', labelKey: 'subs.duration.day' },
  { value: 'hour', labelKey: 'subs.duration.hour' },
  { value: 'custom', labelKey: 'subs.duration.custom_seconds' },
] as const

export const RESET_PERIODS = [
  { value: 'never', labelKey: 'subs.reset.never' },
  { value: 'daily', labelKey: 'subs.reset.daily' },
  { value: 'weekly', labelKey: 'subs.reset.weekly' },
  { value: 'monthly', labelKey: 'subs.reset.monthly' },
  { value: 'custom', labelKey: 'subs.reset.custom_seconds' },
] as const

/** Dark-theme readable outline buttons (Sheet / dialogs). */
export const SUBSCRIPTIONS_OUTLINE_BUTTON_CLASS =
  'border-white/15 bg-white/10 text-slate-100 [&_svg]:text-slate-100 hover:bg-white/15 hover:text-white hover:[&_svg]:text-white data-popup-open:bg-white/10 disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400 disabled:opacity-60'

/** Dark-theme row action trigger (ghost icon). */
export const SUBSCRIPTIONS_GHOST_ICON_BUTTON_CLASS =
  'text-slate-200 hover:bg-white/10 hover:text-white [&_svg]:text-slate-300 hover:[&_svg]:text-white data-popup-open:bg-white/10'

export function getDurationUnitOptions(t: TFunction) {
  return DURATION_UNITS.map((u) => ({ value: u.value, label: t(u.labelKey) }))
}

export function getResetPeriodOptions(t: TFunction) {
  return RESET_PERIODS.map((p) => ({ value: p.value, label: t(p.labelKey) }))
}
