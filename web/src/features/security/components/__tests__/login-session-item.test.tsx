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
import { act, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, expect, test } from 'vitest'

import type { LoginSession } from '@/stores/auth-store'

import { LoginSessionItem } from '../login-session-item'

const TWO_HOURS_AGO = Math.floor(Date.now() / 1000) - 2 * 60 * 60

const session: LoginSession = {
  sid: 's1',
  current: false,
  login_method: 'password',
  ip: '1.1.1.1',
  user_agent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  created_at: TWO_HOURS_AGO,
  last_active_at: TWO_HOURS_AGO,
  expires_at: TWO_HOURS_AGO + 86_400,
}

async function setInterfaceLanguage(language: string) {
  if (!i18next.hasResourceBundle(language, 'translation')) {
    i18next.addResourceBundle(language, 'translation', {})
  }
  await act(() => i18next.changeLanguage(language))
}

afterEach(async () => {
  await act(() => i18next.changeLanguage('en'))
})

test('renders last-active relative time in zhCN and fr instead of English ago', async () => {
  await setInterfaceLanguage('zhCN')
  const { rerender } = render(
    <LoginSessionItem session={session} onRevoke={() => undefined} />
  )
  const chinese = screen.getByText(/小时/).textContent ?? ''
  expect(chinese).not.toMatch(/ago/i)

  await setInterfaceLanguage('fr')
  rerender(<LoginSessionItem session={session} onRevoke={() => undefined} />)
  const french = screen.getByText(/heure/).textContent ?? ''
  expect(french).not.toMatch(/ago/i)
})
