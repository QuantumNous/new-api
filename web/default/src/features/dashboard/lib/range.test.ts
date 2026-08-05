import { describe, expect, test } from 'bun:test'
import {
  type DashboardRangeErrorCode,
  DASHBOARD_BUCKET_OFFSET_SECONDS,
  DASHBOARD_MAX_RANGE_DAYS,
  DASHBOARD_MAX_TIMESTAMP,
  DASHBOARD_MAX_RANGE_SECONDS,
  DASHBOARD_MAX_SEGMENT_DAYS,
  DASHBOARD_RANGE_INVALID,
  DASHBOARD_RANGE_INVERTED,
  DASHBOARD_RANGE_TOO_LARGE,
  DashboardRangeError,
  assertDashboardRange,
  describeDashboardRangeError,
  isDashboardTimestamp,
  validateDashboardRange,
} from './range'

const DAY = 24 * 60 * 60
// 2026-07-01 00:00:42 through 2026-08-05 11:07:45 Asia/Shanghai: the exact
// dashboard selection moni reported as rejected.
const REPORTED_START = 1782835242
const REPORTED_END = 1785899265

describe('dashboard range policy', () => {
  test('mirrors the server bounds', () => {
    expect(DASHBOARD_MAX_RANGE_DAYS).toBe(90)
    expect(DASHBOARD_MAX_SEGMENT_DAYS).toBe(31)
    expect(DASHBOARD_MAX_RANGE_SECONDS).toBe(DASHBOARD_MAX_RANGE_DAYS * DAY)
  })

  test('the reported range is longer than one segment and shorter than the bound', () => {
    const span = REPORTED_END - REPORTED_START
    expect(span).toBeGreaterThan(DASHBOARD_MAX_SEGMENT_DAYS * DAY)
    expect(span).toBeGreaterThan(30 * DAY)
    expect(span).toBeLessThan(DASHBOARD_MAX_RANGE_SECONDS)
  })

  const cases: Array<[string, number, number, DashboardRangeErrorCode | null]> =
    [
      [
        'cross month within 31 days',
        REPORTED_START,
        REPORTED_START + 20 * DAY,
        null,
      ],
      ['exactly 31 days', REPORTED_START, REPORTED_START + 31 * DAY, null],
      [
        '31 days plus one second',
        REPORTED_START,
        REPORTED_START + 31 * DAY + 1,
        null,
      ],
      ['reported 35 day range', REPORTED_START, REPORTED_END, null],
      ['exactly 90 days', REPORTED_START, REPORTED_START + 90 * DAY, null],
      [
        '90 days plus one second',
        REPORTED_START,
        REPORTED_START + 90 * DAY + 1,
        DASHBOARD_RANGE_TOO_LARGE,
      ],
      [
        'inverted',
        REPORTED_START,
        REPORTED_START - 1,
        DASHBOARD_RANGE_INVERTED,
      ],
      ['future end', REPORTED_START, REPORTED_START + 7 * DAY, null],

      // Both bounds are mandatory positive integers; zero is never "no filter".
      ['0/0', 0, 0, DASHBOARD_RANGE_INVALID],
      ['0/1', 0, 1, DASHBOARD_RANGE_INVALID],
      ['1/0', 1, 0, DASHBOARD_RANGE_INVALID],
      ['1/1', 1, 1, null],
      ['negative start', -1, REPORTED_END, DASHBOARD_RANGE_INVALID],
      ['negative end', REPORTED_START, -1, DASHBOARD_RANGE_INVALID],
      ['both negative', -2, -1, DASHBOARD_RANGE_INVALID],

      // Non-integers and non-finite values must never reach the server.
      [
        'fractional start',
        REPORTED_START + 0.5,
        REPORTED_END,
        DASHBOARD_RANGE_INVALID,
      ],
      [
        'fractional end',
        REPORTED_START,
        REPORTED_START + 0.5,
        DASHBOARD_RANGE_INVALID,
      ],
      ['NaN start', Number.NaN, REPORTED_END, DASHBOARD_RANGE_INVALID],
      ['NaN end', REPORTED_START, Number.NaN, DASHBOARD_RANGE_INVALID],
      [
        'Infinity start',
        Number.POSITIVE_INFINITY,
        REPORTED_END,
        DASHBOARD_RANGE_INVALID,
      ],
      [
        'Infinity end',
        REPORTED_START,
        Number.POSITIVE_INFINITY,
        DASHBOARD_RANGE_INVALID,
      ],
      [
        '-Infinity start',
        Number.NEGATIVE_INFINITY,
        REPORTED_END,
        DASHBOARD_RANGE_INVALID,
      ],

      // Beyond the JS safe-integer range the value the client sends is no longer
      // the value the user picked.
      [
        'MAX_SAFE_INTEGER plus one as end',
        REPORTED_START,
        Number.MAX_SAFE_INTEGER + 1,
        DASHBOARD_RANGE_INVALID,
      ],
      [
        'MAX_SAFE_INTEGER as end',
        REPORTED_START,
        Number.MAX_SAFE_INTEGER,
        DASHBOARD_RANGE_INVALID,
      ],

      // The CST +28800 shift limit, exactly and one past it.
      [
        'exactly the safe upper bound',
        DASHBOARD_MAX_TIMESTAMP - DAY,
        DASHBOARD_MAX_TIMESTAMP,
        null,
      ],
      [
        'one past the safe upper bound',
        DASHBOARD_MAX_TIMESTAMP,
        DASHBOARD_MAX_TIMESTAMP + 1,
        DASHBOARD_RANGE_INVALID,
      ],
      [
        'start past the safe upper bound',
        DASHBOARD_MAX_TIMESTAMP + 1,
        DASHBOARD_MAX_TIMESTAMP + 2,
        DASHBOARD_RANGE_INVALID,
      ],
    ]

  for (const [name, start, end, expected] of cases) {
    test(`validates ${name}`, () => {
      expect(validateDashboardRange(start, end)).toBe(expected)
    })
  }

  test('the safe upper bound survives the CST bucket shift', () => {
    expect(DASHBOARD_BUCKET_OFFSET_SECONDS).toBe(28800)
    expect(DASHBOARD_MAX_TIMESTAMP).toBe(
      Number.MAX_SAFE_INTEGER - DASHBOARD_BUCKET_OFFSET_SECONDS
    )
    expect(
      Number.isSafeInteger(
        DASHBOARD_MAX_TIMESTAMP + DASHBOARD_BUCKET_OFFSET_SECONDS
      )
    ).toBe(true)
    expect(isDashboardTimestamp(DASHBOARD_MAX_TIMESTAMP)).toBe(true)
    expect(isDashboardTimestamp(DASHBOARD_MAX_TIMESTAMP + 1)).toBe(false)
    expect(isDashboardTimestamp(0)).toBe(false)
    expect(isDashboardTimestamp(1.5)).toBe(false)
    expect(isDashboardTimestamp(Number.NaN)).toBe(false)
  })

  test('describes each rejection with an actionable message', () => {
    expect(describeDashboardRangeError(DASHBOARD_RANGE_TOO_LARGE)).toContain(
      String(DASHBOARD_MAX_RANGE_DAYS)
    )
    expect(describeDashboardRangeError(DASHBOARD_RANGE_INVERTED)).toBe(
      '结束时间不能早于开始时间'
    )
    expect(describeDashboardRangeError(DASHBOARD_RANGE_INVALID)).toBe(
      '请选择有效的分析时间范围'
    )
  })

  test('assertDashboardRange throws a typed error only for a bad range', () => {
    expect(() =>
      assertDashboardRange(REPORTED_START, REPORTED_END)
    ).not.toThrow()
    let thrown: unknown
    try {
      assertDashboardRange(REPORTED_START, REPORTED_START + 90 * DAY + 1)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(DashboardRangeError)
    expect((thrown as DashboardRangeError).code).toBe(DASHBOARD_RANGE_TOO_LARGE)
  })
})
