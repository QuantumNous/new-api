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
import type { ModelHealthDetail } from '../types'
import { GroupBreakdown } from './detail-metrics'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('GroupBreakdown', () => {
  test('uses the dedicated health status label', () => {
    const detail = {
      groups: [
        {
          group: 'default',
          health: 'healthy',
          request_count: 20,
          success_count: 20,
          success_rate: 100,
          avg_latency_ms: 500,
          avg_ttft_ms: 100,
          avg_tps: 30,
        },
      ],
    } as ModelHealthDetail
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <GroupBreakdown detail={detail} />
      </I18nextProvider>
    )

    expect(html).toContain('Health status')
    expect(html).not.toContain('>State</')
  })
})
