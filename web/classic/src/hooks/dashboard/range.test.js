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
import {
  DASHBOARD_MAX_RANGE_DAYS,
  DASHBOARD_MAX_RANGE_SECONDS,
  DASHBOARD_MAX_SEGMENT_DAYS,
  DASHBOARD_RANGE_INVALID,
  DASHBOARD_RANGE_INVERTED,
  DASHBOARD_RANGE_TOO_LARGE,
  describeDashboardRangeError,
  validateDashboardRange,
} from './range';
import { parseDashboardDateRange } from './time';
import { runDashboardAnalysisRequest } from './analysisState';

const DAY = 24 * 60 * 60;
// The exact selection moni reported: 2026-07-01 00:00:42 through
// 2026-08-05 11:07:45 Asia/Shanghai, hour granularity.
const REPORTED_START_TEXT = '2026-07-01 00:00:42';
const REPORTED_END_TEXT = '2026-08-05 11:07:45';

describe('classic dashboard range policy', () => {
  test('mirrors the server bounds', () => {
    expect(DASHBOARD_MAX_RANGE_DAYS).toBe(90);
    expect(DASHBOARD_MAX_SEGMENT_DAYS).toBe(31);
    expect(DASHBOARD_MAX_RANGE_SECONDS).toBe(DASHBOARD_MAX_RANGE_DAYS * DAY);
  });

  test('accepts the reported cross-month selection', () => {
    const { start, end } = parseDashboardDateRange(
      REPORTED_START_TEXT,
      REPORTED_END_TEXT,
    );
    expect(start).toBe(1782835242);
    expect(end).toBe(1785899265);
    expect(end - start).toBeGreaterThan(DASHBOARD_MAX_SEGMENT_DAYS * DAY);
    expect(validateDashboardRange(start, end)).toBe('');
  });

  const start = 1782835242;
  const cases = [
    ['cross month within 31 days', start, start + 20 * DAY, ''],
    ['exactly 31 days', start, start + 31 * DAY, ''],
    ['31 days plus one second', start, start + 31 * DAY + 1, ''],
    ['reported 35 day range', start, 1785899265, ''],
    ['exactly 90 days', start, start + 90 * DAY, ''],
    [
      '90 days plus one second',
      start,
      start + 90 * DAY + 1,
      DASHBOARD_RANGE_TOO_LARGE,
    ],
    ['inverted', start, start - 1, DASHBOARD_RANGE_INVERTED],
    ['empty', 0, 0, ''],
    ['future end', start, start + 7 * DAY, ''],
    ['unparsable', Number.NaN, start, DASHBOARD_RANGE_INVALID],
  ];

  for (const [name, rangeStart, rangeEnd, expected] of cases) {
    test(`validates ${name}`, () => {
      expect(validateDashboardRange(rangeStart, rangeEnd)).toBe(expected);
    });
  }

  test('describes rejections through the translator', () => {
    const t = (value) => `T:${value}`;
    expect(describeDashboardRangeError(DASHBOARD_RANGE_TOO_LARGE, t)).toContain(
      String(DASHBOARD_MAX_RANGE_DAYS),
    );
    expect(describeDashboardRangeError(DASHBOARD_RANGE_INVERTED, t)).toBe(
      'T:结束时间不能早于开始时间',
    );
    expect(describeDashboardRangeError(DASHBOARD_RANGE_INVALID, t)).toBe(
      'T:请选择有效的分析时间范围',
    );
  });
});

describe('range rejection through the analysis request chain', () => {
  test('clears stale rows and does not trigger the dimension downgrade', async () => {
    const attempts = [];
    const state = {
      analysis: { rows: [{ quota: 1 }] },
      notice: 'stale',
      error: '',
    };
    const errors = [];

    const outcome = await runDashboardAnalysisRequest({
      defaultDimensions: ['period', 'model_name'],
      fallbackDimensions: ['period'],
      signal: undefined,
      requestAnalysis: async (dimensions) => {
        attempts.push(dimensions);
        return {
          success: false,
          code: DASHBOARD_RANGE_TOO_LARGE,
          message: '查询时间跨度不能超过 90 天',
        };
      },
      isCurrent: () => true,
      defaultFailureMessage: '加载消费分析失败',
      fallbackNotice: 'fallback',
      setAnalysis: (value) => {
        state.analysis = value;
      },
      setNotice: (value) => {
        state.notice = value;
      },
      setError: (value) => {
        state.error = value;
      },
      showError: (value) => errors.push(value),
    });

    expect(attempts).toHaveLength(1);
    expect(outcome.status).toBe('error');
    expect(state.analysis.rows).toEqual([]);
    expect(state.notice).toBe('');
    expect(state.error).toBe('查询时间跨度不能超过 90 天');
    expect(errors).toEqual(['查询时间跨度不能超过 90 天']);
  });
});
