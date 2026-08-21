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
import type { ModelAccessModel } from '../types'
import type { CatalogPrice } from './model-catalog-price'
import { getModelCategory, type ModelCategory } from './model-catalog-type'

export type CatalogSummaryEntry = {
  model: ModelAccessModel
  price: CatalogPrice
}

export type CatalogLowestPrice = {
  /** Which unit the figure is quoted in — the two are never mixed. */
  unit: 'token' | 'request'
  amountUSD: number
}

export type CatalogCategoryPrice = {
  category: ModelCategory
  count: number
  lowest: CatalogLowestPrice
  /**
   * True when the category also contains models billed in the other unit, so
   * the UI can qualify the headline figure instead of implying it covers all.
   */
  mixedBilling: boolean
}

export type ModelCatalogSummary = {
  total: number
  breakdown: Array<{ category: ModelCategory; count: number }>
  categoryPrices: CatalogCategoryPrice[]
}

/** Shared display order across the catalog's chips and summary. */
const CATEGORY_ORDER: ModelCategory[] = [
  'chat',
  'image',
  'video',
  'audio',
  'embedding',
  'rerank',
]

/**
 * Headline numbers for the catalog summary strip.
 *
 * Per category it reports the cheapest entry point. Token and per-request
 * prices are never compared against each other — a "$1 per request" model
 * would otherwise undercut a "$0.78 per 1M tokens" model in a figure that then
 * means nothing. Token pricing wins where both exist, and `mixedBilling` says
 * so. Categories where nothing is priced (or everything is a tiered
 * expression) are omitted rather than shown as free.
 */
export function getModelCatalogSummary(
  entries: readonly CatalogSummaryEntry[]
): ModelCatalogSummary {
  const counts = new Map<ModelCategory, number>()
  const lowestToken = new Map<ModelCategory, number>()
  const lowestRequest = new Map<ModelCategory, number>()

  for (const { model, price } of entries) {
    const category = getModelCategory(model)
    counts.set(category, (counts.get(category) ?? 0) + 1)

    if (price.kind === 'token') {
      const current = lowestToken.get(category)
      if (current === undefined || price.inputUSD < current) {
        lowestToken.set(category, price.inputUSD)
      }
    } else if (price.kind === 'request') {
      const current = lowestRequest.get(category)
      if (current === undefined || price.priceUSD < current) {
        lowestRequest.set(category, price.priceUSD)
      }
    }
  }

  const ordered = CATEGORY_ORDER.filter((category) => counts.has(category))

  return {
    total: entries.length,
    breakdown: ordered.map((category) => ({
      category,
      count: counts.get(category) ?? 0,
    })),
    categoryPrices: ordered.flatMap((category) => {
      const token = lowestToken.get(category)
      const request = lowestRequest.get(category)
      if (token === undefined && request === undefined) return []

      const lowest: CatalogLowestPrice =
        token !== undefined
          ? { unit: 'token', amountUSD: token }
          : { unit: 'request', amountUSD: request as number }

      return [
        {
          category,
          count: counts.get(category) ?? 0,
          lowest,
          mixedBilling: token !== undefined && request !== undefined,
        },
      ]
    }),
  }
}
