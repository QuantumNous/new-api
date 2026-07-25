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
  COMMON_TIMEZONES,
  buildRequestRuleExpr,
  createEmptyTimeCondition,
  normalizeCondition,
} from './billing-expr'

describe('billing expression timezones', () => {
  it('uses Ho Chi Minh City for new and missing time-rule timezones', () => {
    expect(COMMON_TIMEZONES.map((timezone) => timezone.value)).toContain(
      'Asia/Ho_Chi_Minh'
    )
    expect(createEmptyTimeCondition().timezone).toBe('Asia/Ho_Chi_Minh')
    expect(normalizeCondition({ source: 'time' })).toMatchObject({
      source: 'time',
      timezone: 'Asia/Ho_Chi_Minh',
    })
    expect(createEmptyTimeCondition('Asia/Tokyo').timezone).toBe('Asia/Tokyo')
  })

  it('preserves an explicitly saved Shanghai timezone', () => {
    expect(
      normalizeCondition({ source: 'time', timezone: 'Asia/Shanghai' })
    ).toMatchObject({
      source: 'time',
      timezone: 'Asia/Shanghai',
    })
  })

  it('uses the configured fallback only when a rule has no timezone', () => {
    expect(
      buildRequestRuleExpr(
        [
          {
            conditions: [
              {
                ...createEmptyTimeCondition(),
                timezone: '',
                value: '9',
              },
            ],
            multiplier: '0.8',
          },
        ],
        'Asia/Tokyo'
      )
    ).toContain('hour("Asia/Tokyo")')

    expect(
      buildRequestRuleExpr(
        [
          {
            conditions: [
              {
                ...createEmptyTimeCondition('Asia/Shanghai'),
                value: '9',
              },
            ],
            multiplier: '0.8',
          },
        ],
        'Asia/Tokyo'
      )
    ).toContain('hour("Asia/Shanghai")')
  })
})
