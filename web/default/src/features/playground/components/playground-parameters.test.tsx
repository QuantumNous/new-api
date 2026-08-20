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
import type { MediaGenerationProfile } from '../lib'
import { PlaygroundParameters } from './playground-parameters'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

const profile: MediaGenerationProfile = {
  kind: 'image',
  family: 'gpt-image',
  fields: [],
  defaults: {},
}

describe('PlaygroundParameters interaction surface', () => {
  test('uses an anchored popover trigger instead of a modal dialog trigger', () => {
    const markup = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlaygroundParameters
          model='gpt-image-2'
          onChange={() => undefined}
          profile={profile}
          settings={{}}
        />
      </I18nextProvider>
    )

    expect(markup).toContain('data-slot="popover-trigger"')
    expect(markup).not.toContain('data-slot="dialog-trigger"')
  })
})
