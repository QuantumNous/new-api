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
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildRequestRuleExpr,
  MATCH_EQ,
  MATCH_GTE,
  MATCH_RANGE,
  type RequestCondition,
  type RequestRuleGroup,
  type TimeCondition,
  type TimeFunc,
  tryParseRequestRuleExpr,
} from '../billing-expr'

function timeCondition(overrides: Partial<TimeCondition> = {}): TimeCondition {
  return {
    source: 'time',
    timeFunc: 'hour',
    timezone: 'Asia/Shanghai',
    mode: MATCH_RANGE,
    value: '',
    rangeStart: '',
    rangeEnd: '',
    ...overrides,
  }
}

function timeRangeGroup(start: string, end: string): RequestRuleGroup {
  return {
    conditions: [timeCondition({ rangeStart: start, rangeEnd: end })],
    multiplier: '2',
  }
}

function scalarTimeGroup(
  value: string,
  timeFunc: TimeFunc = 'hour'
): RequestRuleGroup {
  return {
    conditions: [timeCondition({ mode: MATCH_GTE, value, timeFunc })],
    multiplier: '2',
  }
}

describe('time range expression generation', () => {
  it('within-day range (start < end) builds an && condition', () => {
    // Regression test for #6923: the || form is a tautology that applies the
    // multiplier 24/7.
    assert.equal(
      buildRequestRuleExpr([timeRangeGroup('9', '12')]),
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)'
    )
  })

  it('overnight range (start > end) keeps the || condition', () => {
    assert.equal(
      buildRequestRuleExpr([timeRangeGroup('21', '6')]),
      '(hour("Asia/Shanghai") >= 21 || hour("Asia/Shanghai") < 6 ? 2 : 1)'
    )
  })

  it('equal bounds build an always-false && range instead of a tautology', () => {
    assert.equal(
      buildRequestRuleExpr([timeRangeGroup('9', '9')]),
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 9 ? 2 : 1)'
    )
  })

  const dropCases: [string, string, string][] = [
    ['out-of-domain negative bounds', '-1', '-5'],
    ['out-of-domain upper bound', '9', '24'],
    ['non-integer bound', '9.5', '12'],
  ]
  for (const [name, start, end] of dropCases) {
    it(`drops the rule for ${name}`, () => {
      assert.equal(buildRequestRuleExpr([timeRangeGroup(start, end)]), '')
    })
  }

  it('drops a scalar rule whose value is out of domain', () => {
    assert.equal(buildRequestRuleExpr([scalarTimeGroup('25')]), '')
  })

  const domainCases: [string, string, boolean][] = [
    ['hour', '0', true],
    ['hour', '23', true],
    ['hour', '24', false],
    ['minute', '59', true],
    ['minute', '60', false],
    ['weekday', '0', true],
    ['weekday', '6', true],
    ['weekday', '7', false],
    ['month', '1', true],
    ['month', '12', true],
    ['month', '0', false],
    ['month', '13', false],
    ['day', '1', true],
    ['day', '31', true],
    ['day', '32', false],
  ]
  for (const [timeFunc, value, inDomain] of domainCases) {
    it(`keeps ${timeFunc} value ${value} in domain: ${inDomain}`, () => {
      const expr = buildRequestRuleExpr([
        scalarTimeGroup(value, timeFunc as TimeFunc),
      ])
      assert.equal(expr !== '', inDomain)
    })
  }
})

describe('time range expression parsing', () => {
  it('parses an && range back into a single MATCH_RANGE condition', () => {
    const groups = tryParseRequestRuleExpr(
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)'
    )
    assert.equal(groups?.length, 1)
    assert.equal(groups?.[0].conditions.length, 1)
    const condition = groups?.[0].conditions[0] as TimeCondition
    assert.equal(condition.mode, MATCH_RANGE)
    assert.equal(condition.rangeStart, '9')
    assert.equal(condition.rangeEnd, '12')
  })

  it('still parses a legacy || range into a single MATCH_RANGE condition', () => {
    const groups = tryParseRequestRuleExpr(
      '(hour("Asia/Shanghai") >= 21 || hour("Asia/Shanghai") < 6 ? 2 : 1)'
    )
    assert.equal(groups?.[0].conditions.length, 1)
    const condition = groups?.[0].conditions[0] as TimeCondition
    assert.equal(condition.mode, MATCH_RANGE)
    assert.equal(condition.rangeStart, '21')
    assert.equal(condition.rangeEnd, '6')
  })

  it('merges adjacent time bounds into MATCH_RANGE when other conditions follow', () => {
    const groups = tryParseRequestRuleExpr(
      '(param("service_tier") == "fast" && hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1)'
    )
    assert.deepEqual(
      groups?.[0].conditions.map((c) => c.mode),
      [MATCH_EQ, MATCH_RANGE]
    )
    const range = groups?.[0].conditions[1] as TimeCondition
    assert.equal(range.rangeStart, '9')
    assert.equal(range.rangeEnd, '12')
  })

  it('keeps a parenthesized overnight range as MATCH_RANGE in a mixed group', () => {
    const groups = tryParseRequestRuleExpr(
      '((hour("Asia/Shanghai") >= 21 || hour("Asia/Shanghai") < 6) && param("service_tier") == "fast" ? 3 : 1)'
    )
    assert.deepEqual(
      groups?.[0].conditions.map((c) => c.mode),
      [MATCH_RANGE, MATCH_EQ]
    )
    assert.equal(groups?.[0].multiplier, '3')
  })

  it('parses the issue #6923 two-scalar workaround groups as single ranges', () => {
    const groups = tryParseRequestRuleExpr(
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1) * (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18 ? 2 : 1)'
    )
    assert.equal(groups?.length, 2)
    for (const group of groups ?? []) {
      assert.equal(group.conditions.length, 1)
      assert.equal(group.conditions[0].mode, MATCH_RANGE)
    }
  })

  const rejectCases: [string, string][] = [
    [
      'out-of-domain range bounds',
      '(hour("Asia/Shanghai") >= 25 && hour("Asia/Shanghai") < 30 ? 2 : 1)',
    ],
    [
      'fractional range bounds',
      '(hour("Asia/Shanghai") >= 1.5 && hour("Asia/Shanghai") < 2.5 ? 2 : 1)',
    ],
    ['out-of-domain scalar value', '(hour("Asia/Shanghai") >= 25 ? 2 : 1)'],
    ['out-of-domain weekday value', '(weekday("UTC") >= 7 ? 2 : 1)'],
  ]
  for (const [name, expr] of rejectCases) {
    it(`rejects ${name} instead of parsing them`, () => {
      // Rejected rules keep the editor in raw mode; a lenient parse would let
      // the visual editor silently drop the rule on rebuild.
      assert.equal(tryParseRequestRuleExpr(expr), null)
    })
  }
})

describe('time range round-trip stability', () => {
  it('build → parse → build yields the identical mixed-group expression', () => {
    const groups: RequestRuleGroup[] = [
      {
        conditions: [
          {
            source: 'param',
            path: 'service_tier',
            mode: MATCH_EQ,
            value: 'fast',
          } satisfies RequestCondition,
          timeCondition({ rangeStart: '9', rangeEnd: '12' }),
        ],
        multiplier: '2',
      },
    ]
    const expr = buildRequestRuleExpr(groups)
    const parsed = tryParseRequestRuleExpr(expr)
    assert.notEqual(parsed, null)
    assert.equal(buildRequestRuleExpr(parsed ?? []), expr)
  })
})
