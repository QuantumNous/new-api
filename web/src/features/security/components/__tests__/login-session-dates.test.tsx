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
import { act, cleanup, render, screen } from '@testing-library/react'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoginSession } from '@/stores/auth-store'

import { LoginSessionItem } from '../login-session-item'

// Now is 2026-09-25 15:05:09 local time; the session was active three
// minutes earlier and expires on 2026-10-25 13:55 (3 Aban 1405).
const NOW = new Date(2026, 8, 25, 15, 5, 9)
const session: LoginSession = {
  sid: 's1',
  current: false,
  login_method: 'password',
  ip: '203.0.113.7',
  user_agent: '',
  created_at: Math.floor(NOW.getTime() / 1000) - 3600,
  last_active_at: Math.floor(NOW.getTime() / 1000) - 180,
  expires_at: Math.floor(new Date(2026, 9, 25, 13, 55).getTime() / 1000),
}

let i18n: I18n

// Interpolation as in src/i18n/config.ts: values are not HTML-escaped.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  i18n = createInstance()
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderSession() {
  render(
    <I18nextProvider i18n={i18n}>
      <LoginSessionItem session={session} onRevoke={vi.fn()} />
    </I18nextProvider>
  )
}

describe('login session times', () => {
  it('in English, keeps the Day.js relative time and the Gregorian expiry', async () => {
    renderSession()

    expect(
      screen.getByText('Last active 3 minutes ago · Expires 2026-10-25 13:55')
    ).toBeInTheDocument()
  })

  it('after switching to Persian without a reload, shows Persian relative time and a Solar Hijri expiry', async () => {
    renderSession()

    await act(async () => {
      await i18n.changeLanguage('fa')
    })

    expect(screen.getByText(/۳ دقیقه پیش/)).toBeInTheDocument()
    expect(screen.getByText(/۱۴۰۵\/۰۸\/۰۳ ۱۳:۵۵/)).toBeInTheDocument()
    expect(screen.queryByText(/minutes ago|2026-10-25/)).not.toBeInTheDocument()
  })

  it('after switching back to English, shows the English text again', async () => {
    await i18n.changeLanguage('fa')
    renderSession()

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    expect(
      screen.getByText('Last active 3 minutes ago · Expires 2026-10-25 13:55')
    ).toBeInTheDocument()
  })
})
