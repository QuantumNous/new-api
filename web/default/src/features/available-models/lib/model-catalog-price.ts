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
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import type { PricingModel } from '@/features/pricing/types'

/**
 * Price shown on a catalog card.
 *
 * `none` covers both "this model has no pricing row" and "the row is unusable"
 * — the card renders no price panel rather than a misleading zero.
 */
export type CatalogPrice =
  | { kind: 'none' }
  | { kind: 'dynamic' }
  | { kind: 'request'; priceUSD: number }
  | { kind: 'token'; inputUSD: number; outputUSD: number | null }

/**
 * `model_ratio` is quoted per 500K tokens, so a price per 1M tokens is the
 * ratio doubled. This mirrors `calculateTokenPrice` in the pricing feature.
 */
const TOKENS_PER_RATIO_UNIT = 2

function isUsableNumber(value: number | null | undefined): value is number {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
}

export function buildCatalogPriceIndex(
  rows: readonly PricingModel[] | undefined
): Map<string, PricingModel> {
  const index = new Map<string, PricingModel>()
  for (const row of rows ?? []) {
    if (!row.model_name || index.has(row.model_name)) continue
    index.set(row.model_name, row)
  }
  return index
}

/**
 * Ratio actually applied to a model in the selected scope.
 *
 * An exclusive per-model ratio overrides the scope default outright (the two
 * are never multiplied), matching how the "Exclusive ratio" badge is explained
 * on the card — including an exclusive ratio of 0, which makes the model free.
 */
export function resolveCatalogPriceRatio(options: {
  modelId: string
  modelRatios: Readonly<Record<string, number>>
  defaultRatio: number | null
}): number {
  const exclusive = options.modelRatios[options.modelId]
  if (isUsableNumber(exclusive)) return exclusive
  if (isUsableNumber(options.defaultRatio)) return options.defaultRatio
  return 1
}

export function resolveCatalogPrice(
  model: PricingModel | undefined,
  options: { ratio: number }
): CatalogPrice {
  if (!model) return { kind: 'none' }

  // A tiered expression prices per-request against runtime variables; there is
  // no single unit price to put on a card.
  if (model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr)) {
    return { kind: 'dynamic' }
  }

  const ratio = isUsableNumber(options.ratio) ? options.ratio : 1

  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    const price = isUsableNumber(model.model_price) ? model.model_price : 0
    return { kind: 'request', priceUSD: price * ratio }
  }

  if (!isUsableNumber(model.model_ratio)) return { kind: 'none' }

  const inputUSD = model.model_ratio * TOKENS_PER_RATIO_UNIT * ratio
  const outputUSD =
    isUsableNumber(model.completion_ratio) && model.completion_ratio > 0
      ? inputUSD * model.completion_ratio
      : null

  return { kind: 'token', inputUSD, outputUSD }
}
