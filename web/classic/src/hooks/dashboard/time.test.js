/*
Copyright (C) 2025 QuantumNous

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

import { describe, expect, test } from 'bun:test';
import { parseDashboardDateRange, parseDashboardTimestamp } from './time';

test('Classic dashboard wall-clock strings always use Asia/Shanghai', () => {
  expect(parseDashboardTimestamp('2024-01-01 00:00:00')).toBe(1704038400);
  expect(parseDashboardTimestamp('2024-01-01T08:00:00')).toBe(1704067200);
});

test('Date values are converted through fixed Asia/Shanghai across DST gaps', () => {
  // The -05:00 wall-clock value falls in the America/New_York spring-forward
  // gap.  Parsing the Date as an instant must remain stable regardless of the
  // browser TZ; local getHours() would reinterpret it after normalization.
  const selected = new Date('2024-03-10T02:30:00-05:00');
  expect(parseDashboardTimestamp(selected)).toBe(
    Math.floor(selected.getTime() / 1000),
  );
});

test('explicit-offset values remain instants and ranges are numeric seconds', () => {
  const range = parseDashboardDateRange(
    '2024-01-01T00:00:00+08:00',
    '2024-01-01T01:00:00+08:00',
  );
  expect(range).toEqual({ start: 1704038400, end: 1704042000 });
});

// A fractional number used to be floored here, which manufactured a valid
// looking whole second out of an invalid bound and slipped it past the strict
// range validator. These tests pin the parser itself, not the validator.
describe('numeric dashboard bounds are exact or rejected', () => {
  const SECONDS = 1782835242; // 2026-07-01 00:00:42 Asia/Shanghai

  test('a whole second is returned unchanged', () => {
    expect(parseDashboardTimestamp(SECONDS)).toBe(SECONDS);
    expect(parseDashboardTimestamp(1)).toBe(1);
  });

  const rejectedNumbers = [
    ['fractional second', SECONDS + 0.5],
    ['fraction below one second', 0.5],
    ['tiny fraction', 0.000001],
    ['negative fraction', -0.5],
    ['fractional millisecond', 1782835242500.5],
    ['zero', 0],
    ['negative second', -1],
    ['negative millisecond', -1782835242000],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 2],
    ['MAX_VALUE', Number.MAX_VALUE],
  ];

  for (const [name, value] of rejectedNumbers) {
    test(`${name} is not parseable`, () => {
      expect(Number.isNaN(parseDashboardTimestamp(value))).toBe(true);
    });
  }

  test('a fraction is never rounded into a neighbouring whole second', () => {
    // The specific regression: 1782835242.5 must not become 1782835242.
    expect(parseDashboardTimestamp(SECONDS + 0.5)).not.toBe(SECONDS);
    expect(parseDashboardTimestamp(SECONDS + 0.5)).not.toBe(SECONDS + 1);
    expect(Number.isNaN(parseDashboardTimestamp(SECONDS + 0.5))).toBe(true);
  });

  test('whole milliseconds are truncated to seconds, matching Date.getTime()', () => {
    // Above 1e11 a number is read as milliseconds; truncating is that unit's
    // documented meaning, not a repair of a malformed value.
    expect(parseDashboardTimestamp(SECONDS * 1000)).toBe(SECONDS);
    expect(parseDashboardTimestamp(SECONDS * 1000 + 999)).toBe(SECONDS);
    expect(parseDashboardTimestamp(new Date(SECONDS * 1000).getTime())).toBe(
      SECONDS,
    );
  });

  test('parseDashboardDateRange surfaces an invalid bound on either side', () => {
    expect(
      Number.isNaN(parseDashboardDateRange(SECONDS + 0.5, SECONDS + 1).start),
    ).toBe(true);
    expect(
      Number.isNaN(parseDashboardDateRange(SECONDS, SECONDS + 0.5).end),
    ).toBe(true);

    const valid = parseDashboardDateRange(SECONDS, SECONDS + 60);
    expect(valid.start).toBe(SECONDS);
    expect(valid.end).toBe(SECONDS + 60);
  });
});

describe('Date bounds keep their sub-second behaviour', () => {
  const SECONDS = 1782835242;

  test('a sub-second Date is truncated to its whole CST second', () => {
    expect(parseDashboardTimestamp(new Date(SECONDS * 1000 + 500))).toBe(
      SECONDS,
    );
    expect(parseDashboardTimestamp(new Date(SECONDS * 1000))).toBe(SECONDS);
  });

  test('an Invalid Date is not parseable', () => {
    expect(Number.isNaN(parseDashboardTimestamp(new Date(Number.NaN)))).toBe(
      true,
    );
    expect(Number.isNaN(parseDashboardTimestamp(new Date('not-a-date')))).toBe(
      true,
    );
  });
});

// Date.parse guesses a calendar year from a bare number: '0' becomes
// 2000-01-01, '-1' becomes 2001-01-01 and '1.5' becomes 2001-01-05 CST. A
// numeric string must therefore never reach Date.parse; it goes through the
// same rule as a number value.
describe('bare numeric strings never reach Date.parse', () => {
  const SECONDS = 1782835242;

  const rejectedStrings = [
    ['zero', '0'],
    ['negative one', '-1'],
    ['negative', '-1782835242'],
    ['fraction', '1.5'],
    ['fractional second', '1782835242.5'],
    ['leading dot fraction', '.5'],
    ['trailing dot', '1782835242.'],
    ['plus zero', '+0'],
    ['exponent form', '1e3'],
    ['unsafe integer', '9007199254740993'],
    ['NaN literal', 'NaN'],
    ['Infinity literal', 'Infinity'],
    ['negative Infinity literal', '-Infinity'],
    ['padded zero', '  0  '],
  ];

  for (const [name, text] of rejectedStrings) {
    test(`${name} (${JSON.stringify(text)}) is not parseable`, () => {
      expect(Number.isNaN(parseDashboardTimestamp(text))).toBe(true);
    });
  }

  test("'0' is no longer read as the year 2000", () => {
    // The regression: Date.parse('0') is 2000-01-01T00:00:00+08:00.
    expect(parseDashboardTimestamp('0')).not.toBe(946656000);
    expect(Number.isNaN(parseDashboardTimestamp('0'))).toBe(true);
  });

  test("'-1' is no longer read as the year 2001", () => {
    expect(Number.isNaN(parseDashboardTimestamp('-1'))).toBe(true);
  });

  test("'1.5' is no longer read as a January 2001 date", () => {
    expect(Number.isNaN(parseDashboardTimestamp('1.5'))).toBe(true);
  });

  test('a positive whole-second string parses as that second', () => {
    // Previously Date.parse('1782835242') was NaN, so a legitimate numeric
    // bound was rejected; it now follows the numeric rule.
    expect(parseDashboardTimestamp(String(SECONDS))).toBe(SECONDS);
    expect(parseDashboardTimestamp('1')).toBe(1);
    expect(parseDashboardTimestamp('  ' + String(SECONDS) + '  ')).toBe(
      SECONDS,
    );
  });

  test('a positive whole-millisecond string truncates to seconds', () => {
    expect(parseDashboardTimestamp(String(SECONDS * 1000))).toBe(SECONDS);
    expect(parseDashboardTimestamp(String(SECONDS * 1000 + 999))).toBe(SECONDS);
  });

  test('the seconds/milliseconds boundary matches the number rule', () => {
    // 1e11 exactly is still seconds; one more is milliseconds.
    expect(parseDashboardTimestamp('100000000000')).toBe(100000000000);
    expect(parseDashboardTimestamp(100000000000)).toBe(100000000000);
    expect(parseDashboardTimestamp('100000000001')).toBe(100000000);
    expect(parseDashboardTimestamp(100000000001)).toBe(100000000);
  });

  test('signed, fractional and exponent forms are refused, not coerced', () => {
    // Each of these is numerically exact, but no timestamp field emits them,
    // so they are rejected rather than quietly accepted.
    expect(Number.isNaN(parseDashboardTimestamp('1e3'))).toBe(true);
    expect(Number.isNaN(parseDashboardTimestamp('1782835242.'))).toBe(true);
    expect(Number.isNaN(parseDashboardTimestamp('+1782835242'))).toBe(true);
    expect(Number.isNaN(parseDashboardTimestamp('0001782835242'))).toBe(false);
  });

  test('the safe upper bound is respected for strings too', () => {
    expect(
      Number.isNaN(
        parseDashboardTimestamp(String(Number.MAX_SAFE_INTEGER + 2)),
      ),
    ).toBe(true);
    // MAX_SAFE_INTEGER itself is above the millisecond threshold, so it
    // truncates to seconds rather than being rejected by the parser; the range
    // validator owns the upper bound from there.
    expect(parseDashboardTimestamp(String(Number.MAX_SAFE_INTEGER))).toBe(
      Math.floor(Number.MAX_SAFE_INTEGER / 1000),
    );
  });

  test('date-shaped and ISO strings are unaffected', () => {
    expect(parseDashboardTimestamp('2024-01-01 00:00:00')).toBe(1704038400);
    expect(parseDashboardTimestamp('2026-07-01 00:00:42')).toBe(SECONDS);
    // An explicit offset still carries its own timezone through Date.parse.
    expect(parseDashboardTimestamp('2024-01-01T00:00:00+08:00')).toBe(
      1704038400,
    );
    expect(parseDashboardTimestamp('2024-01-01T00:00:00Z')).toBe(1704067200);
  });
});
