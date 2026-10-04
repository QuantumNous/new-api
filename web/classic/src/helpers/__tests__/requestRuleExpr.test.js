/*
Copyright (C) 2025-2026 QuantumNous

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

import { describe, expect, it } from 'bun:test';
import {
  buildRequestRuleExpr,
  tryParseRequestRuleExpr,
  MATCH_EQ,
  MATCH_GTE,
  MATCH_RANGE,
  SOURCE_TIME,
  SOURCE_PARAM,
} from '../../pages/Setting/Ratio/components/requestRuleExpr';

function timeCondition(overrides = {}) {
  return {
    source: SOURCE_TIME,
    timeFunc: 'hour',
    timezone: 'Asia/Shanghai',
    mode: MATCH_RANGE,
    value: '',
    rangeStart: '',
    rangeEnd: '',
    ...overrides,
  };
}

function timeRangeGroup(start, end, multiplier = '2') {
  return {
    conditions: [timeCondition({ rangeStart: start, rangeEnd: end })],
    multiplier,
  };
}

function scalarTimeGroup(value, timeFunc = 'hour', multiplier = '2') {
  return {
    conditions: [timeCondition({ mode: MATCH_GTE, value, timeFunc })],
    multiplier,
  };
}

describe('time range expression generation', () => {
  it('9~18 within-day range generates && condition', () => {
    // Regression test for #6923: the || form was a tautology that applied the
    // multiplier 24/7 when start <= end.
    expect(buildRequestRuleExpr([timeRangeGroup('9', '18')])).toBe(
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 18 ? 2 : 1)',
    );
  });

  it('22~6 overnight range generates || condition', () => {
    expect(buildRequestRuleExpr([timeRangeGroup('22', '6')])).toBe(
      '(hour("Asia/Shanghai") >= 22 || hour("Asia/Shanghai") < 6 ? 2 : 1)',
    );
  });

  it('equal bounds build an always-false && range instead of a tautology', () => {
    expect(buildRequestRuleExpr([timeRangeGroup('9', '9')])).toBe(
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 9 ? 2 : 1)',
    );
  });

  it.each([
    ['out-of-domain negative bounds', '-1', '-5'],
    ['out-of-domain upper bound', '9', '24'],
    ['non-integer bound', '9.5', '18'],
  ])('drops the rule for %s', (_name, start, end) => {
    expect(buildRequestRuleExpr([timeRangeGroup(start, end)])).toBe('');
  });

  it('drops a scalar rule whose value is out of domain', () => {
    expect(buildRequestRuleExpr([scalarTimeGroup('25')])).toBe('');
  });

  it.each([
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
  ])('keeps %s value %s in domain: %s', (timeFunc, value, inDomain) => {
    const expr = buildRequestRuleExpr([scalarTimeGroup(value, timeFunc)]);
    expect(expr !== '').toBe(inDomain);
  });
});

describe('time range expression parsing', () => {
  it('parses an && range back into a single MATCH_RANGE condition', () => {
    const groups = tryParseRequestRuleExpr(
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 18 ? 2 : 1)',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].conditions).toHaveLength(1);
    const condition = groups[0].conditions[0];
    expect(condition.source).toBe(SOURCE_TIME);
    expect(condition.mode).toBe(MATCH_RANGE);
    expect(condition.rangeStart).toBe('9');
    expect(condition.rangeEnd).toBe('18');
  });

  it('parses an || overnight range back into a single MATCH_RANGE condition', () => {
    const groups = tryParseRequestRuleExpr(
      '(hour("Asia/Shanghai") >= 22 || hour("Asia/Shanghai") < 6 ? 2 : 1)',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].conditions).toHaveLength(1);
    const condition = groups[0].conditions[0];
    expect(condition.source).toBe(SOURCE_TIME);
    expect(condition.mode).toBe(MATCH_RANGE);
    expect(condition.rangeStart).toBe('22');
    expect(condition.rangeEnd).toBe('6');
  });

  it('merges adjacent time bounds into MATCH_RANGE when other conditions follow', () => {
    const groups = tryParseRequestRuleExpr(
      '(param("service_tier") == "fast" && hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 18 ? 2 : 1)',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].conditions.map((c) => c.mode)).toEqual([
      MATCH_EQ,
      MATCH_RANGE,
    ]);
    const range = groups[0].conditions[1];
    expect(range.rangeStart).toBe('9');
    expect(range.rangeEnd).toBe('18');
  });

  it('keeps a parenthesized overnight range as MATCH_RANGE in a mixed group', () => {
    const groups = tryParseRequestRuleExpr(
      '((hour("Asia/Shanghai") >= 22 || hour("Asia/Shanghai") < 6) && param("service_tier") == "fast" ? 3 : 1)',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].conditions.map((c) => c.mode)).toEqual([
      MATCH_RANGE,
      MATCH_EQ,
    ]);
    expect(groups[0].multiplier).toBe('3');
  });

  it('parses two-scalar workaround groups as single ranges', () => {
    const groups = tryParseRequestRuleExpr(
      '(hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? 2 : 1) * (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18 ? 2 : 1)',
    );
    expect(groups).toHaveLength(2);
    for (const group of groups || []) {
      expect(group.conditions).toHaveLength(1);
      expect(group.conditions[0].mode).toBe(MATCH_RANGE);
    }
  });

  it('parses legacy || range saved expression', () => {
    const legacyExpr =
      '(hour("Asia/Shanghai") >= 21 || hour("Asia/Shanghai") < 6 ? 0.5 : 1)';
    const groups = tryParseRequestRuleExpr(legacyExpr);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(1);
    expect(groups[0].multiplier).toBe('0.5');
    expect(groups[0].conditions).toHaveLength(1);
    expect(groups[0].conditions[0].mode).toBe(MATCH_RANGE);
    expect(groups[0].conditions[0].rangeStart).toBe('21');
    expect(groups[0].conditions[0].rangeEnd).toBe('6');
  });

  it.each([
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
  ])('rejects %s instead of parsing them', (_name, expr) => {
    expect(tryParseRequestRuleExpr(expr)).toBeNull();
  });
});

describe('time range round-trip stability', () => {
  it('build → parse → build yields identical mixed-group expression with within-day range', () => {
    const groups = [
      {
        conditions: [
          {
            source: SOURCE_PARAM,
            path: 'service_tier',
            mode: MATCH_EQ,
            value: 'fast',
          },
          timeCondition({ rangeStart: '9', rangeEnd: '18' }),
        ],
        multiplier: '2',
      },
    ];
    const expr = buildRequestRuleExpr(groups);
    const parsed = tryParseRequestRuleExpr(expr);
    expect(parsed).not.toBeNull();
    expect(buildRequestRuleExpr(parsed)).toBe(expr);
  });

  it('build → parse → build yields identical mixed-group expression with overnight range', () => {
    const groups = [
      {
        conditions: [
          timeCondition({ rangeStart: '22', rangeEnd: '6' }),
          {
            source: SOURCE_PARAM,
            path: 'service_tier',
            mode: MATCH_EQ,
            value: 'fast',
          },
        ],
        multiplier: '3',
      },
    ];
    const expr = buildRequestRuleExpr(groups);
    const parsed = tryParseRequestRuleExpr(expr);
    expect(parsed).not.toBeNull();
    expect(buildRequestRuleExpr(parsed)).toBe(expr);
  });
});

describe('cross-theme request rule alignment & fallback', () => {
  it('parses multi-group time expressions generated by default editor', () => {
    const expr =
      '(hour("Asia/Shanghai") >= 21 || hour("Asia/Shanghai") < 6 ? 0.5 : 1) * (weekday("Asia/Shanghai") == 0 ? 0.8 : 1)';
    const parsed = tryParseRequestRuleExpr(expr);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(2);
    expect(parsed[0].conditions[0].timeFunc).toBe('hour');
    expect(parsed[0].conditions[0].mode).toBe(MATCH_RANGE);
    expect(parsed[1].conditions[0].timeFunc).toBe('weekday');
    expect(parsed[1].conditions[0].mode).toBe(MATCH_EQ);
  });

  it('safely returns null for complex nested boolean expressions to trigger raw mode fallback', () => {
    const complexExpr =
      '((hour("UTC") >= 9 && hour("UTC") < 18) || header("vip") == "true" ? 0.5 : 1)';
    expect(tryParseRequestRuleExpr(complexExpr)).toBeNull();
  });
});
