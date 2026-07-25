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
import { Sheet } from '@/components/ui/sheet'
import { ApiKeyModelScopeSheetContent } from './api-key-model-scope-sheet'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('ApiKeyModelScopeSheet', () => {
  test('passes the ratio context through the opened detail preview', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <Sheet open>
          <ApiKeyModelScopeSheetContent
            apiKeyName='Detail key'
            defaultRatio={1}
            models={[
              {
                id: 'detail-model',
                allowlist_match_key: 'detail-model',
                vendor: null,
                supported_endpoint_types: ['openai'],
                availability_status: 'available',
              },
            ]}
            modelRatios={{ 'detail-model': 0.7 }}
            totalCount={1}
          />
        </Sheet>
      </I18nextProvider>
    )

    expect(html).toContain('Callable model scope')
    expect(html).toContain('Exclusive ratio 0.7×')
    expect(html).toContain(
      'This exclusive ratio overrides the default ratio 1×; the two are not multiplied.'
    )
  })
})
