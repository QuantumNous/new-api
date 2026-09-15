/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

import { ToolExplorer } from '../components/tool-explorer'
import { guideTools, troubleshootRows, useCaseRows } from '../data'

describe('beginner guide localization', () => {
  it('updates tool instructions when the language changes', async () => {
    const i18n = createInstance()
    await i18n
      .use(initReactI18next)
      .init({ lng: 'zh', fallbackLng: 'en', resources: { en, zh } })
    const user = userEvent.setup()
    const address = {
      host: 'https://api.example.test',
      baseUrl: 'https://api.example.test/v1',
      fullUrl: 'https://api.example.test/v1/chat/completions',
      fill: (text: string) =>
        text.replaceAll(
          '{{FULL_URL}}',
          'https://api.example.test/v1/chat/completions'
        ),
    }
    render(
      <I18nextProvider i18n={i18n}>
        <ToolExplorer address={address} />
      </I18nextProvider>
    )

    await user.click(
      screen.getByRole('button', { name: /WorkBuddy \/ CodeBuddy/ })
    )
    expect(screen.getByText('打开 WorkBuddy,点击左下角账户头像')).toBeVisible()

    await act(() => i18n.changeLanguage('en'))

    expect(
      screen.getByText(
        'Open WorkBuddy and click the account avatar at the bottom left.'
      )
    ).toBeVisible()
    expect(
      screen.getByText(
        'Set the full endpoint URL to https://api.example.test/v1/chat/completions.'
      )
    ).toBeVisible()
  })

  it.each(Object.entries({ en, zh, 'zh-TW': zhTW, fr, ja, ru, vi }))(
    'provides translated guide prose and intact address placeholders in %s',
    (_locale, resource) => {
      const translations = resource.translation as Record<string, string>
      const prose = [
        ...guideTools.flatMap((tool) => [
          tool.summary,
          ...tool.steps,
          ...(tool.tips ?? []),
        ]),
        ...troubleshootRows.flatMap((row) => [row.meaning, row.fix]),
        ...useCaseRows.map((row) => row.useCase),
      ]

      for (const key of prose) {
        expect(translations[key], key).toBeTruthy()
        expect(translations[key].match(/\{\{[^}]+\}\}/g) ?? [], key).toEqual(
          key.match(/\{\{[^}]+\}\}/g) ?? []
        )
      }
    }
  )
})
