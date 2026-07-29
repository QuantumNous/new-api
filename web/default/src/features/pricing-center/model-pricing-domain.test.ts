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

import {
  editorToPricing,
  mergeReferenceResolution,
} from './model-pricing-domain'

describe('editorToPricing', () => {
  it('preserves explicit zero prices', () => {
    expect(
      editorToPricing({
        name: 'free-model',
        billingMode: 'per-token',
        ratio: '0',
        completionRatio: '0',
      })
    ).toEqual({
      mode: 'per-token',
      model_ratio: 0,
      completion_ratio: 0,
    })
  })
})

describe('mergeReferenceResolution', () => {
  it('rejects dependent token prices without a base model ratio', () => {
    expect(
      mergeReferenceResolution({ mode: 'unset' }, { completion_ratio: 2 })
    ).toBeNull()
  })

  it('preserves an existing per-token base when adopting dependent prices', () => {
    expect(
      mergeReferenceResolution(
        { mode: 'per-token', model_ratio: 1 },
        { completion_ratio: 2 }
      )
    ).toEqual({
      mode: 'per-token',
      model_ratio: 1,
      completion_ratio: 2,
    })
  })

  it('normalizes the legacy ratio billing mode', () => {
    expect(
      mergeReferenceResolution(
        { mode: 'unset' },
        { billing_mode: 'ratio', model_ratio: 0 }
      )
    ).toEqual({ mode: 'per-token', model_ratio: 0 })
  })

  it('rejects a tiered mode without an expression', () => {
    expect(
      mergeReferenceResolution(
        { mode: 'unset' },
        { billing_mode: 'tiered_expr' }
      )
    ).toBeNull()
  })
})
