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

export const emptyDashboardAnalysis = (dimensions) => ({
  rows: [],
  granularity: 'day',
  dimensions,
  margin_status: 'unknown',
  cost_basis_note: '',
});

export const isTooManyRowsError = (error) =>
  error?.code === 'analysis_too_many_rows' &&
  (error?.status === undefined || error.status === 400);

export const isAnalysisRequestCurrent = (
  generation,
  currentGeneration,
  signal,
) => generation === currentGeneration && !signal?.aborted;

export const getAnalysisFailureMessage = (failure, defaultMessage) => {
  const payload = failure?.response?.data;
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (failure?.message) return failure.message;
  if (failure?.response?.status) return `HTTP ${failure.response.status}`;
  if (failure?.status) return `HTTP ${failure.status}`;
  return defaultMessage;
};

export const isRequestCanceled = (error, signal) =>
  signal?.aborted ||
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError';

/**
 * Execute the dashboard primary/fallback request chain and invalidate the
 * displayed rows whenever the chain fails. The hook supplies the state
 * setters, while tests can exercise this exact request path without mounting
 * React.
 */
export const runDashboardAnalysisRequest = async ({
  defaultDimensions,
  fallbackDimensions,
  signal,
  requestAnalysis,
  isCurrent,
  defaultFailureMessage,
  fallbackNotice,
  setAnalysis,
  setNotice,
  setError,
  showError,
}) => {
  const clearAnalysis = () => {
    setAnalysis(emptyDashboardAnalysis(defaultDimensions));
    setNotice('');
  };

  const primary = await requestAnalysis(defaultDimensions, signal);
  if (!isCurrent()) return { status: 'stale' };
  if (primary.success) {
    setAnalysis(primary.data || emptyDashboardAnalysis(defaultDimensions));
    return { status: 'success', usedFallback: false };
  }

  if (isTooManyRowsError(primary)) {
    const fallback = await requestAnalysis(fallbackDimensions, signal);
    if (!isCurrent()) return { status: 'stale' };
    if (fallback.success) {
      setAnalysis(fallback.data || emptyDashboardAnalysis(fallbackDimensions));
      setNotice(fallbackNotice);
      return { status: 'success', usedFallback: true };
    }
    const fallbackMessage = getAnalysisFailureMessage(
      fallback,
      defaultFailureMessage,
    );
    clearAnalysis();
    setError(fallbackMessage);
    showError(fallbackMessage);
    return { status: 'error', message: fallbackMessage };
  }

  const primaryMessage = getAnalysisFailureMessage(
    primary,
    defaultFailureMessage,
  );
  clearAnalysis();
  setError(primaryMessage);
  showError(primaryMessage);
  return { status: 'error', message: primaryMessage };
};
