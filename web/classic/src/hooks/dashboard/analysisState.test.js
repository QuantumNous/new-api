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

import { expect, test } from 'bun:test';
import {
  emptyDashboardAnalysis,
  getAnalysisFailureMessage,
  isAnalysisRequestCurrent,
  isTooManyRowsError,
  runDashboardAnalysisRequest,
} from './analysisState';

test('row-limit fallback requires the explicit business code', () => {
  for (const status of [401, 429, 500, 504]) {
    expect(
      isTooManyRowsError({
        status,
        message: `gateway status ${status}: 超过 5000`,
      }),
    ).toBe(false);
  }
});

test('fallback failures keep the exact server message', () => {
  for (const status of [401, 429, 500, 504]) {
    expect(
      getAnalysisFailureMessage(
        {
          response: {
            status,
            data: { message: `fallback status ${status}: gateway failure` },
          },
        },
        '加载消费分析失败',
      ),
    ).toBe(`fallback status ${status}: gateway failure`);
  }
});

test('stale or aborted analysis generations cannot apply results', () => {
  const controller = new AbortController();
  expect(isAnalysisRequestCurrent(2, 2, controller.signal)).toBe(true);
  expect(isAnalysisRequestCurrent(1, 2, controller.signal)).toBe(false);
  controller.abort();
  expect(isAnalysisRequestCurrent(2, 2, controller.signal)).toBe(false);
});

test('invalidating analysis produces no financial rows for export', () => {
  expect(emptyDashboardAnalysis(['period']).rows).toEqual([]);
});

test('request chain clears rows and preserves fallback HTTP errors', async () => {
  for (const status of [401, 429, 500, 504]) {
    const calls = [];
    const errors = [];
    const state = {
      analysis: { rows: [{ period: 1, request_count: 1 }] },
      notice: 'old notice',
      error: '',
    };
    const outcome = await runDashboardAnalysisRequest({
      defaultDimensions: ['period', 'model_name'],
      fallbackDimensions: ['period'],
      signal: new AbortController().signal,
      requestAnalysis: async (dimensions) => {
        calls.push(dimensions);
        return calls.length === 1
          ? {
              success: false,
              code: 'analysis_too_many_rows',
              status: 400,
              message: 'primary rows exceeded',
            }
          : {
              success: false,
              status,
              message: `fallback status ${status}: service unavailable`,
            };
      },
      isCurrent: () => true,
      defaultFailureMessage: '加载消费分析失败',
      fallbackNotice: 'degraded',
      setAnalysis: (analysis) => {
        state.analysis = analysis;
      },
      setNotice: (notice) => {
        state.notice = notice;
      },
      setError: (message) => {
        state.error = message;
      },
      showError: (message) => errors.push(message),
    });

    expect(outcome.message).toBe(
      `fallback status ${status}: service unavailable`,
    );
    expect(calls).toHaveLength(2);
    expect(state.analysis.rows).toEqual([]);
    expect(state.notice).toBe('');
    expect(state.error).toBe(outcome.message);
    expect(errors).toEqual([outcome.message]);
    expect(state.analysis.rows.length > 0).toBe(false);
  }
});

test('request chain does not fall back for phrase-only HTTP failures', async () => {
  for (const status of [401, 429, 500, 504]) {
    const calls = [];
    const state = { analysis: { rows: [{ period: 1 }] }, error: '' };
    const outcome = await runDashboardAnalysisRequest({
      defaultDimensions: ['period', 'model_name'],
      fallbackDimensions: ['period'],
      signal: new AbortController().signal,
      requestAnalysis: async (dimensions) => {
        calls.push(dimensions);
        return {
          success: false,
          status,
          message: `gateway status ${status}: 超过 5000`,
        };
      },
      isCurrent: () => true,
      defaultFailureMessage: '加载消费分析失败',
      fallbackNotice: 'degraded',
      setAnalysis: (analysis) => {
        state.analysis = analysis;
      },
      setNotice: () => {},
      setError: (message) => {
        state.error = message;
      },
      showError: () => {},
    });

    expect(outcome.status).toBe('error');
    expect(calls).toEqual([['period', 'model_name']]);
    expect(state.error).toBe(`gateway status ${status}: 超过 5000`);
    expect(state.analysis.rows).toEqual([]);
  }
});
