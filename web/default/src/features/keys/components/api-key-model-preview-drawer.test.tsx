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
import { Drawer } from '@/components/ui/drawer'
import {
  ApiKeyModelPreviewDrawer,
  ApiKeyModelPreviewDrawerContent,
} from './api-key-model-preview-drawer'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('ApiKeyModelPreviewDrawer', () => {
  test('uses neutral new-key wording in create mode', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <ApiKeyModelPreviewDrawer
          defaultRatio={0}
          modelRatios={{}}
          drawerDescription='This preview shows the models the new API key can call with the current settings.'
          drawerTitle='Models available to the new API key'
          emptyDescription='Review the new API key and model access settings.'
          emptyTitle='No models available to the new API key'
          models={[]}
          totalCount={4}
          scopeKey='fixed-account'
          scopeTitle='Current account scope'
          summary='New keys use the current account scope with 4 available models'
        />
      </I18nextProvider>
    )

    expect(html).toContain(
      'New keys use the current account scope with 4 available models'
    )
    expect(html).toContain('View models')
    expect(html).toContain('data-slot="drawer-trigger"')
    expect(html).not.toContain('data-slot="drawer-content"')
    expect(html).not.toContain('No models available to the new API key')
    expect(html).toContain(
      'This preview shows the models the new API key can call with the current settings.'
    )
    expect(html).not.toContain('this API key')
  })

  test('keeps current-key wording in edit mode', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <ApiKeyModelPreviewDrawer
          defaultRatio={1}
          modelRatios={{}}
          drawerDescription='This preview follows the current API key and model access settings.'
          drawerTitle='Models available to this API key'
          emptyDescription='Review the API key and model access settings.'
          emptyTitle='No models available to this API key'
          models={[]}
          totalCount={4}
          scopeKey='fixed-account'
          scopeTitle='Current account scope'
          summary='Effective 0 / 4 in account'
        />
      </I18nextProvider>
    )

    expect(html).toContain('Effective 0 / 4 in account')
    expect(html).toContain(
      'This preview follows the current API key and model access settings.'
    )
  })

  test('passes an explicit zero ratio through the opened mobile preview', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <Drawer open>
          <ApiKeyModelPreviewDrawerContent
            defaultRatio={1}
            modelRatios={{ 'mobile-model': 0 }}
            drawerDescription='This preview shows the models the new API key can call with the current settings.'
            drawerTitle='Models available to the new API key'
            emptyDescription='Review the new API key and model access settings.'
            emptyTitle='No models available to the new API key'
            models={[
              {
                id: 'mobile-model',
                allowlist_match_key: 'mobile-model',
                vendor: null,
                supported_endpoint_types: ['openai'],
                availability_status: 'available',
              },
            ]}
            totalCount={1}
            scopeKey='standard'
            scopeTitle='Standard'
            summary='1 model available'
          />
        </Drawer>
      </I18nextProvider>
    )

    expect(html).toContain('Models available to the new API key')
    expect(html).toContain('Exclusive ratio 0×')
    expect(html).toContain(
      'This exclusive ratio overrides the default ratio 1×; the two are not multiplied.'
    )
  })
})
