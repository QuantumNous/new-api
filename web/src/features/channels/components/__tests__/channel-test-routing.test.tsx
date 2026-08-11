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

import type { Row } from '@tanstack/react-table'
import { Window } from 'happy-dom'

import type { Channel } from '../../types'

const domWindow = new Window({ url: 'https://example.test/channels' })
for (const key of [
  'window',
  'document',
  'navigator',
  'localStorage',
  'HTMLElement',
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

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { ChannelRowActionsLayoutContext } =
  await import('../channel-row-actions-context')
const { ChannelsProvider, useChannels } = await import('../channels-provider')
const { DataTableRowActions } = await import('../data-table-row-actions')

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
        Edit: 'Edit',
        'Test Connection': 'Test Connection',
        'Test Channel Connection': 'Test Channel Connection',
        Enable: 'Enable',
        Disable: 'Disable',
        'Open menu': 'Open menu',
      },
    },
  },
})

const channel: Channel = {
  id: 7,
  type: 41,
  key: '',
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

const row = { original: channel } as Row<Channel>

function ChannelsStateProbe() {
  const channels = useChannels()
  return (
    <output data-testid='channels-state'>
      {channels.open ?? 'closed'}:{channels.currentRow?.id ?? 'none'}
    </output>
  )
}

async function renderActions(layout: 'table' | 'card') {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ChannelsProvider>
              <ChannelRowActionsLayoutContext.Provider value={layout}>
                <DataTableRowActions row={row} />
                <ChannelsStateProbe />
              </ChannelRowActionsLayoutContext.Provider>
            </ChannelsProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </I18nextProvider>
    )
  })

  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      queryClient.clear()
      document.body.replaceChildren()
    },
  }
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new domWindow.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    )
    await Promise.resolve()
    await domWindow.happyDOM.waitUntilComplete()
  })
}

function getChannelsState(container: HTMLElement) {
  return container.querySelector('[data-testid="channels-state"]')?.textContent
}

describe('channel test entry routing', () => {
  after(() => domWindow.close())

  test('table gauge opens the channel test dialog for the current channel', async () => {
    const rendered = await renderActions('table')
    const gauge = rendered.container.querySelector(
      'button[aria-label="Test Connection"]'
    )
    assert.ok(gauge)

    await click(gauge)

    assert.equal(getChannelsState(rendered.container), 'test-channel:7')
    await rendered.unmount()
  })

  test('card view exposes one test button and opens the same dialog', async () => {
    const rendered = await renderActions('card')
    const testButtons = rendered.container.querySelectorAll(
      'button[aria-label="Test Connection"], button[aria-label="Test Channel Connection"]'
    )
    assert.equal(testButtons.length, 1)

    await click(testButtons[0])

    assert.equal(getChannelsState(rendered.container), 'test-channel:7')
    await rendered.unmount()
  })

  test('dropdown test action opens the same dialog', async () => {
    const rendered = await renderActions('table')
    const trigger = rendered.container.querySelector(
      '[data-slot="dropdown-menu-trigger"]'
    )
    assert.ok(trigger)
    await click(trigger)

    const menuItem = [
      ...document.querySelectorAll('[data-slot="dropdown-menu-item"]'),
    ].find((item) => item.textContent?.includes('Test Connection'))
    assert.ok(menuItem)
    await click(menuItem)

    assert.equal(getChannelsState(rendered.container), 'test-channel:7')
    await rendered.unmount()
  })
})
