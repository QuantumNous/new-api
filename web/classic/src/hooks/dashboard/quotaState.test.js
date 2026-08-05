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
import { createDashboardRequestGuard, runQuotaDataRequest } from './quotaState';
import {
  DASHBOARD_MAX_TIMESTAMP,
  describeDashboardRangeError,
  validateDashboardRange,
} from './range';
import { parseDashboardDateRange } from './time';

const createState = (initialRows = []) => {
  const state = {
    rows: initialRows,
    error: '',
    toasts: [],
  };
  return {
    state,
    setQuotaData: (rows) => {
      state.rows = rows;
    },
    setQuotaError: (message) => {
      state.error = message;
    },
    showError: (message) => state.toasts.push(message),
  };
};

describe('dashboard quota request guard', () => {
  test('a new attempt aborts the in-flight request at the transport', () => {
    const guard = createDashboardRequestGuard();

    const first = guard.begin();
    expect(first.signal.aborted).toBe(false);
    expect(first.isCurrent()).toBe(true);

    const second = guard.begin();
    // The point of the AbortController: the superseded request is cancelled,
    // not merely ignored when it eventually resolves.
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.isCurrent()).toBe(true);
    expect(second.signal).not.toBe(first.signal);
  });

  test('cancel invalidates and aborts every outstanding attempt', () => {
    const guard = createDashboardRequestGuard();
    const attempt = guard.begin();

    guard.cancel();

    expect(attempt.signal.aborted).toBe(true);
    expect(attempt.isCurrent()).toBe(false);
    expect(guard.inspect().controller).toBe(null);
  });

  test('finishing a superseded attempt does not clear the newer controller', () => {
    const guard = createDashboardRequestGuard();
    const first = guard.begin();
    const second = guard.begin();

    // The late-arriving first attempt must not tear down the controller that
    // belongs to the request the user is actually waiting on.
    first.finish();
    expect(guard.inspect().controller).not.toBe(null);
    expect(second.isCurrent()).toBe(true);

    second.finish();
    expect(guard.inspect().controller).toBe(null);
  });
});

