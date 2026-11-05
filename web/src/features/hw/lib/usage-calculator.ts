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
import { getFormatLocale } from '@/lib/format-locale'

import {
  MODEL_PRICES,
  MODEL_PRICES_TRY_PER_USD,
  blendedPrice,
  type ModelPrice,
} from '../data/model-prices'
import {
  hwTryAmountIn,
  niceFloor,
  type HwCurrency,
  type HwRates,
} from './currency'

/**
 * "What does my credit buy?" estimate for people who are new to AI coding tools.
 *
 * There is no official figure for tokens per hour of coding, so the estimate is
 * built from the one published number there is: Anthropic's own cost guide
 * (https://code.claude.com/docs/en/costs) reports an average of about 13 USD per
 * developer per active day, and below 30 USD per active day for 90 % of users,
 * at list prices. The guide does not name a model, so the reference model, the
 * active hours per day and the hours per small project are our own assumptions.
 * Every one of them is shown next to the result.
 *
 * The estimate only rescales that daily spend by price. All HisarWeb models
 * charge output at the same multiple of input, so the ratio of the summed
 * input and output prices does not depend on the input/output mix.
 */
export const USAGE_SOURCE_URL = 'https://code.claude.com/docs/en/costs'

/** USD per active day at list price: the average, and the 90th percentile. */
export const TYPICAL_USD_PER_ACTIVE_DAY = 13
export const HEAVY_USD_PER_ACTIVE_DAY = 30

/** Our own assumptions, shown with every result. */
export const ACTIVE_HOURS_PER_DAY = 4
export const HOURS_PER_SMALL_PROJECT = 3
export const REFERENCE_MODEL = 'claude-sonnet-5-5'

export const USAGE_BUDGETS_TRY = [250, 500, 1000, 2500] as const

/** The budget buttons in `currency`: the TRY budgets, converted via USD. */
export function usageBudgetsIn(currency: HwCurrency, rates: HwRates): number[] {
  return USAGE_BUDGETS_TRY.map((budget) =>
    niceFloor(hwTryAmountIn(budget, currency, rates))
  )
}

/** Units of `currency` per USD for the estimate; TRY uses the price table's rate. */
export function usageRatePerUsd(currency: HwCurrency, rates: HwRates): number {
  if (currency === 'TRY') return MODEL_PRICES_TRY_PER_USD
  return currency === 'USD' ? 1 : (rates[currency] ?? MODEL_PRICES_TRY_PER_USD)
}

export type UsageEstimate = {
  /** Hours of active coding when the usage is as heavy as the top 10 % of users. */
  hoursLow: number
  /** Hours of active coding at average usage. */
  hoursHigh: number
  projectsLow: number
  projectsHigh: number
}

export function findModelPrice(model: string): ModelPrice | undefined {
  return MODEL_PRICES.find((price) => price.model === model)
}

/**
 * Estimates how long `budget` (in a currency worth `ratePerUsd` per USD, TRY by
 * default) lasts on `model`. Returns null when the budget is not positive or a
 * price is missing, so nothing is guessed.
 */
export function estimateUsage(
  budget: number,
  model: string,
  ratePerUsd: number = MODEL_PRICES_TRY_PER_USD
): UsageEstimate | null {
  const ours = findModelPrice(model)?.hisarweb
  const reference = findModelPrice(REFERENCE_MODEL)?.official
  if (!ours || !reference || !(budget > 0)) return null

  const priceRatio = blendedPrice(ours) / blendedPrice(reference)
  const budgetUsd = budget / ratePerUsd
  const hoursFor = (usdPerDay: number) =>
    budgetUsd / ((usdPerDay / ACTIVE_HOURS_PER_DAY) * priceRatio)

  const hoursLow = hoursFor(HEAVY_USD_PER_ACTIVE_DAY)
  const hoursHigh = hoursFor(TYPICAL_USD_PER_ACTIVE_DAY)
  return {
    hoursLow,
    hoursHigh,
    projectsLow: hoursLow / HOURS_PER_SMALL_PROJECT,
    projectsHigh: hoursHigh / HOURS_PER_SMALL_PROJECT,
  }
}

/** Rounds for display: one decimal below 10, whole numbers above, "<1" below one. */
export function formatEstimate(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return '-'
  if (value < 1) return '<1'
  const digits = value < 10 ? 1 : 0
  return new Intl.NumberFormat(locale ?? getFormatLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value)
}
