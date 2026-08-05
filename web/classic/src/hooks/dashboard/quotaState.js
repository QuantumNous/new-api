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

import { getAnalysisFailureMessage, isRequestCanceled } from './analysisState';

/**
 * Owns the cancellation bookkeeping for a dashboard data series.
 *
 * Each `begin()` invalidates every earlier attempt (generation bump) AND
 * aborts the in-flight HTTP request (AbortController). Both are required:
 * the generation guard alone would let a superseded request keep running and
 * hold a connection, while the abort alone would not stop a response that had
 * already resolved from being written to state.
 *
 * The returned handle exposes the signal that MUST be handed to the HTTP
 * client. Checking `signal.aborted` locally is not sufficient — an aborted
 * request has to be cancelled at the transport, not merely ignored.
 */
export const createDashboardRequestGuard = () => {
  const state = { generation: 0, controller: null };

  const begin = () => {
    state.generation += 1;
    const generation = state.generation;
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    return {
      generation,
      signal: controller.signal,
      isCurrent: () =>
        state.generation === generation && !controller.signal.aborted,
      // finish() must be called on EVERY exit path, including an early return
      // that never issued a request. It releases this attempt's controller so
      // the guard never retains one that nobody is waiting on; a superseded
      // attempt leaves the newer controller alone.
      finish: () => {
        if (state.generation !== generation) return;
        state.controller = null;
        controller.abort();
      },
    };
  };

  const cancel = () => {
    state.generation += 1;
    state.controller?.abort();
    state.controller = null;
  };

  return { begin, cancel, inspect: () => ({ ...state }) };
};

/**
 * Execute one guarded quota-series load.
 *
 * Contract:
 *  - a cancelled or superseded attempt writes NOTHING (no rows, no error, no
 *    toast), so a slow response for an old range cannot repaint the panels;
 *  - a transport failure or a `success: false` business response clears the
 *    previous range's rows and reports an explicit error — it is never
 *    presented as an empty/zero result set;
 *  - a later successful attempt clears the error and restores the data.
 */
export const runQuotaDataRequest = async ({
  requestQuota,
  attempt,
  defaultFailureMessage,
  setQuotaData,
  setQuotaError,
  showError,
}) => {
  const report = (message) => {
    if (!attempt.isCurrent()) return { status: 'stale' };
    setQuotaData([]);
    setQuotaError(message);
    showError(message);
    return { status: 'error', message, rows: [] };
  };

  let payload;
  try {
    payload = await requestQuota(attempt.signal);
  } catch (requestError) {
    if (
      isRequestCanceled(requestError, attempt.signal) ||
      !attempt.isCurrent()
    ) {
      return { status: 'stale' };
    }
    return report(
      getAnalysisFailureMessage(requestError, defaultFailureMessage),
    );
  }

  if (!attempt.isCurrent()) return { status: 'stale' };

  const { success, message, data } = payload || {};
  if (!success) {
    return report(message || defaultFailureMessage);
  }

  const rows = data || [];
  setQuotaData(rows);
  setQuotaError('');
  return { status: 'success', rows };
};
