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
import type { ModelAccessModel } from '../types'
import { ModelAccessPreview } from './model-access-preview'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

const models: ModelAccessModel[] = [
  {
    id: 'gpt-preview',
    allowlist_match_key: 'gpt-preview',
    vendor: { id: 1, name: 'OpenAI' },
    supported_endpoint_types: ['openai-response'],
    availability_status: 'temporary_failure',
  },
]

describe('ModelAccessPreview', () => {
  test('renders strict-scope context, vendor filters, compatible endpoints, and copy actions', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <ModelAccessPreview
          defaultRatio={0}
          modelRatios={{ 'gpt-preview': 0.7 }}
          models={models}
          totalCount={3}
          scopeTitle='Ordinary'
          scopeDescription='Standard access'
          summary='Current group supports 3 models'
        />
      </I18nextProvider>
    )

    expect(html).toContain('Strict scope preview')
    expect(html).toContain(
      'Actual requests may still be affected by API key status, quota, IP restrictions, and channel status.'
    )
    expect(html).toContain('Current group supports 3 models')
    expect(html).not.toContain('1 / 3 models')
    expect(html).toContain('Model vendors')
    expect(html).toContain('OpenAI Compatible')
    expect(html).toContain('Temporary failure')
    expect(html).toContain('aria-label="Copy to clipboard"')
    expect(html).toContain('Exclusive ratio 0.7×')
    expect(html).toContain('default ratio 0×')
  })

  test('uses neutral API key wording for an empty current-account preview', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <ModelAccessPreview
          defaultRatio={null}
          modelRatios={{}}
          models={[]}
          totalCount={0}
          scopeTitle='Current account scope'
        />
      </I18nextProvider>
    )

    expect(html).toContain('Review the API key and model access settings.')
    expect(html).not.toContain('Review the group')
  })
})
