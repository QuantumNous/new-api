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
