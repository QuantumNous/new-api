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
import { compileBillingExpression } from '@/features/pricing/lib/billing-expression/parser'
import {
  expressionDependencies,
  type ExpressionNode,
} from '@/features/pricing/lib/billing-expression/types'
import {
  parseVisualBillingDocument,
  serializeVisualBillingDocument,
} from '@/features/pricing/lib/billing-expression/visual'

import type { PricingSyncValues } from '../types'

export type PriceAdjustment = 'keep' | 'divide' | 'multiply'
export type AdjustedSyncPrice =
  | { values: PricingSyncValues; error?: never }
  | { values?: never; error: string }

// Always derive from the immutable upstream quote, never from a previous result.
export function adjustSyncPrice(
  values: PricingSyncValues,
  mode: PriceAdjustment,
  rate: number | null
): AdjustedSyncPrice {
  if (mode === 'keep') return { values }
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    return { error: 'A valid site exchange rate is required.' }
  }
  const adjusted = { ...values }
  if (values.billing_mode !== 'tiered_expr') {
    const field =
      typeof values.model_price === 'number' ? 'model_price' : 'model_ratio'
    const amount = values[field]
    if (typeof amount !== 'number') return { error: 'Unset price' }
    const price = adjustPriceAmount(amount, mode, rate)
    if (price === null) {
      return { error: 'The adjusted price is outside the supported range.' }
    }
    adjusted[field] = price
    return { values: adjusted }
  }
  const source = values.billing_expr
  if (typeof source !== 'string') return { error: 'Unset price' }
  const compiled = compileBillingExpression(source)
  const unsupported = {
    error:
      'This expression cannot be adjusted automatically. Keep the source price or edit it manually.',
  }
  if (compiled.status !== 'ready') return unsupported
  const stack: ExpressionNode[] = [compiled.ast]
  const patches: { start: number; end: number; text: string }[] = []
  while (stack.length) {
    const node = stack.pop()
    if (!node) break
    if (node.kind === 'conditional') {
      const calls = expressionDependencies(node.condition).functions
      if (calls.has('tier') || calls.has('fixed')) return unsupported
      stack.push(node.yes, node.no)
      continue
    }
    if (node.kind === 'binary' && node.operator === '*') {
      const factor = [node.left, node.right].find(
        (candidate) =>
          (candidate.kind === 'variable' && candidate.name === 'image_count') ||
          compiled.requestRules.some((rule) => rule.node === candidate)
      )
      if (!factor) return unsupported
      stack.push(factor === node.left ? node.right : node.left)
      continue
    }
    if (node.kind !== 'call' || node.name !== 'tier') return unsupported
    // The shared visual adapter validates the entire price leaf. It preserves
    // zero fields and source spans; arbitrary/nonlinear bodies are not guessed.
    const document = parseVisualBillingDocument(
      source.slice(node.start, node.end)
    )
    if (!document || document.root.kind !== 'tier') return unsupported
    const tier = document.root
    if (tier.billingUnit === 'request') {
      const price = adjustPriceAmount(Number(tier.fixedPrice), mode, rate)
      if (price === null) {
        return { error: 'The adjusted price is outside the supported range.' }
      }
      tier.fixedPrice = String(price)
    } else {
      for (const entry of tier.prices) {
        const price = adjustPriceAmount(Number(entry.value), mode, rate)
        if (price === null) {
          return { error: 'The adjusted price is outside the supported range.' }
        }
        entry.value = String(price)
      }
    }
    const serialized = serializeVisualBillingDocument(document)
    if (!serialized.ok) {
      return { error: 'The adjusted price is outside the supported range.' }
    }
    patches.push({ start: node.start, end: node.end, text: serialized.source })
  }
  let expression = source
  for (const patch of patches.sort((a, b) => b.start - a.start)) {
    expression =
      expression.slice(0, patch.start) +
      patch.text +
      expression.slice(patch.end)
  }
  if (compileBillingExpression(expression).status !== 'ready') {
    return unsupported
  }
  adjusted.billing_expr = expression
  return { values: adjusted }
}

function adjustPriceAmount(
  amount: number,
  mode: PriceAdjustment,
  rate: number
): number | null {
  const price = mode === 'divide' ? amount / rate : amount * rate
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(price) ||
    price < 0 ||
    (amount > 0 && price === 0)
  ) {
    return null
  }
  return price
}
