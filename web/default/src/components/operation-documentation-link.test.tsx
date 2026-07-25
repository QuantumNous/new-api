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
import { OperationDocumentationLink } from './operation-documentation-link'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          'Operation documentation': 'Operation documentation',
        },
      },
    },
    interpolation: { escapeValue: false },
  })
})

describe('OperationDocumentationLink', () => {
  test('opens the official documentation in a new tab', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <OperationDocumentationLink />
      </I18nextProvider>
    )

    expect(html).toContain('Operation documentation')
    expect(html).toContain('href="https://docs.flatkey.ai/"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })
})
