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
import { HealthBadge } from './health-badge'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('HealthBadge', () => {
  test('labels low-traffic models as insufficient data', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <HealthBadge state='insufficient' />
      </I18nextProvider>
    )

    expect(html).toContain('Insufficient data')
    expect(html).toContain('aria-hidden="true"')
  })
})
