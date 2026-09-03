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
import type { ApiKey } from '@/features/keys/types'

export type PlainLanguageRatio =
  | { kind: 'auto' }
  | { kind: 'unknown' }
  | { kind: 'standard' }
  | { kind: 'discount'; fold: number; percent: number }
  | { kind: 'premium'; multiplier: number; percent: number }

export function explainGroupRatio(
  ratio: number | string | undefined,
  isAuto = false
): PlainLanguageRatio {
  if (isAuto) return { kind: 'auto' }
  if (ratio === undefined || (typeof ratio === 'string' && !ratio.trim())) {
    return { kind: 'unknown' }
  }

  const numericRatio = Number(ratio)
  if (!Number.isFinite(numericRatio) || numericRatio < 0) {
    return { kind: 'unknown' }
  }
  if (Math.abs(numericRatio - 1) < 0.0001) {
    return { kind: 'standard' }
  }
  if (numericRatio < 1) {
    return {
      kind: 'discount',
      fold: Number((numericRatio * 10).toFixed(1)),
      percent: Math.round((1 - numericRatio) * 100),
    }
  }
  return {
    kind: 'premium',
    multiplier: Number(numericRatio.toFixed(2)),
    percent: Math.round((numericRatio - 1) * 100),
  }
}

export function canReuseEasyConnectKey(
  apiKey: ApiKey | null | undefined,
  model: string,
  group: string
): boolean {
  if (!apiKey || apiKey.status !== 1) return false
  // An empty group inherits the user's group, not necessarily "default".
  if (!apiKey.group || apiKey.group !== group) return false
  // A custom Auto subset is not the account-wide Auto route we validated.
  if (group === 'auto' && apiKey.auto_groups?.length) return false
  if (!apiKey.model_limits_enabled) return true

  return (apiKey.model_limits ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(model)
}
