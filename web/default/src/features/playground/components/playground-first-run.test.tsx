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
import { FirstRunWelcome } from './playground-first-run'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderWelcome(models: Array<{ label: string; value: string }>) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <FirstRunWelcome models={models} onPickExample={() => undefined} />
    </I18nextProvider>
  )
}

describe('FirstRunWelcome media examples', () => {
  test('shows media examples only when a visible compatible model exists', () => {
    const videoOnly = renderWelcome([
      { label: 'seedance-2.5', value: 'seedance-2.5' },
    ])

    expect(videoOnly).not.toContain('Generate an image of a cat astronaut')
    expect(videoOnly).toContain('Generate a video of a cat astronaut')
  })

  test('does not fall back to another video model for the video example', () => {
    const staleVideoOnly = renderWelcome([
      { label: 'seedance-2.0', value: 'seedance-2.0' },
    ])

    expect(staleVideoOnly).not.toContain('Generate a video of a cat astronaut')
  })

  test('keeps media examples available alongside a handoff', () => {
    const markup = renderWelcome([
      { label: 'gpt-image-2', value: 'gpt-image-2' },
      { label: 'seedance-2.5', value: 'seedance-2.5' },
    ])

    expect(markup).toContain('Generate an image of a cat astronaut')
    expect(markup).toContain('Generate a video of a cat astronaut')
    expect(markup).toContain('How do I try flatkey?')
  })
})
