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
  { value: 'year', labelKey: 'years' },
  { value: 'month', labelKey: 'months' },
  { value: 'day', labelKey: 'days' },
  { value: 'hour', labelKey: 'hours' },
  { value: 'custom', labelKey: 'Custom (seconds)' },
] as const

export const RESET_PERIODS = [
  { value: 'never', labelKey: 'No Reset' },
  { value: 'daily', labelKey: 'Daily' },
  { value: 'weekly', labelKey: 'Weekly' },
  { value: 'monthly', labelKey: 'Monthly' },
  { value: 'custom', labelKey: 'Custom (seconds)' },
] as const

// ============================================================================
// Admin Grant Mode Options
// ============================================================================

export const GRANT_MODES = [
  {
    value: 'create',
    labelKey: 'New subscription',
    descKey: 'Always add a new subscription record',
  },
  {
    value: 'renew',
    labelKey: 'Renew',
    descKey:
      'Adjust the end time of the existing active subscription of the same plan, without adding a record. Falls back to new subscription when there is none',
  },
  {
    value: 'replace',
    labelKey: 'Replace',
    descKey:
      'Invalidate the existing active subscription of the same plan, then add a new record',
  },
] as const

export function getGrantModeOptions(t: TFunction) {
  return GRANT_MODES.map((m) => ({ value: m.value, label: t(m.labelKey) }))
}

export function getGrantModeDescription(t: TFunction, mode: string) {
  return t(GRANT_MODES.find((m) => m.value === mode)?.descKey || '')
}

export function getEndTimeHint(
  t: TFunction,
  mode: string,
  hasCustomTime: boolean
) {
  if (mode === 'renew') {
    return hasCustomTime
      ? t(
          'In renew mode a custom time overwrites the end time directly, which may shorten the subscription'
        )
      : t('Leave empty to extend by one plan period from the current expiry')
  }
  return t('Leave empty to use the plan default duration')
}

export function getDurationUnitOptions(t: TFunction) {
  return DURATION_UNITS.map((u) => ({ value: u.value, label: t(u.labelKey) }))
}

export function getResetPeriodOptions(t: TFunction) {
  return RESET_PERIODS.map((p) => ({ value: p.value, label: t(p.labelKey) }))
}
