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
import { describe, expect, it } from 'vitest'

import { MODEL_PRICES, MODEL_PRICES_TRY_PER_USD } from '../data/model-prices'
import {
  ACTIVE_HOURS_PER_DAY,
  HEAVY_USD_PER_ACTIVE_DAY,
  HOURS_PER_SMALL_PROJECT,
  REFERENCE_MODEL,
  TYPICAL_USD_PER_ACTIVE_DAY,
  USAGE_BUDGETS_TRY,
  estimateUsage,
  formatEstimate,
} from '../lib/usage-calculator'

describe('estimateUsage', () => {
  it('prices the reference model at half of its list price', () => {
    const budget = 1000
    const estimate = estimateUsage(budget, REFERENCE_MODEL)
    const budgetUsd = budget / MODEL_PRICES_TRY_PER_USD
    // Half price means the same daily spend lasts twice as long.
    expect(estimate?.hoursHigh).toBeCloseTo(
      (budgetUsd / (TYPICAL_USD_PER_ACTIVE_DAY / ACTIVE_HOURS_PER_DAY)) * 2,
      6
    )
    expect(estimate?.hoursLow).toBeCloseTo(
      (budgetUsd / (HEAVY_USD_PER_ACTIVE_DAY / ACTIVE_HOURS_PER_DAY)) * 2,
      6
    )
  })

  it('turns hours into small projects with the stated hours per project', () => {
    const estimate = estimateUsage(500, REFERENCE_MODEL)
    expect(estimate?.projectsHigh).toBeCloseTo(
      (estimate?.hoursHigh ?? 0) / HOURS_PER_SMALL_PROJECT,
      6
    )
  })

  it('lasts longer on a cheaper model and shorter on a dearer one', () => {
    const cheap = estimateUsage(500, 'claude-haiku-5-5')
    const base = estimateUsage(500, REFERENCE_MODEL)
    const dear = estimateUsage(500, 'gpt-6-astra')
    expect(cheap?.hoursHigh).toBeGreaterThan(base?.hoursHigh ?? 0)
    expect(base?.hoursHigh).toBeGreaterThan(dear?.hoursHigh ?? 0)
  })

  it('scales linearly with the budget and keeps the range ordered', () => {
    const small = estimateUsage(USAGE_BUDGETS_TRY[0], REFERENCE_MODEL)
    const large = estimateUsage(USAGE_BUDGETS_TRY[3], REFERENCE_MODEL)
    if (!small || !large) throw new Error('Expected estimates for both budgets')
    expect(large.hoursHigh / small.hoursHigh).toBeCloseTo(
      USAGE_BUDGETS_TRY[3] / USAGE_BUDGETS_TRY[0],
      6
    )
    expect(small.hoursLow).toBeLessThan(small.hoursHigh)
  })

  it('has an estimate for every model in the price table', () => {
    for (const price of MODEL_PRICES) {
      expect(estimateUsage(500, price.model)).not.toBeNull()
    }
  })

  it('guesses nothing for an unknown model or a budget that is not positive', () => {
    expect(estimateUsage(500, 'no-such-model')).toBeNull()
    expect(estimateUsage(0, REFERENCE_MODEL)).toBeNull()
    expect(estimateUsage(-5, REFERENCE_MODEL)).toBeNull()
  })
})

describe('formatEstimate', () => {
  it('shows one decimal below ten, whole numbers above and <1 under one', () => {
    expect(formatEstimate(0.4, 'en')).toBe('<1')
    expect(formatEstimate(3.46, 'en')).toBe('3.5')
    expect(formatEstimate(12.6, 'en')).toBe('13')
    expect(formatEstimate(Number.NaN, 'en')).toBe('-')
  })
})
