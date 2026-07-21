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
import type { PricingModel } from '../types'
import { isDynamicPricingModel } from './dynamic-price'

function resolutionSortValue(resolution: string): number {
  const normalized = resolution.trim().toUpperCase()
  const multiplier = normalized.endsWith('K') ? 1000 : 1
  const numericValue = Number.parseInt(normalized.replace(/K$/, ''), 10)
  return Number.isFinite(numericValue)
    ? numericValue * multiplier
    : Number.POSITIVE_INFINITY
}

export function getImageResolutionPriceEntries(
  model: PricingModel
): Array<[string, number]> {
  if (isDynamicPricingModel(model)) return []

  return Object.entries(model.image_resolution_prices ?? {})
    .filter(
      ([resolution, price]) =>
        resolution.trim().length > 0 && Number.isFinite(price) && price >= 0
    )
    .sort(
      ([resolutionA], [resolutionB]) =>
        resolutionSortValue(resolutionA) - resolutionSortValue(resolutionB) ||
        resolutionA.localeCompare(resolutionB)
    )
}

export function getImageResolutionStartingPrice(
  model: PricingModel
): number | null {
  const prices = getImageResolutionPriceEntries(model)
  if (prices.length === 0) return null

  return prices.reduce(
    (lowest, [, price]) => Math.min(lowest, price),
    Number.POSITIVE_INFINITY
  )
}
