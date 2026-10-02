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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { AccessTokenCatalog, AccessTokenList } from '../../api'
import { AccessTokensCard } from '../access-tokens-card'

// Now is 2026-09-25 15:05 local time (3 Mehr 1405). The token was created
// then and expires on 2026-10-25 13:55 (3 Aban 1405).
const NOW = new Date(2026, 8, 25, 15, 5)
const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

const catalog: AccessTokenCatalog = {
  groups: [],
  max_tokens: 20,
  default_expiry_days: 30,
}
const list: AccessTokenList = {
  items: [
    {
      id: 1,
      name: 'deploy script',
      token_ref: 'a'.repeat(64),
      token_hint: 'Ab12',
      scopes: [],
      expires_at: toSeconds(new Date(2026, 9, 25, 13, 55)),
      last_used_at: 0,
      last_used_ip: '',
      created_at: toSeconds(NOW),
    },
  ],
  legacy: null,
}

let i18n: I18n

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/access_tokens/catalog') {
      return { data: { success: true, data: catalog } }
    }
    if (url === '/api/user/access_tokens') {
      return { data: { success: true, data: list } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
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
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <AccessTokensCard />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('access token dates', () => {
  it('in English, keeps the Intl medium date and no Gregorian title', async () => {
    renderCard()

    const created = await screen.findByText(/^Created Sep 25, 2026, 3:05\sPM$/)
    expect(created).not.toHaveAttribute('title')
    expect(
      screen.getByText(/^Expires Oct 25, 2026, 1:55\sPM$/)
    ).toBeInTheDocument()
  })

  it('in Persian, shows numeric Solar Hijri dates with the Gregorian date as title', async () => {
    await i18n.changeLanguage('fa')
    renderCard()

    const created = await screen.findByText('Created ۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۰')
    expect(created).toHaveAttribute('title', '2026-09-25 15:05:00')
    expect(screen.getByText('Expires ۱۴۰۵/۰۸/۰۳ ۱۳:۵۵:۰۰')).toHaveAttribute(
      'title',
      '2026-10-25 13:55:00'
    )
  })
})
