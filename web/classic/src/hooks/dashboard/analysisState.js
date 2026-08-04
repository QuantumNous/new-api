export const emptyDashboardAnalysis = (dimensions) => ({
  rows: [],
  granularity: 'day',
  dimensions,
  margin_status: 'unknown',
  cost_basis_note: '',
});

export const isTooManyRowsError = (error) =>
  error?.code === 'analysis_too_many_rows' ||
  String(error?.message || '').includes('超过 5000');

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
  return defaultMessage;
};

export const isRequestCanceled = (error, signal) =>
  signal?.aborted ||
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError';
