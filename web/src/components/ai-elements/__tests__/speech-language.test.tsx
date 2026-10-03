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
import { act, render } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PromptInputSpeechButton } from '../prompt-input'

// The Web Speech API is not in jsdom; record each recognizer the button makes.
let recognizers: { lang: string }[] = []

class FakeSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  constructor() {
    recognizers.push(this)
  }
  start(): void {}
  stop(): void {}
}

async function renderSpeechButton(language: string) {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <PromptInputSpeechButton />
    </I18nextProvider>
  )
  return i18n
}

beforeEach(() => {
  recognizers = []
  vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('voice input language', () => {
  it.each([
    { language: 'en', lang: 'en' },
    { language: 'ru', lang: 'ru' },
    { language: 'zhCN', lang: 'zh-CN' },
    { language: 'zhTW', lang: 'zh-TW' },
  ])(
    'listens for $lang in the $language interface',
    async ({ language, lang }) => {
      await renderSpeechButton(language)

      expect(recognizers.at(-1)?.lang).toBe(lang)
    }
  )

  it('leaves the browser default language when the interface language is not a valid tag', async () => {
    await renderSpeechButton('not a language')

    expect(recognizers.at(-1)?.lang).toBe('')
  })

  it('listens for the new language after the interface language changes', async () => {
    const i18n = await renderSpeechButton('en')

    await act(() => i18n.changeLanguage('ru'))

    expect(recognizers.at(-1)?.lang).toBe('ru')
  })
})
