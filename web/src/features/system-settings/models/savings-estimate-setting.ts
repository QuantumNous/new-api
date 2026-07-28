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
export const DEFAULT_SAVINGS_SETTING = {
  enabled: false,
  show_on_dashboard: true,
  show_on_usage_logs: true,
  local_pricing_official_confirmed: true,
  rebuild_legacy_logs: true,
  require_official_confirmation: true,
  official_price_stale_days: 90,
  max_summary_days: 31,
  max_summary_log_rows: 50000,
  official_prices: {},
}

export type SavingsEstimateSetting = Record<string, unknown> &
  typeof DEFAULT_SAVINGS_SETTING

export type BooleanSettingKey =
  | 'enabled'
  | 'show_on_dashboard'
  | 'show_on_usage_logs'
  | 'local_pricing_official_confirmed'
  | 'rebuild_legacy_logs'
  | 'require_official_confirmation'

export type NumberSettingKey =
  | 'official_price_stale_days'
  | 'max_summary_days'
  | 'max_summary_log_rows'

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function parseSavingsSetting(
  value: string
): SavingsEstimateSetting | null {
  try {
    const parsed: unknown = JSON.parse(value.trim() || '{}')
    if (!isPlainObject(parsed)) return null

    const setting = {
      ...DEFAULT_SAVINGS_SETTING,
      ...parsed,
    } as SavingsEstimateSetting
    delete setting.reference_price_source
    delete setting.include_unpriced_models

    for (const key of [
      'enabled',
      'show_on_dashboard',
      'show_on_usage_logs',
      'local_pricing_official_confirmed',
      'rebuild_legacy_logs',
      'require_official_confirmation',
    ] satisfies BooleanSettingKey[]) {
      if (typeof setting[key] !== 'boolean') {
        setting[key] = DEFAULT_SAVINGS_SETTING[key]
      }
    }

    for (const key of [
      'official_price_stale_days',
      'max_summary_days',
      'max_summary_log_rows',
    ] satisfies NumberSettingKey[]) {
      if (
        typeof setting[key] !== 'number' ||
        !Number.isFinite(setting[key]) ||
        setting[key] < 1
      ) {
        setting[key] = DEFAULT_SAVINGS_SETTING[key]
      } else {
        setting[key] = Math.floor(setting[key])
      }
    }

    if (!isPlainObject(setting.official_prices)) {
      setting.official_prices = {}
    }
    return setting
  } catch {
    return null
  }
}

export function formatSavingsSetting(value: string): string {
  const setting = parseSavingsSetting(value)
  return setting ? JSON.stringify(setting, null, 2) : value
}
