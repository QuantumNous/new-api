/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { ApiKeyStatistics } from './api-key-statistics'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('ApiKeyStatistics', () => {
  test('renders every account-wide status count', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <ApiKeyStatistics
          stats={{
            total: 12,
            enabled: 7,
            disabled: 2,
            expired: 1,
            exhausted: 2,
          }}
          isLoading={false}
        />
      </I18nextProvider>
    )

    expect(html).toContain('API Key Statistics')
    for (const label of [
      'Total',
      'Enabled',
      'Disabled',
      'Expired',
      'Exhausted',
    ]) {
      expect(html).toContain(label)
    }
    for (const count of ['12', '7', '2', '1']) {
      expect(html).toContain(`>${count}<`)
    }
  })
})
