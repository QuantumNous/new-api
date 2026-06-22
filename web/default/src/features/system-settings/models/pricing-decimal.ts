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
const DEFAULT_MAX_DECIMALS = 12
const FLOAT_SNAP_EPSILON = 1e-9

function stripTrailingZeros(decimal: string): string {
  return decimal
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '')
}

/**
 * Normalize model pricing decimals for form display and JSON round-trips.
 * Removes IEEE-754 artifacts (e.g. 7.999999999999999 → "8") while keeping
 * meaningful fractional precision up to maxDecimals.
 */
export function formatPricingDecimal(
  value: unknown,
  maxDecimals = DEFAULT_MAX_DECIMALS,
): string {
  if (value === '' || value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value.trim() : value
  if (raw === '') return ''

  const num = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(num)) return ''
  if (Object.is(num, -0)) return '0'

  const nearestInt = Math.round(num)
  if (Math.abs(num - nearestInt) < FLOAT_SNAP_EPSILON) {
    return String(nearestInt)
  }

  const factor = 10 ** maxDecimals
  const rounded = Math.round(num * factor) / factor
  const trimmed = stripTrailingZeros(rounded.toFixed(maxDecimals))
  return trimmed === '' ? '0' : trimmed
}

export function parsePricingDecimal(value: unknown): number | null {
  const formatted = formatPricingDecimal(value)
  if (formatted === '') return null
  const num = Number(formatted)
  return Number.isFinite(num) ? num : null
}

export function multiplyPricingDecimals(
  left: unknown,
  right: unknown,
  maxDecimals = DEFAULT_MAX_DECIMALS,
): string {
  const a = parsePricingDecimal(left)
  const b = parsePricingDecimal(right)
  if (a === null || b === null) return ''
  return formatPricingDecimal(a * b, maxDecimals)
}

export function dividePricingDecimals(
  numerator: unknown,
  denominator: unknown,
  maxDecimals = DEFAULT_MAX_DECIMALS,
): string {
  const a = parsePricingDecimal(numerator)
  const b = parsePricingDecimal(denominator)
  if (a === null || b === null || b === 0) return ''
  return formatPricingDecimal(a / b, maxDecimals)
}