describe('quota data request', () => {
  test('hands the abort signal to the HTTP client', async () => {
    const guard = createDashboardRequestGuard();
    const attempt = guard.begin();
    const { state, ...setters } = createState();
    let receivedSignal = null;

    await runQuotaDataRequest({
      requestQuota: async (signal) => {
        receivedSignal = signal;
        return { success: true, data: [{ quota: 1 }] };
      },
      attempt,
      defaultFailureMessage: 'failed',
      ...setters,
    });

    expect(receivedSignal).toBe(attempt.signal);
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(state.rows).toEqual([{ quota: 1 }]);
  });

  test('a superseded response never overwrites the newer range', async () => {
    const guard = createDashboardRequestGuard();
    const stale = guard.begin();
    const { state, ...setters } = createState([
      { quota: 999, marker: 'current' },
    ]);

    // The newer request starts while the old one is still in flight.
    guard.begin();

    const outcome = await runQuotaDataRequest({
      requestQuota: async () => ({
        success: true,
        data: [{ quota: 1, marker: 'stale' }],
      }),
      attempt: stale,
      defaultFailureMessage: 'failed',
      ...setters,
    });

    expect(outcome.status).toBe('stale');
    expect(state.rows).toEqual([{ quota: 999, marker: 'current' }]);
    expect(state.error).toBe('');
    expect(state.toasts).toEqual([]);
  });

  test('a superseded failure neither clears data nor toasts', async () => {
    const guard = createDashboardRequestGuard();
    const stale = guard.begin();
    const { state, ...setters } = createState([{ quota: 42 }]);
    guard.begin();

    const outcome = await runQuotaDataRequest({
      requestQuota: async () => ({ success: false, message: 'stale failure' }),
      attempt: stale,
      defaultFailureMessage: 'failed',
      ...setters,
    });

    expect(outcome.status).toBe('stale');
    expect(state.rows).toEqual([{ quota: 42 }]);
    expect(state.error).toBe('');
    expect(state.toasts).toEqual([]);
  });

  test('an aborted request is silent', async () => {
    const guard = createDashboardRequestGuard();
    const attempt = guard.begin();
    const { state, ...setters } = createState([{ quota: 7 }]);

    const outcome = await runQuotaDataRequest({
      requestQuota: async (signal) => {
        const error = new Error('canceled');
        error.name = 'CanceledError';
        guard.cancel();
        expect(signal.aborted).toBe(true);
        throw error;
      },
      attempt,
      defaultFailureMessage: 'failed',
      ...setters,
    });

    expect(outcome.status).toBe('stale');
    expect(state.rows).toEqual([{ quota: 7 }]);
    expect(state.toasts).toEqual([]);
  });

  test('a business failure clears the old range and reports an error', async () => {
    const guard = createDashboardRequestGuard();
    const { state, ...setters } = createState([{ quota: 500 }]);

    const outcome = await runQuotaDataRequest({
      requestQuota: async () => ({
        success: false,
        message: '查询时间跨度不能超过 90 天',
      }),
      attempt: guard.begin(),
      defaultFailureMessage: '加载数据看板失败',
      ...setters,
    });

    expect(outcome.status).toBe('error');
    // Never presented as an empty/zero statistic: the rows are cleared AND an
    // explicit error is surfaced.
    expect(state.rows).toEqual([]);
    expect(state.error).toBe('查询时间跨度不能超过 90 天');
    expect(state.toasts).toEqual(['查询时间跨度不能超过 90 天']);
  });

  test('a transport failure clears the old range and reports an error', async () => {
    const guard = createDashboardRequestGuard();
    const { state, ...setters } = createState([{ quota: 500 }]);

    const outcome = await runQuotaDataRequest({
      requestQuota: async () => {
        const error = new Error('Request failed with status code 400');
        error.response = {
          status: 400,
          data: {
            message: '请选择有效的查询时间范围',
            code: 'dashboard_range_invalid',
          },
        };
        throw error;
      },
      attempt: guard.begin(),
      defaultFailureMessage: '加载数据看板失败',
      ...setters,
    });

    expect(outcome.status).toBe('error');
    expect(state.rows).toEqual([]);
    expect(state.error).toBe('请选择有效的查询时间范围');
    expect(state.toasts).toEqual(['请选择有效的查询时间范围']);
  });

  test('a later success recovers from an earlier failure', async () => {
    const guard = createDashboardRequestGuard();
    const { state, ...setters } = createState([{ quota: 500 }]);

    await runQuotaDataRequest({
      requestQuota: async () => ({ success: false, message: 'boom' }),
      attempt: guard.begin(),
      defaultFailureMessage: '加载数据看板失败',
      ...setters,
    });
    expect(state.error).toBe('boom');
    expect(state.rows).toEqual([]);

    const outcome = await runQuotaDataRequest({
      requestQuota: async () => ({ success: true, data: [{ quota: 12 }] }),
      attempt: guard.begin(),
      defaultFailureMessage: '加载数据看板失败',
      ...setters,
    });

    expect(outcome.status).toBe('success');
    expect(state.rows).toEqual([{ quota: 12 }]);
    expect(state.error).toBe('');
  });

  test('an empty successful range is data, not an error', async () => {
    const guard = createDashboardRequestGuard();
    const { state, ...setters } = createState([{ quota: 500 }]);

    const outcome = await runQuotaDataRequest({
      requestQuota: async () => ({ success: true, data: [] }),
      attempt: guard.begin(),
      defaultFailureMessage: '加载数据看板失败',
      ...setters,
    });

    expect(outcome.status).toBe('success');
    expect(state.rows).toEqual([]);
    expect(state.error).toBe('');
    expect(state.toasts).toEqual([]);
  });
});

