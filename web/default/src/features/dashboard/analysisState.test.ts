// @ts-nocheck
import { expect, test } from 'bun:test'
import { runAnalysisRequest } from './analysisState'

const emptyAnalysis = {
  rows: [],
  granularity: 'day',
  dimensions: ['period'],
}

test('fallback HTTP failures preserve the exact message and clear export rows', async () => {
  for (const status of [401, 429, 500, 504]) {
    const calls = []
    const state = {
      analysis: {
        rows: [{ period: 1, request_count: 1 }],
      },
      notice: 'old notice',
      error: '',
    }
    const primary = {
      success: false,
      code: 'analysis_too_many_rows',
      status: 400,
      message: 'primary rows exceeded',
    }
    const fallback = {
      success: false,
      status,
      message: `fallback status ${status}: service unavailable`,
    }

    const outcome = await runAnalysisRequest({
      defaultDimensions: ['period', 'model_name'],
      fallbackDimensions: ['period'],
      requestAnalysis: async (dimensions) => {
        calls.push(dimensions)
        return calls.length === 1 ? primary : fallback
      },
      isCurrent: () => true,
      defaultFailureMessage: 'Analysis unavailable',
      fallbackNotice: 'degraded',
      setAnalysis: (analysis) => {
        state.analysis = analysis
      },
      setNotice: (notice) => {
        state.notice = notice
      },
      setError: (message) => {
        state.error = message
      },
    })

    expect(outcome).toEqual({
      status: 'error',
      message: fallback.message,
    })
    expect(calls).toEqual([['period', 'model_name'], ['period']])
    expect(state.analysis?.rows ?? []).toEqual([])
    expect(state.notice).toBe('')
    expect(state.error).toBe(fallback.message)
    expect((state.analysis?.rows ?? []).length > 0).toBe(false)
  }
})

test('phrase-only HTTP failures do not trigger a fallback request', async () => {
  const calls = []
  const state = { analysis: emptyAnalysis, error: '' }
  await runAnalysisRequest({
    defaultDimensions: ['period', 'model_name'],
    fallbackDimensions: ['period'],
    requestAnalysis: async (dimensions) => {
      calls.push(dimensions)
      return {
        success: false,
        status: 500,
        message: 'gateway error: 超过 5000',
      }
    },
    isCurrent: () => true,
    defaultFailureMessage: 'Analysis unavailable',
    fallbackNotice: 'degraded',
    setAnalysis: (analysis) => {
      state.analysis = analysis
    },
    setNotice: () => {},
    setError: (message) => {
      state.error = message
    },
  })

  expect(calls).toEqual([['period', 'model_name']])
  expect(state.error).toBe('gateway error: 超过 5000')
  expect(state.analysis?.rows ?? []).toEqual([])
})
