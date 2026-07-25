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
import type { ModelHealthFleet } from '../types'
import { SummaryCards } from './summary-cards'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderSummary(fleet: ModelHealthFleet) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <SummaryCards fleet={fleet} />
    </I18nextProvider>
  )
}

describe('SummaryCards', () => {
  test('renders weighted fleet totals and attention counts', () => {
    const html = renderSummary({
      model_count: 7,
      sufficiently_sampled_models: 6,
      healthy_models: 3,
      watch_models: 2,
      degraded_models: 1,
      insufficient_models: 1,
      request_count: 12_345,
      success_count: 12_300,
      success_rate: 99.64,
    })

    expect(html).toContain('aria-label="Fleet summary"')
    expect(html).toContain('Weighted observed success')
    expect(html).toContain('99.64%')
    expect(html).toContain('12,345')
    expect(html).toContain('3 / 6')
    expect(html).toContain('1 degraded · 2 watch')
  })
})
