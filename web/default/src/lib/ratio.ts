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
 * Conversion factor between a model "ratio" and its price in USD per 1M tokens.
 *
 * Derivation: the backend stores prices internally as "quota", where
 * `quotaPerUnit` (= 500000) quota equals one ratio unit, and 1 quota corresponds
 * to `1e6 / quotaPerUnit` USD per 1M tokens. Therefore:
 *
 *   $/1M tokens = ratio * (1e6 / quotaPerUnit) = ratio * 2   (when quotaPerUnit = 500000)
 *
 * This `2` was previously hardcoded in several places as `model_ratio * 2`.
 * It is centralized here to avoid silent drift. This mirrors the backend's
 * `common.RatioToUSDPerMillion` / `preConsumeRatioDivisor` (both = 1e6/QuotaPerUnit).
 *
 * NOTE: the frontend has no compile-time access to the backend QuotaPerUnit, so
 * this constant is a transitional shared value. The ideal end state is the
 * backend `/api/pricing` emitting already-converted $/1M prices so the frontend
 * never multiplies by 2 — that larger change is deferred (see task design).
 */
export const RATIO_USD_PER_MILLION_TOKENS = 2

/**
 * Convert a model ratio to its USD price per 1M tokens.
 */
export function ratioToUsdPerMillion(ratio: number): number {
  return ratio * RATIO_USD_PER_MILLION_TOKENS
}

/**
 * Convert a USD price per 1M tokens back to a model ratio.
 * Inverse of {@link ratioToUsdPerMillion} — round-trip must be identity so that
 * forms (e.g. model-mutate-drawer) can display a ratio as $/1M and write the
 * edited value back to the same ratio without drift.
 */
export function usdPerMillionToRatio(usdPerMillion: number): number {
  return usdPerMillion / RATIO_USD_PER_MILLION_TOKENS
}
