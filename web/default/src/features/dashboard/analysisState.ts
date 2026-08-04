import type { LogUsageAnalysisResponse } from './types'

export interface AnalysisRequestResult {
  success: boolean
  data?: LogUsageAnalysisResponse
  code?: string
  message?: string
  status?: number
  canceled?: boolean
}

export const isTooManyRowsError = (failure: AnalysisRequestResult) =>
  failure.code === 'analysis_too_many_rows' &&
  (failure.status === undefined || failure.status === 400)

export const getAnalysisFailureMessage = (
  failure: AnalysisRequestResult,
  defaultMessage: string
) => failure.message?.trim() || defaultMessage

interface RunAnalysisRequestOptions {
  defaultDimensions: readonly string[]
  fallbackDimensions: readonly string[]
  requestAnalysis: (
    dimensions: readonly string[]
  ) => Promise<AnalysisRequestResult>
  isCurrent: () => boolean
  defaultFailureMessage: string
  fallbackNotice: string
  setAnalysis: (analysis: LogUsageAnalysisResponse | null) => void
  setNotice: (notice: string) => void
  setError: (message: string) => void
}

export type AnalysisRequestOutcome =
  | { status: 'stale' }
  | { status: 'success'; usedFallback: boolean }
  | { status: 'error'; message: string }

/**
 * Execute the primary dashboard request and, only for the explicit row-limit
 * business error, retry once with time-only dimensions. This is kept outside
 * React so the request chain and its state invalidation can be tested without
 * a DOM renderer.
 */
export async function runAnalysisRequest({
  defaultDimensions,
  fallbackDimensions,
  requestAnalysis,
  isCurrent,
  defaultFailureMessage,
  fallbackNotice,
  setAnalysis,
  setNotice,
  setError,
}: RunAnalysisRequestOptions): Promise<AnalysisRequestOutcome> {
  const primary = await requestAnalysis(defaultDimensions)
  if (!isCurrent()) return { status: 'stale' }
  if (primary.success && primary.data) {
    setAnalysis(primary.data)
    return { status: 'success', usedFallback: false }
  }

  if (isTooManyRowsError(primary)) {
    const fallback = await requestAnalysis(fallbackDimensions)
    if (!isCurrent()) return { status: 'stale' }
    if (fallback.success && fallback.data) {
      setAnalysis(fallback.data)
      setNotice(fallbackNotice)
      return { status: 'success', usedFallback: true }
    }
    const message = getAnalysisFailureMessage(fallback, defaultFailureMessage)
    setAnalysis(null)
    setNotice('')
    setError(message)
    return { status: 'error', message }
  }

  const message = getAnalysisFailureMessage(primary, defaultFailureMessage)
  setAnalysis(null)
  setNotice('')
  setError(message)
  return { status: 'error', message }
}
