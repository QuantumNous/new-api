/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { Sheet } from '@/components/ui/sheet'
import type { ModelHealthDetail, ModelHealthOverview } from './types'

const testI18n = createInstance()
let overviewQuery: {
  data: ModelHealthOverview | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  refetch: () => Promise<void>
}
let detailQuery: {
  data: ModelHealthDetail | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  refetch: () => Promise<void>
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: async () => {},
}

mock.module('./hooks/use-model-health', () => ({
  useModelHealthOverview: () => overviewQuery,
  useModelHealthDetail: () => detailQuery,
  useRefreshModelHealth: () => async () => {},
}))

const { ModelHealth } = await import('./index')
const { ModelHealthDetailSheetContent } =
  await import('./components/detail-sheet')

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function overview(
  overrides: Partial<ModelHealthOverview> = {}
): ModelHealthOverview {
  return {
    collection_enabled: true,
    retention_days: 30,
    requested_hours: 24,
    bucket_seconds: 3600,
    window_start: 1_700_000_000,
    data_cutoff: 1_700_086_400,
    first_observed_at: 1_700_003_600,
    last_observed_at: 1_700_082_800,
    generated_at: 1_700_090_000,
    health_policy: {
      minimum_requests: 20,
      healthy_success_rate_pct: 99.9,
      watch_success_rate_pct: 99,
    },
    data_quality: {
      mode: 'best_effort_persisted',
      completeness_guaranteed: false,
      caveats: [],
    },
    fleet: {
      model_count: 1,
      sufficiently_sampled_models: 1,
      healthy_models: 1,
      watch_models: 0,
      degraded_models: 0,
      insufficient_models: 0,
      request_count: 100,
      success_count: 100,
      success_rate: 100,
    },
    models: [
      {
        model_name: 'healthy-history-model',
        health: 'healthy',
        request_count: 100,
        success_count: 100,
        success_rate: 100,
        avg_latency_ms: 500,
        avg_ttft_ms: 80,
        avg_tps: 30,
        first_observed_at: 1_700_003_600,
        last_observed_at: 1_700_082_800,
      },
    ],
    ...overrides,
  }
}

function renderModelHealth() {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <ModelHealth />
    </I18nextProvider>
  )
}

function detail(): ModelHealthDetail {
  return {
    ...overview(),
    model: {
      model_name: 'example/model-a',
      health: 'watch',
      request_count: 100,
      success_count: 99,
      success_rate: 99,
      avg_latency_ms: 720,
      avg_ttft_ms: 120,
      avg_tps: 31.5,
      first_observed_at: 1_700_003_600,
      last_observed_at: 1_700_082_800,
    },
    series: [
      {
        ts: 1_700_003_600,
        health: 'watch',
        request_count: 50,
        success_count: 49,
        success_rate: 98,
        avg_latency_ms: 740,
        avg_ttft_ms: 130,
        avg_tps: 30,
      },
    ],
    groups: [
      {
        group: 'premium',
        health: 'healthy',
        request_count: 60,
        success_count: 60,
        success_rate: 100,
        avg_latency_ms: 680,
        avg_ttft_ms: 100,
        avg_tps: 35,
      },
    ],
  }
}

function renderDetailContent() {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <Sheet open>
        <ModelHealthDetailSheetContent model='example/model-a' hours={24} />
      </Sheet>
    </I18nextProvider>
  )
}

describe('ModelHealth overview', () => {
  test('renders populated fleet data for enabled collection', () => {
    overviewQuery = {
      data: overview(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: async () => {},
    }

    const html = renderModelHealth()

    expect(html).toContain('Weighted observed success')
    expect(html).toContain('healthy-history-model')
  })

  test('offers all supported observation windows', () => {
    overviewQuery = {
      data: overview(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: async () => {},
    }

    const html = renderModelHealth()

    expect(html).toContain('>24h<')
    expect(html).toContain('>7d<')
    expect(html).toContain('>30d<')
  })

  test('does not render historical health claims while collection is disabled', () => {
    overviewQuery = {
      data: overview({ collection_enabled: false }),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: async () => {},
    }

    const html = renderModelHealth()

    expect(html).toContain('Performance metric collection is disabled')
    expect(html).not.toContain('Weighted observed success')
    expect(html).not.toContain('healthy-history-model')
    expect(html).not.toContain('>Healthy<')
  })

  test('describes page scope as best-effort persisted observation', () => {
    overviewQuery = {
      data: overview(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: async () => {},
    }

    const html = renderModelHealth()

    expect(html).toMatch(/Persisted[^<]*observation[^<]*best effort/i)
    expect(html).not.toContain('across all application nodes')
  })
})

describe('ModelHealth detail sheet content', () => {
  test('renders an accessible title and description for the selected model', () => {
    detailQuery = {
      data: detail(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: async () => {},
    }

    const html = renderDetailContent()

    expect(html).toContain('example/model-a')
    expect(html).toContain(
      'Observed final-request health for the selected window.'
    )
    expect(html).toContain('data-slot="sheet-title"')
    expect(html).toContain('data-slot="sheet-description"')
  })

  test('renders trend and group data from the detail response', () => {
    detailQuery = {
      data: detail(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: async () => {},
    }

    const html = renderDetailContent()

    expect(html).toContain('Observed success trend')
    expect(html).toContain('99.9% healthy threshold')
    expect(html).toContain('Duration and TTFT trend')
    expect(html).toContain('Group breakdown')
    expect(html).toContain('premium')
    expect(html).toContain('31.5')
  })

  test('explains best-effort cutoff and both incompleteness caveats', () => {
    detailQuery = {
      data: detail(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: async () => {},
    }

    const html = renderDetailContent()

    expect(html).toContain('Best-effort persisted data')
    expect(html).toContain('Persisted data cutoff:')
    expect(html).not.toContain('complete through')
    expect(html).toContain(
      'Client disconnects count as unsuccessful final requests'
    )
    expect(html).toContain(
      'Metrics lost before a node flushes cannot be detected'
    )
  })
})
