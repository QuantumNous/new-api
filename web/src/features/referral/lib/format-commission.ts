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
 * Convert a cents value (int) to a fixed-2 yuan string ("25.00").
 */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * Convert a yuan (float) value to cents (int), rounding to the nearest cent.
 * Handles 0.1+0.2 float noise so the UI never quietly loses a cent.
 */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100)
}

/**
 * Mirror of the backend Redeem math. Kept in sync so a client-side preview
 * always matches what the server would actually credit; if the numbers drift
 * that's a bug worth catching in tests.
 */
export function computeQuotaCredit(
  cents: number,
  rate: number,
  quotaPerUnit: number
): number {
  if (cents <= 0 || rate <= 0 || quotaPerUnit <= 0) return 0
  return Math.floor((cents / 100 / rate) * quotaPerUnit)
}
