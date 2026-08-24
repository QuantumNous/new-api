/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import type { ReactNode } from 'react'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { ModelHealthOverview } from '../types'
import {
  DataQualityBanner,
  ModelHealthEmpty,
  ModelHealthError,
  ModelHealthSkeleton,
} from './view-states'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function render(node: ReactNode) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>{node}</I18nextProvider>
  )
}

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
      model_count: 0,
      sufficiently_sampled_models: 0,
      healthy_models: 0,
      watch_models: 0,
      degraded_models: 0,
      insufficient_models: 0,
      request_count: 0,
      success_count: 0,
      success_rate: 0,
    },
    models: [],
    ...overrides,
  }
}

describe('model health view states', () => {
  test('renders skeleton placeholders for the blocking loading state', () => {
    const html = render(<ModelHealthSkeleton />)

    expect(html.match(/data-slot="skeleton"/g)?.length).toBeGreaterThanOrEqual(
      6
    )
  })

  test('renders a retry action for the blocking error state', () => {
    const html = render(
      <ModelHealthError isFetching={false} onRetry={() => {}} />
    )

    expect(html).toContain('Unable to load model health')
    expect(html).toContain('>Retry</button>')
  })

  test('explains that disabled collection records no new health data', () => {
    const html = render(<ModelHealthEmpty collectionEnabled={false} />)

    expect(html).toContain('Performance metric collection is disabled')
    expect(html).toContain('no new health data is being recorded')
  })

  test('renders the empty traffic state when collection is enabled', () => {
    const html = render(<ModelHealthEmpty collectionEnabled />)

    expect(html).toContain('No observed final requests')
    expect(html).toContain('No persisted model traffic was observed')
  })
})

describe('model health data quality wording', () => {
  test('describes the cutoff as best-effort persisted data without completeness wording', () => {
    const html = render(<DataQualityBanner overview={overview()} hours={24} />)

    expect(html).toContain('Best-effort persisted fleet view')
    expect(html).toContain('Persisted data cutoff:')
    expect(html).toContain('Observed coverage:')
    expect(html).not.toContain('complete through')
    expect(html).toContain(
      'Client disconnects count as unsuccessful final requests'
    )
    expect(html).toContain(
      'metrics lost before a node flushes cannot be detected'
    )
  })

  test('does not claim short retention when retention is unknown', () => {
    const html = render(
      <DataQualityBanner
        overview={overview({ retention_days: 0 })}
        hours={720}
      />
    )

    expect(html).not.toContain('shorter than the selected window')
  })

  test('warns when positive retention is shorter than the selected window', () => {
    const html = render(
      <DataQualityBanner
        overview={overview({ retention_days: 7 })}
        hours={720}
      />
    )

    expect(html).toContain(
      'Retention is 7 days, shorter than the selected window.'
    )
  })
})
