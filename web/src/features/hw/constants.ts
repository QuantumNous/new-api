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
 * The models sold under HisarWeb AI names.
 *
 * `hwSoldModels` in `service/hw_pricing.go` is the source of truth; no public
 * endpoint exposes the catalog yet, so this list repeats those names in
 * the same order. A model added on the server only reaches the picker after it
 * is added here too — the comparison then answers 404 until both sides agree.
 */
export const HW_SOLD_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
] as const

export type HwSoldModel = (typeof HW_SOLD_MODELS)[number]

/**
 * Monthly token bound of `GET /api/hw/pricing/compare`, copied from
 * `service.HwMaxTokensPerMonth`; the server rejects anything above it.
 */
export const HW_COMPARE_MAX_MONTHLY_TOKENS = 100_000_000_000
