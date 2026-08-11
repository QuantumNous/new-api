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
import { after, afterEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLInputElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'NodeFilter',
  'KeyboardEvent',
  'PointerEvent',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { ChannelChainsDialog } = await import('../channel-chains-dialog')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = {
  get: ApiMethod
  post: ApiMethod
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post

function installApiFixtures(createdPayloads: Array<Record<string, unknown>>) {
  apiClient.get = async (url) => {
    switch (url) {
      case '/api/user/self/channel_chains':
        return {
          data: {
            success: true,
            data: {
              chains: [],
              max_chains: 10,
              max_groups_per_chain: 10,
              token_usage: {},
            },
          },
        }
      case '/api/user/self/groups':
        return {
          data: {
            success: true,
            data: {
              default: { desc: 'Standard access', ratio: 1 },
              vip: { desc: 'Priority access', ratio: 2 },
            },
          },
        }
      default:
        throw new Error(`Unexpected GET ${url}`)
    }
  }
  apiClient.post = async (url, data) => {
    assert.equal(url, '/api/user/self/channel_chains')
    assert.ok(data && typeof data === 'object')
    createdPayloads.push(data as Record<string, unknown>)
    return { data: { success: true, data: {} } }
  }
}

async function waitForCondition(
  condition: () => boolean,
  failureMessage: string
): Promise<void> {
  if (condition()) return

  await new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!condition()) return
      clearTimeout(timeoutId)
      observer.disconnect()
      resolve()
    })
    const timeoutId = setTimeout(() => {
      observer.disconnect()
      reject(new Error(`${failureMessage}: ${document.body.textContent}`))
    }, 1500)

    observer.observe(document, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    })
  })
}

function findButton(text: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.includes(text)
    ) ?? null
  )
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      domWindow.HTMLInputElement.prototype,
      'value'
    )?.set
    assert.ok(valueSetter)
    valueSetter.call(input, value)
    input.dispatchEvent(
      new domWindow.Event('input', { bubbles: true }) as unknown as Event
    )
  })
}

describe('Channel chains dialog', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let queryClient: InstanceType<typeof QueryClient>

  afterEach(async () => {
    apiClient.get = originalGet
    apiClient.post = originalPost
    await act(async () => root?.unmount())
    queryClient?.clear()
    host?.remove()
    document.body.replaceChildren()
  })

  after(() => {
    domWindow.close()
  })

  test('adds user-selectable pricing groups to a group chain', async () => {
    const createdPayloads: Array<Record<string, unknown>> = []
    installApiFixtures(createdPayloads)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <ChannelChainsDialog open onOpenChange={() => undefined} />
          </I18nextProvider>
        </QueryClientProvider>
      )
    )

    await act(async () =>
      waitForCondition(
        () => findButton('New chain') !== null,
        'channel chains dialog did not finish loading'
      )
    )

    await act(async () => findButton('New chain')?.click())
    await act(async () =>
      waitForCondition(
        () =>
          document.querySelector<HTMLInputElement>(
            '[aria-label="Add a group to the chain"]'
          ) !== null,
        'channel chain editor did not open'
      )
    )

    const channelInput = document.querySelector<HTMLInputElement>(
      '[aria-label="Add a group to the chain"]'
    )
    assert.ok(channelInput)
    await act(async () =>
      channelInput.dispatchEvent(
        new domWindow.MouseEvent('mousedown', {
          bubbles: true,
        }) as unknown as Event
      )
    )
    await act(async () =>
      waitForCondition(
        () =>
          document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]')
            .length > 0,
        'channel picker did not open'
      )
    )

    const optionText = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]'),
    ]
      .map((item) => item.textContent ?? '')
      .join(' ')
    assert.equal(optionText.includes('vip (2x)'), true)
    assert.equal(optionText.includes('default (1x)'), true)
    assert.equal(optionText.includes('auto'), false)
    assert.equal(optionText.includes('Private Channel Alpha'), false)

    const vipOption = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]'),
    ].find((item) => item.textContent?.includes('vip (2x)'))
    assert.ok(vipOption)
    await act(async () => vipOption.click())
    await act(async () =>
      waitForCondition(
        () => document.body.textContent?.includes('vip') === true,
        'selected pricing group was not rendered'
      )
    )

    assert.equal(
      document.body.textContent?.includes('Private Channel Alpha'),
      false
    )
    assert.equal(document.body.textContent?.includes('2x'), true)

    const nameInput = document.querySelector<HTMLInputElement>(
      '#channel-chain-name'
    )
    assert.ok(nameInput)
    await changeInput(nameInput, 'Primary')
    await act(async () => findButton('Save chain')?.click())
    await act(async () =>
      waitForCondition(
        () => createdPayloads.length === 1,
        'group chain was not created'
      )
    )
    assert.deepEqual(createdPayloads[0], {
      name: 'Primary',
      groups: ['vip'],
    })
  })
})
