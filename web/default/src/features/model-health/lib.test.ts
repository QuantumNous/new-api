/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { describe, expect, test } from 'bun:test'
import {
  filterAndSortModels,
  formatMetric,
  formatPercent,
  formatTimestamp,
  getModelHealthViewState,
  healthLabelKey,
  windowLabelKey,
} from './lib'
import type { ModelHealthModel } from './types'

function model(
  modelName: string,
  health: ModelHealthModel['health'],
  requestCount: number,
  overrides: Partial<ModelHealthModel> = {}
): ModelHealthModel {
  return {
    model_name: modelName,
    health,
    request_count: requestCount,
    success_count: requestCount,
    success_rate: 100,
    avg_latency_ms: 800,
    avg_ttft_ms: 100,
    avg_tps: 25,
    first_observed_at: 1_700_000_000,
    last_observed_at: 1_700_003_600,
    ...overrides,
  }
}

describe('model health formatting', () => {
  test('renders unavailable TTFT and TPS values as an em dash', () => {
    expect(formatMetric(null)).toBe('—')
    expect(formatMetric(Number.NaN)).toBe('—')
  })

  test('formats observed success percentages without adding a percent sign', () => {
    expect(formatPercent(99.912)).toBe('99.91')
  })

  test('renders an unavailable timestamp as an em dash', () => {
    expect(formatTimestamp(null)).toBe('—')
  })

  test('maps each supported window to its compact label', () => {
    expect(
      [24, 168, 720].map((hours) => windowLabelKey(hours as 24 | 168 | 720))
    ).toEqual(['24h', '7d', '30d'])
  })

  test('uses explicit wording for insufficient traffic', () => {
    expect(healthLabelKey('insufficient')).toBe('Insufficient data')
  })
})

describe('model health overview state', () => {
  test('shows loading while the first overview request is pending', () => {
    expect(
      getModelHealthViewState({
        hasData: false,
        isError: false,
        isLoading: true,
      })
    ).toBe('loading')
  })

  test('shows a blocking error when the first overview request fails', () => {
    expect(
      getModelHealthViewState({
        hasData: false,
        isError: true,
        isLoading: false,
      })
    ).toBe('error')
  })

  test('keeps populated data visible when a background refresh fails', () => {
    expect(
      getModelHealthViewState({
        hasData: true,
        isError: true,
        isLoading: false,
      })
    ).toBe('data-with-refetch-error')
  })
})

describe('model health fleet filtering and sorting', () => {
  const models = [
    model('healthy-low', 'healthy', 20),
    model('watch-high', 'watch', 80),
    model('degraded-low', 'degraded', 30),
    model('insufficient-high', 'insufficient', 19),
    model('degraded-high-z', 'degraded', 90),
    model('degraded-high-a', 'degraded', 90),
  ]

  test('sorts by severity, requests descending, and model name ascending by default', () => {
    const result = filterAndSortModels({
      models,
      search: '',
      filter: 'all',
      sortKey: 'health',
      direction: 'asc',
    })

    expect(result.map((item) => item.model_name)).toEqual([
      'degraded-high-a',
      'degraded-high-z',
      'degraded-low',
      'watch-high',
      'insufficient-high',
      'healthy-low',
    ])
  })

  test('matches model search case-insensitively after trimming whitespace', () => {
    const result = filterAndSortModels({
      models,
      search: '  WATCH-HIGH ',
      filter: 'all',
      sortKey: 'health',
      direction: 'asc',
    })

    expect(result.map((item) => item.model_name)).toEqual(['watch-high'])
  })

  test('keeps only models in the selected health state', () => {
    const result = filterAndSortModels({
      models,
      search: '',
      filter: 'degraded',
      sortKey: 'health',
      direction: 'asc',
    })

    expect(result.map((item) => item.model_name)).toEqual([
      'degraded-high-a',
      'degraded-high-z',
      'degraded-low',
    ])
  })

  test('places unavailable metrics after measured values when sorting ascending', () => {
    const result = filterAndSortModels({
      models: [
        model('missing', 'healthy', 40, { avg_ttft_ms: null }),
        model('slow', 'healthy', 40, { avg_ttft_ms: 500 }),
        model('fast', 'healthy', 40, { avg_ttft_ms: 100 }),
      ],
      search: '',
      filter: 'all',
      sortKey: 'avg_ttft_ms',
      direction: 'asc',
    })

    expect(result.map((item) => item.model_name)).toEqual([
      'fast',
      'slow',
      'missing',
    ])
  })

  test('places unavailable TTFT after measured values when sorting descending', () => {
    const result = filterAndSortModels({
      models: [
        model('missing', 'healthy', 40, { avg_ttft_ms: null }),
        model('slow', 'healthy', 40, { avg_ttft_ms: 500 }),
        model('fast', 'healthy', 40, { avg_ttft_ms: 100 }),
      ],
      search: '',
      filter: 'all',
      sortKey: 'avg_ttft_ms',
      direction: 'desc',
    })

    expect(result.map((item) => item.model_name)).toEqual([
      'slow',
      'fast',
      'missing',
    ])
  })

  test('places unavailable TPS after measured values when sorting descending', () => {
    const result = filterAndSortModels({
      models: [
        model('missing', 'healthy', 40, { avg_tps: null }),
        model('high', 'healthy', 40, { avg_tps: 40 }),
        model('low', 'healthy', 40, { avg_tps: 10 }),
      ],
      search: '',
      filter: 'all',
      sortKey: 'avg_tps',
      direction: 'desc',
    })

    expect(result.map((item) => item.model_name)).toEqual([
      'high',
      'low',
      'missing',
    ])
  })
})
