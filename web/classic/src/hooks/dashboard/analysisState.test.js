import { expect, test } from 'bun:test';
import {
  emptyDashboardAnalysis,
  getAnalysisFailureMessage,
  isAnalysisRequestCurrent,
} from './analysisState';

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