describe('invalid ranges never reach the network', () => {
  const START = 1782835242;
  const DAY = 24 * 60 * 60;

  const invalidRanges = [
    ['0/0', 0, 0],
    ['0/1', 0, 1],
    ['1/0', 1, 0],
    ['negative start', -1, START],
    ['negative end', START, -1],
    ['fractional start', START + 0.5, START + DAY],
    ['fractional end', START, START + 0.5],
    ['NaN start', Number.NaN, START],
    ['NaN end', START, Number.NaN],
    ['Infinity end', START, Number.POSITIVE_INFINITY],
    ['MAX_SAFE_INTEGER plus one', START, Number.MAX_SAFE_INTEGER + 1],
    ['past the safe upper bound', START, DASHBOARD_MAX_TIMESTAMP + 1],
    ['inverted', START, START - 1],
    ['ninety days plus one second', START, START + 90 * DAY + 1],
  ];

  // Mirrors the order the hook uses: validate first, only then issue the
  // request. A rejected range must cost zero network calls.
  const loadWithGuard = async (guard, start, end, requestQuota, setters) => {
    const attempt = guard.begin();
    try {
      const rangeError = validateDashboardRange(start, end);
      if (rangeError) {
        setters.setQuotaData([]);
        setters.setQuotaError(describeDashboardRangeError(rangeError));
        return { status: 'range_error', code: rangeError };
      }
      return await runQuotaDataRequest({
        requestQuota,
        attempt,
        defaultFailureMessage: 'failed',
        ...setters,
      });
    } finally {
      attempt.finish();
    }
  };

  for (const [name, start, end] of invalidRanges) {
    test(`${name} is rejected before any request`, async () => {
      const guard = createDashboardRequestGuard();
      const { state, ...setters } = createState([{ quota: 1 }]);
      let calls = 0;
      const requestQuota = async () => {
        calls += 1;
        return { success: true, data: [] };
      };

      const outcome = await loadWithGuard(
        guard,
        start,
        end,
        requestQuota,
        setters,
      );

      expect(calls).toBe(0);
      expect(outcome.status).toBe('range_error');
      expect(state.rows).toEqual([]);
      expect(state.error).not.toBe('');
      // Every exit path releases the guard; no controller is retained.
      expect(guard.inspect().controller).toBe(null);
    });
  }

  test('the reported 35 day range does reach the network', async () => {
    const guard = createDashboardRequestGuard();
    const { state, ...setters } = createState();
    let calls = 0;

    const outcome = await loadWithGuard(
      guard,
      START,
      1785899265,
      async () => {
        calls += 1;
        return { success: true, data: [{ quota: 9 }] };
      },
      setters,
    );

    expect(calls).toBe(1);
    expect(outcome.status).toBe('success');
    expect(state.rows).toEqual([{ quota: 9 }]);
    expect(guard.inspect().controller).toBe(null);
  });

  test('an early return still releases the guard controller', () => {
    const guard = createDashboardRequestGuard();
    const attempt = guard.begin();
    expect(guard.inspect().controller).not.toBe(null);

    // The range-error path returns without issuing a request.
    attempt.finish();

    expect(guard.inspect().controller).toBe(null);
    expect(attempt.signal.aborted).toBe(true);
  });
});

