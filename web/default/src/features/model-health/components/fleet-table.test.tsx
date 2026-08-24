/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { ModelHealthModel } from '../types'
import { FleetTable } from './fleet-table'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderTable(models: ModelHealthModel[]) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <FleetTable models={models} onSelectModel={() => {}} />
    </I18nextProvider>
  )
}

describe('FleetTable', () => {
  test('uses the dedicated health status label for the sortable column', () => {
    const html = renderTable([
      {
        model_name: 'healthy-model',
        health: 'healthy',
        request_count: 20,
        success_count: 20,
        success_rate: 100,
        avg_latency_ms: 500,
        avg_ttft_ms: 100,
        avg_tps: 30,
        first_observed_at: 1_700_000_000,
        last_observed_at: 1_700_003_600,
      },
    ])

    expect(html).toContain('aria-label="Sort by Health status"')
    expect(html).not.toContain('aria-label="Sort by State"')
  })

  test('renders unavailable TTFT and TPS as bare em dashes', () => {
    const html = renderTable([
      {
        model_name: 'low-traffic-model',
        health: 'insufficient',
        request_count: 19,
        success_count: 19,
        success_rate: 100,
        avg_latency_ms: 640,
        avg_ttft_ms: null,
        avg_tps: null,
        first_observed_at: 1_700_000_000,
        last_observed_at: 1_700_003_600,
      },
    ])

    expect(html).toContain('Insufficient data')
    expect(html.match(/>—</g)).toHaveLength(2)
    expect(html).not.toContain('>— ms<')
    expect(html).not.toContain('>0 ms<')
  })

  test('renders each model detail entry as a native focusable control', () => {
    const html = renderTable([
      {
        model_name: 'clickable-model',
        health: 'healthy',
        request_count: 200,
        success_count: 200,
        success_rate: 100,
        avg_latency_ms: 500,
        avg_ttft_ms: 75,
        avg_tps: 30,
        first_observed_at: 1_700_000_000,
        last_observed_at: 1_700_003_600,
      },
    ])

    expect(html).not.toContain('role="button"')
    expect(html).not.toContain('<tr tabindex="0"')
    expect(html).toMatch(
      /<button[^>]*aria-label="Open health details for clickable-model"/
    )
    expect(html).toContain(
      'aria-label="Open health details for clickable-model"'
    )
  })

  test('uses the shared empty-state semantics when no rows match', () => {
    const html = renderTable([])

    expect(html).toContain('data-slot="empty"')
    expect(html).toContain('No models match the current filters')
  })
})
