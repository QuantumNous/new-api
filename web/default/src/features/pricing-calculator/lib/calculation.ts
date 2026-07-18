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
export type PricingInputs = {
  accountCost: number
  accountPeriodDays: number
  observedStandardUsage: number
  usedPercent: number
  billingPeriodDays: number
  manualRatio: number
  targetMarginPercent: number
}

export type PricingResult = {
  fullPeriodStandardUsage: number
  billingPeriodStandardUsage: number
  billingPeriodCost: number
  accountEquivalents: number
  breakEvenRatio: number
  targetMarginRatio: number
  revenue: number
  grossProfit: number
  grossMargin: number | null
}

export type PricingScenario = {
  ratio: number
  revenue: number
  grossProfit: number
  grossMargin: number | null
}

function finiteAtLeast(value: number, minimum: number): number {
  return Number.isFinite(value) ? Math.max(value, minimum) : minimum
}

export function calculatePricing(input: PricingInputs): PricingResult {
  const accountCost = finiteAtLeast(input.accountCost, 0)
  const accountPeriodDays = finiteAtLeast(input.accountPeriodDays, 1)
  const observedStandardUsage = finiteAtLeast(input.observedStandardUsage, 0)
  const usedRatio = Math.min(finiteAtLeast(input.usedPercent, 0.01) / 100, 1)
  const billingPeriodDays = finiteAtLeast(input.billingPeriodDays, 1)
  const manualRatio = finiteAtLeast(input.manualRatio, 0)
  const targetMargin =
    Math.min(finiteAtLeast(input.targetMarginPercent, 0), 99.9) / 100

  const fullPeriodStandardUsage = observedStandardUsage / usedRatio
  const accountEquivalents = billingPeriodDays / accountPeriodDays
  const billingPeriodStandardUsage =
    fullPeriodStandardUsage * accountEquivalents
  const billingPeriodCost = accountCost * accountEquivalents
  const breakEvenRatio =
    billingPeriodStandardUsage > 0
      ? billingPeriodCost / billingPeriodStandardUsage
      : 0
  const targetMarginRatio = breakEvenRatio / (1 - targetMargin)
  const revenue = billingPeriodStandardUsage * manualRatio
  const grossProfit = revenue - billingPeriodCost
  const grossMargin = revenue > 0 ? grossProfit / revenue : null

  return {
    fullPeriodStandardUsage,
    billingPeriodStandardUsage,
    billingPeriodCost,
    accountEquivalents,
    breakEvenRatio,
    targetMarginRatio,
    revenue,
    grossProfit,
    grossMargin,
  }
}

export function buildPricingScenarios(
  result: PricingResult,
  manualRatio: number
): PricingScenario[] {
  const ratios = [
    result.breakEvenRatio,
    0.03,
    0.05,
    0.1,
    0.15,
    manualRatio,
    0.35,
  ]
    .filter((ratio) => Number.isFinite(ratio) && ratio > 0)
    .filter(
      (ratio, index, values) =>
        values.findIndex((value) => Math.abs(value - ratio) < 0.0000001) ===
        index
    )
    .sort((left, right) => left - right)

  return ratios.map((ratio) => {
    const revenue = result.billingPeriodStandardUsage * ratio
    const grossProfit = revenue - result.billingPeriodCost
    return {
      ratio,
      revenue,
      grossProfit,
      grossMargin: revenue > 0 ? grossProfit / revenue : null,
    }
  })
}