// The hook's real input path is parseDashboardDateRange -> validateDashboardRange
// -> request. Testing the validator alone would miss a parser that silently
// repairs a bad bound into a good one, which is exactly the regression these
// cases pin. The assertion is the transport spy's call count.
describe('raw dashboard inputs never reach the network when unparseable', () => {
  const SECONDS = 1782835242; // 2026-07-01 00:00:42 Asia/Shanghai
  const REPORTED_END = 1785899265; // 2026-08-05 11:07:45 Asia/Shanghai

  // Mirrors loadQuotaData: parse the raw inputs, validate, only then request.
  const loadRaw = async (guard, rawStart, rawEnd, requestQuota, setters) => {
    const attempt = guard.begin();
    try {
      const { start, end } = parseDashboardDateRange(rawStart, rawEnd);
      const rangeError = validateDashboardRange(start, end);
      if (rangeError) {
        setters.setQuotaData([]);
        setters.setQuotaError(describeDashboardRangeError(rangeError));
        return { status: 'range_error', code: rangeError, start, end };
      }
      const outcome = await runQuotaDataRequest({
        requestQuota,
        attempt,
        defaultFailureMessage: 'failed',
        ...setters,
      });
      return { ...outcome, start, end };
    } finally {
      attempt.finish();
    }
  };

  const unparseableInputs = [
    ['fractional second start', SECONDS + 0.5, REPORTED_END],
    ['fractional second end', SECONDS, REPORTED_END + 0.5],
    ['sub-second fraction', 0.5, REPORTED_END],
    ['zero seconds', 0, REPORTED_END],
    ['negative seconds', -1, REPORTED_END],
    ['NaN', Number.NaN, REPORTED_END],
    ['Infinity', Number.POSITIVE_INFINITY, REPORTED_END],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 2, REPORTED_END],
    ['fractional milliseconds', 1782835242500.5, REPORTED_END],
    ['Invalid Date', new Date(Number.NaN), REPORTED_END],
    ['Invalid Date end', SECONDS, new Date('not-a-date')],
    ['unparseable string', 'not-a-timestamp', REPORTED_END],

    // Bare numeric strings must never be guessed into a date by Date.parse.
    ["string '0'", '0', REPORTED_END],
    ["string '-1'", '-1', REPORTED_END],
    ["string '1.5'", '1.5', REPORTED_END],
    ["string 'NaN'", 'NaN', REPORTED_END],
    ["string 'Infinity'", 'Infinity', REPORTED_END],
    ["string '1e3'", '1e3', REPORTED_END],
    ['unsafe integer string', '9007199254740993', REPORTED_END],
    ["string '0' as end", SECONDS, '0'],
    ["string '-1' as end", SECONDS, '-1'],
  ];

  for (const [name, rawStart, rawEnd] of unparseableInputs) {
    test(`${name} costs zero network calls`, async () => {
      const guard = createDashboardRequestGuard();
      const { state, ...setters } = createState([{ quota: 1 }]);
      let calls = 0;

      const outcome = await loadRaw(
        guard,
        rawStart,
        rawEnd,
        async () => {
          calls += 1;
          return { success: true, data: [] };
        },
        setters,
      );

      expect(calls).toBe(0);
      expect(outcome.status).toBe('range_error');
      expect(state.rows).toEqual([]);
      expect(state.error).not.toBe('');
      expect(guard.inspect().controller).toBe(null);
    });
  }

  const acceptedInputs = [
    ['whole seconds', SECONDS, REPORTED_END, SECONDS, REPORTED_END],
    [
      'whole milliseconds',
      SECONDS * 1000,
      REPORTED_END * 1000,
      SECONDS,
      REPORTED_END,
    ],
    [
      'sub-second Date objects',
      new Date(SECONDS * 1000 + 500),
      new Date(REPORTED_END * 1000 + 750),
      SECONDS,
      REPORTED_END,
    ],
    [
      'wall-clock CST strings',
      '2026-07-01 00:00:42',
      '2026-08-05 11:07:45',
      SECONDS,
      REPORTED_END,
    ],
    [
      'positive whole-second strings',
      String(SECONDS),
      String(REPORTED_END),
      SECONDS,
      REPORTED_END,
    ],
    [
      'positive whole-millisecond strings',
      String(SECONDS * 1000),
      String(REPORTED_END * 1000),
      SECONDS,
      REPORTED_END,
    ],
  ];

  for (const [name, rawStart, rawEnd, wantStart, wantEnd] of acceptedInputs) {
    test(`${name} reach the network exactly once`, async () => {
      const guard = createDashboardRequestGuard();
      const { state, ...setters } = createState();
      let calls = 0;

      const outcome = await loadRaw(
        guard,
        rawStart,
        rawEnd,
        async () => {
          calls += 1;
          return { success: true, data: [{ quota: 3 }] };
        },
        setters,
      );

      expect(calls).toBe(1);
      expect(outcome.status).toBe('success');
      expect(outcome.start).toBe(wantStart);
      expect(outcome.end).toBe(wantEnd);
      expect(state.rows).toEqual([{ quota: 3 }]);
      expect(guard.inspect().controller).toBe(null);
    });
  }
});
