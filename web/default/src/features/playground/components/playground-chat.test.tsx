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
import { PlaygroundChat } from './playground-chat'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          Download: 'Download',
          'Generated image': 'Generated image',
        },
      },
    },
    interpolation: { escapeValue: false },
  })
})

describe('PlaygroundChat', () => {
  test('renders a download link directly after each completed generated image', () => {
    const imageSrc = 'data:image/png;base64,QUJDRA=='
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlaygroundChat
          messages={[
            {
              key: 'assistant-1',
              from: 'assistant',
              status: 'complete',
              versions: [
                {
                  id: 'version-1',
                  content: `![preview](${imageSrc})`,
                },
              ],
            },
          ]}
        />
      </I18nextProvider>
    )

    expect(html).toContain(`<img alt="preview"`)
    expect(html).toContain(`src="${imageSrc}"`)
    expect(html).toContain(`href="${imageSrc}"`)
    expect(html).toContain('download="generated-image-1.png"')
    expect(html).toContain('Download')
    expect(html.indexOf('<img alt="preview"')).toBeLessThan(
      html.indexOf('download="generated-image-1.png"')
    )
  })
})
