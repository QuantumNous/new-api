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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { getTieredBillingSummary } from '@/features/usage-logs/lib/format'

import { DynamicPricingBreakdown } from '../components/dynamic-pricing-breakdown'
import {
  combineBillingExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
} from '../lib/billing-expr'
import { hasDynamicRequestRules } from '../lib/dynamic-price'

const base = 'tier("base", p * 0.0231270000 + c * 0.4400000000)'
const condition =
  'hour("UTC") < 12 || hour("UTC") >= 18 || weekday("UTC") == 0 || weekday("UTC") == 6'
const rules = `((${condition}) ? 0.5 : 1)`
const expression = `${base} * ${rules}`

describe('time request rule display', () => {
  test('extracts base prices from the overnight-or-weekend rule in #7296', () => {
    expect(splitBillingExprAndRequestRules(expression)).toEqual({
      billingExpr: base,
      requestRuleExpr: rules,
    })
    expect(
      getTieredBillingSummary({
        billing_mode: 'tiered_expr',
        expr_b64: btoa(expression),
        matched_tier: 'base',
      })?.tier
    ).toMatchObject({
      label: 'base',
      inputPrice: 0.023127,
      outputPrice: 0.44,
    })
  })

  test('keeps complex rules in raw editing mode and preserves their source', () => {
    const split = splitBillingExprAndRequestRules(expression)
    expect(tryParseRequestRuleExpr(rules)).toBeNull()
    expect(split.requestRuleExpr).toBe(rules)
    expect(combineBillingExpr(split.billingExpr, split.requestRuleExpr)).toBe(
      combineBillingExpr(base, rules)
    )
  })

  test.each([
    '(weekday("UTC")==0||weekday("UTC")==6?5e-1:1)',
    '(!((hour("UTC") >= 12 && hour("UTC") < 18) && weekday("UTC") != 0) ? 0 : 1)',
  ])(
    'recognizes a complete time rule with nested logic or compact syntax: %s',
    (rule) => {
      expect(splitBillingExprAndRequestRules(`${base} * ${rule}`)).toEqual({
        billingExpr: base,
        requestRuleExpr: rule,
      })
    }
  )

  test('retains all factors when time and existing header rules are combined', () => {
    const headerRule = '(header("x-mode") == "a * b" ? 2 : 1)'
    expect(
      splitBillingExprAndRequestRules(`${rules} * (${base}) * ${headerRule}`)
    ).toEqual({
      billingExpr: base,
      requestRuleExpr: `${rules} * ${headerRule}`,
    })
  })

  test('keeps the request-rule indicator on models with complex time conditions', () => {
    expect(
      hasDynamicRequestRules({
        id: 1,
        model_name: 'time-priced-model',
        quota_type: 0,
        model_ratio: 1,
        completion_ratio: 1,
        enable_groups: ['default'],
        billing_mode: 'tiered_expr',
        billing_expr: expression,
      })
    ).toBe(true)
  })

  test.each([
    `(${condition} ? 0.5 : 2)`,
    `(${condition} ? p : 1)`,
    `(${condition} ? 0.5 : 1) + 3`,
    '(hour("UTC") < 12 || unknown("UTC") == 6 ? 0.5 : 1)',
    '(hour("UTC") < 12 || ? 0.5 : 1)',
    `${rules} *`,
  ])(
    'keeps unsupported or malformed factors in the base expression: %s',
    (factor) => {
      const source = `${base} * ${factor}`
      expect(splitBillingExprAndRequestRules(source)).toEqual({
        billingExpr: source,
        requestRuleExpr: '',
      })
      expect(
        getTieredBillingSummary({
          billing_mode: 'tiered_expr',
          expr_b64: btoa(source),
          matched_tier: 'base',
        })
      ).toBeNull()
    }
  )

  test('shows base prices and the multiplier without log traces', () => {
    render(<DynamicPricingBreakdown billingExpr={expression} />)
    expect(screen.getByText('Conditional multipliers')).toBeInTheDocument()
    expect(
      screen.getByText('00:00–12:00 or 18:00–24:00 or Sun or Sat (UTC)')
    ).toBeInTheDocument()
    expect(screen.getByText('0.5x')).toBeInTheDocument()
    expect(screen.getAllByText('$0.0231').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$0.4400').length).toBeGreaterThan(0)
  })

  test.each([true, false])(
    'uses the recorded matched=%s state rather than evaluating the clock',
    (matched) => {
      render(
        <DynamicPricingBreakdown
          billingExpr={expression}
          matchedTierLabel='base'
          requestRules={[{ cond: condition, multiplier: 0.5, matched }]}
        />
      )
      expect(screen.getAllByText('$0.0231').length).toBeGreaterThan(0)
      expect(
        screen.getByText(matched ? '0.5x · Matched' : '0.5x')
      ).toBeInTheDocument()
    }
  )
})
