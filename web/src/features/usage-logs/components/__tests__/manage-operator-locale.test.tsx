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
import { cleanup, render, screen, within } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'

import type { UsageLog } from '../../data/schema'
import { DetailsDialog } from '../dialogs/details-dialog'

// Provider icons are unused by management logs (see quota-adjustment.test.tsx).
vi.mock('@lobehub/icons', () => ({}))

vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterAll(() => vi.unstubAllGlobals())

afterEach(() => {
  cleanup()
})

const FSI = '⁨'
const PDI = '⁩'

const log: UsageLog = {
  id: 1,
  user_id: 2,
  created_at: 1,
  type: 3,
  content: 'Managed user',
  username: 'member',
  token_name: '',
  model_name: '',
  quota: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  use_time: 0,
  is_stream: false,
  channel: 0,
  channel_name: '',
  token_id: 0,
  group: '',
  ip: '',
  request_id: 'manage-request',
  upstream_request_id: '',
  other: JSON.stringify({
    admin_info: { admin_username: 'root-user', admin_id: 1 },
  }),
}

async function renderDialog(lng: string) {
  const i18n = createInstance()
  await i18n.init({
    lng,
    fallbackLng: 'en',
    resources: { en, fa },
    interpolation: { escapeValue: false },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <DetailsDialog
          log={log}
          isAdmin
          isRoot
          open
          onOpenChange={() => undefined}
        />
      </QueryClientProvider>
    </I18nextProvider>
  )
  return within(screen.getByRole('dialog'))
}

describe('management log operator', () => {
  test('in English, shows the operator as upstream does', async () => {
    const dialog = await renderDialog('en')

    expect(dialog.getByText('root-user (ID: 1)')).toBeInTheDocument()
  })

  test('in Persian, translates the ID label and isolates the name', async () => {
    const dialog = await renderDialog('fa')

    expect(
      dialog.getByText(`${FSI}root-user${PDI} (شناسه: 1)`)
    ).toBeInTheDocument()
  })
})
