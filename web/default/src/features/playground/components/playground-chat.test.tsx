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
          Copy: 'Copy',
          Download: 'Download',
          'Generated image': 'Generated image',
        },
      },
    },
    interpolation: { escapeValue: false },
  })
})

describe('PlaygroundChat', () => {
  test('renders icon-only download actions before Copy', () => {
    const pngSrc = 'data:image/png;base64,QUJDRA=='
    const webpSrc = 'data:image/webp;base64,RUZHSA=='
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
                  content: `![preview](${pngSrc})\n![second preview](${webpSrc})`,
                },
              ],
            },
          ]}
        />
      </I18nextProvider>
    )

    expect(html).toContain(`<img alt="preview"`)
    expect(html).toContain(`<img alt="second preview"`)
    expect(html).toContain(`src="${pngSrc}"`)
    expect(html).toContain(`src="${webpSrc}"`)
    expect(html).toContain(`href="${pngSrc}"`)
    expect(html).toContain(`href="${webpSrc}"`)
    expect(html).toContain('download="generated-image-1.png"')
    expect(html).toContain('download="generated-image-2.webp"')
    expect(html.match(/<a\b/g)?.length ?? 0).toBe(2)
    expect(html.match(/\bdownload=/g)?.length ?? 0).toBe(2)
    expect(html.match(/aria-label="Download"/g)?.length ?? 0).toBe(2)
    expect(html).not.toContain('>Download<')
    expect(html.indexOf('<img alt="preview"')).toBeLessThan(
      html.indexOf('download="generated-image-1.png"')
    )
    expect(html.indexOf('<img alt="second preview"')).toBeLessThan(
      html.indexOf('download="generated-image-2.webp"')
    )
    expect(html.indexOf('download="generated-image-1.png"')).toBeLessThan(
      html.indexOf('aria-label="Copy"')
    )
    expect(html.indexOf('download="generated-image-2.webp"')).toBeLessThan(
      html.indexOf('aria-label="Copy"')
    )
  })

  test('keeps generated media attached to its message version', () => {
    const firstVersionSrc = 'https://cdn.example/first.png'
    const secondVersionSrc = 'https://cdn.example/second.png'
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlaygroundChat
          messages={[
            {
              key: 'assistant-versions',
              from: 'assistant',
              status: 'complete',
              versions: [
                {
                  id: 'version-1',
                  content: 'first result',
                  generatedMedia: [{ type: 'image', url: firstVersionSrc }],
                },
                {
                  id: 'version-2',
                  content: 'second result',
                  generatedMedia: [{ type: 'image', url: secondVersionSrc }],
                },
              ],
            },
          ]}
        />
      </I18nextProvider>
    )

    expect(html).toContain(`src="${firstVersionSrc}"`)
    expect(html).toContain(`src="${secondVersionSrc}"`)
    expect(html.match(new RegExp(firstVersionSrc, 'g'))?.length).toBe(2)
    expect(html.match(new RegExp(secondVersionSrc, 'g'))?.length).toBe(2)
  })

  test('does not render or download unsafe generated media URLs', () => {
    const safeSrc = 'https://cdn.example/safe.png'
    const unsafeSrc = 'javascript:alert(1)'
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlaygroundChat
          messages={[
            {
              key: 'assistant-unsafe-media',
              from: 'assistant',
              status: 'complete',
              versions: [
                {
                  id: 'version-1',
                  content: 'generated result',
                  generatedMedia: [
                    { type: 'image', url: unsafeSrc },
                    { type: 'image', url: safeSrc },
                  ],
                },
              ],
            },
          ]}
        />
      </I18nextProvider>
    )

    expect(html).toContain(`src="${safeSrc}"`)
    expect(html).not.toContain(unsafeSrc)
  })
})
