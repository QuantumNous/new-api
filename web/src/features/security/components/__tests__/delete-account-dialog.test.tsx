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
import { render, screen } from '@testing-library/react'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import zhCN from '@/i18n/locales/zh.json'

import { DeleteAccountDialog } from '../dialogs/delete-account-dialog'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}))

// Same interpolation and separator options as src/i18n/config.ts.
async function createAppI18n(lng: string): Promise<I18n> {
  const instance = createInstance()
  await instance.init({
    lng,
    fallbackLng: 'en',
    resources: { en, zhCN },
    nsSeparator: false,
    interpolation: { escapeValue: false },
  })
  return instance
}

async function renderDialog(lng: string, username: string) {
  const i18n = await createAppI18n(lng)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <DeleteAccountDialog open username={username} onOpenChange={vi.fn()} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('delete account confirmation label', () => {
  it.each([
    ['en', 'Type alice to confirm'],
    ['zhCN', '输入 alice 以确认'],
  ])(
    'in %s, labels the confirmation input with one translated sentence',
    async (lng, expected) => {
      await renderDialog(lng, 'alice')
      const input = screen.getByRole('textbox', { name: expected })
      const label = document.querySelector(`label[for="${input.id}"]`)
      expect(label).toHaveTextContent(expected, { normalizeWhitespace: false })
      expect(label?.querySelector('strong')).toHaveTextContent('alice')
    }
  )

  it('with markup characters in the username, shows the username literally in bold', async () => {
    await renderDialog('en', '<b>a&amp;b</b>')
    const input = screen.getByRole('textbox', {
      name: 'Type <b>a&amp;b</b> to confirm',
    })
    const label = document.querySelector(`label[for="${input.id}"]`)
    expect(label?.querySelector('strong')?.textContent).toBe('<b>a&amp;b</b>')
  })
})
