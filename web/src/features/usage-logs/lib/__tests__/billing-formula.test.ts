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
import { assert, describe, test } from 'vitest'

import { buildBillingFormulaText, getBillingFormula } from '../format'

describe('billing formula log formatting', () => {
  test('shows the base group, request multiplier, surcharge, and final charge', () => {
    const formula = getBillingFormula({
      billing_formula: {
        mode: 'per_token',
        base_quota: 1200,
        base_group_ratio: 1.25,
        effective_group_ratio: 1,
        other_ratio: 1.5,
        surcharge_quota: 25,
        final_quota: 1825,
      },
    })

    assert.ok(formula)
    assert.equal(
      buildBillingFormulaText(
        formula,
        (quota) => `Q${quota}`,
        (key) => key
      ),
      'round(Q1200 (Base Charge) × 1.2500x (Base Group Ratio) × 1.5000x (Request Multiplier) + Q25 (Surcharge)) = Q1825'
    )
  })

  test('keeps rendering historical minimum-charge logs', () => {
    const formula = getBillingFormula({
      billing_formula: {
        mode: 'per_call',
        base_quota: 0.1,
        base_group_ratio: 1,
        effective_group_ratio: 1,
        other_ratio: 1,
        surcharge_quota: 0,
        minimum_charge_applied: true,
        final_quota: 1,
      },
    })

    if (!formula) {
      assert.fail('expected a valid historical billing formula')
    }
    assert.equal(
      buildBillingFormulaText(
        formula,
        (quota) => `Q${quota}`,
        (key) => key
      ),
      'max(Q1 (Minimum Charge), round(Q0.1 (Base Charge) × 1.0000x (Base Group Ratio))) = Q1'
    )
  })

  test('does not display malformed or negative billing audit data', () => {
    assert.equal(
      getBillingFormula({
        billing_formula: {
          mode: 'per_token',
          base_quota: -1,
          base_group_ratio: 1,
          effective_group_ratio: 1,
          other_ratio: 1,
          surcharge_quota: 0,
          final_quota: 10,
        },
      }),
      null
    )
  })
})
