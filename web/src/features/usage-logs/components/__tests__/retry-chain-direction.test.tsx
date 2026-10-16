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
import {
  cleanup,
  render,
  screen,
  within,
  type BoundFunctions,
  type queries,
} from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'

import type { UsageLog } from '../../data/schema'
import { DetailsDialog } from '../dialogs/details-dialog'

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

// A request retried on channel 3, then 7, then 12.
const log: UsageLog = {
  id: 1,
  user_id: 2,
  created_at: 1,
  type: 2,
  content: '',
  username: 'member',
  token_name: '',
  model_name: 'gpt-4o',
  quota: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  use_time: 0,
  is_stream: false,
  channel: 12,
  channel_name: '',
  token_id: 0,
  group: '',
  ip: '',
  request_id: 'retry-request',
  upstream_request_id: '',
  other: JSON.stringify({ admin_info: { use_channel: ['3', '7', '12'] } }),
}

async function renderDialog(
  lng: string
): Promise<BoundFunctions<typeof queries>> {
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

describe('admin retry chain', () => {
  test('in English, joins the channels with left-to-right arrows as before', async () => {
    const dialog = await renderDialog('en')

    expect(dialog.getByText('3 → 7 → 12')).toBeInTheDocument()
  })

  test('in Persian, isolates each channel and points the arrows to the left', async () => {
    const dialog = await renderDialog('fa')

    expect(
      dialog.getByText(`${FSI}3${PDI} ← ${FSI}7${PDI} ← ${FSI}12${PDI}`)
    ).toBeInTheDocument()
  })
})
