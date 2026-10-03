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
import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ru from '@/i18n/locales/ru.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import type { LoginSession } from '@/stores/auth-store'

import { LoginSessionItem } from '../login-session-item'
import { PasskeyCard } from '../passkey-card'

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

async function renderInLanguage(language: string, element: React.ReactNode) {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: { en: { translation: {} }, zhCN: zh, ru },
    nsSeparator: false,
    interpolation: { escapeValue: false },
  })
  return render(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>)
}

function loginSession(lastActiveMs: number): LoginSession {
  return {
    sid: 'session-1',
    current: false,
    login_method: 'password',
    ip: '203.0.113.7',
    user_agent: '',
    created_at: Math.floor((NOW - 30 * DAY) / 1000),
    last_active_at: Math.floor(lastActiveMs / 1000),
    expires_at: Math.floor((NOW + 7 * DAY) / 1000),
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('login session last active time', () => {
  it.each([
    { language: 'en', ago: HOUR, expected: '1 hour ago' },
    { language: 'en', ago: 28 * DAY, expected: '28 days ago' },
    { language: 'zhCN', ago: 2 * HOUR, expected: '2小时前' },
    { language: 'ru', ago: 2 * HOUR, expected: '2 часа назад' },
    { language: 'ru', ago: 21 * MINUTE, expected: '21 минуту назад' },
  ])(
    'shows $expected in the $language interface',
    async ({ language, ago, expected }) => {
      await renderInLanguage(
        language,
        <LoginSessionItem
          session={loginSession(NOW - ago)}
          onRevoke={() => undefined}
        />
      )

      expect(screen.getByText(expected, { exact: false })).toBeInTheDocument()
    }
  )
})

describe('passkey last used time', () => {
  it.each([
    { language: 'en', ago: DAY, expected: '1 day ago' },
    { language: 'zhCN', ago: DAY, expected: '1天前' },
    { language: 'ru', ago: 21 * MINUTE, expected: '21 минуту назад' },
  ])(
    'shows $expected in the $language interface',
    async ({ language, ago, expected }) => {
      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: {
            enabled: true,
            last_used_at: new Date(NOW - ago).toISOString(),
          },
        },
      })

      await renderInLanguage(language, <PasskeyCard loading={false} />)

      expect(
        await screen.findByText(expected, { exact: false })
      ).toBeInTheDocument()
    }
  )
})
