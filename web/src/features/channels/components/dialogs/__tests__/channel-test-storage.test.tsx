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
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'
import type React from 'react'

import type { Channel } from '../../../types'

const domWindow = new Window({ url: 'https://example.test/channels' })
for (const key of [
  'window',
  'document',
  'navigator',
  'localStorage',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'MouseEvent',
  'PointerEvent',
  'KeyboardEvent',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act, useEffect } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { ChannelsProvider, useChannels } =
  await import('../../channels-provider')
const { ChannelTestDialog } = await import('../channel-test-dialog')

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'GCS bucket: writes, reads, and deletes a temporary object':
          'GCS bucket: writes, reads, and deletes a temporary object',
      },
    },
  },
})

const channel: Channel = {
  id: 7,
  type: 41,
  key: '',
  test_model: 'gemini-2.5-pro',
  status: 1,
  name: 'Vertex storage',
  created_time: 0,
  test_time: 0,
  response_time: 0,
  other: '',
  balance: 0,
  balance_updated_time: 0,
  models: 'gemini-2.5-pro,storage:gs:bucket-a',
  group: 'default',
  used_quota: 0,
  other_info: '',
  remark: '',
  max_input_tokens: 0,
  channel_info: {
    is_multi_key: false,
    multi_key_size: 0,
    multi_key_polling_index: 0,
    multi_key_mode: 'random',
  },
  settings: '{}',
}

function SeedCurrentChannel(props: { children: React.ReactNode }) {
  const setCurrentRow = useChannels().setCurrentRow
  useEffect(() => {
    setCurrentRow(channel)
  }, [setCurrentRow])
  return props.children
}

describe('channel test storage rows', () => {
  after(() => domWindow.close())

  test('labels Vertex storage models as destructive temporary-object probes', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <ChannelsProvider>
                <SeedCurrentChannel>
                  <ChannelTestDialog open onOpenChange={() => undefined} />
                </SeedCurrentChannel>
              </ChannelsProvider>
            </TooltipProvider>
          </QueryClientProvider>
        </I18nextProvider>
      )
      await domWindow.happyDOM.waitUntilComplete()
    })

    assert.match(document.body.textContent ?? '', /storage:gs:bucket-a/)
    assert.match(
      document.body.textContent ?? '',
      /GCS bucket: writes, reads, and deletes a temporary object/
    )
    assert.equal(
      document.body.querySelectorAll('[data-vertex-storage-test-description]')
        .length,
      1
    )

    await act(async () => root.unmount())
    queryClient.clear()
    document.body.replaceChildren()
  })
})
