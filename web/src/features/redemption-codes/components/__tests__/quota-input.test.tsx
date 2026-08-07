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
  'HTMLFormElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'PointerEvent',
  'MouseEvent',
  'FocusEvent',
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
const { api } = await import('@/lib/api')
const { RedemptionsProvider } = await import('../redemptions-provider')
const { RedemptionsMutateDrawer } = await import('../redemptions-mutate-drawer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type ApiMethod = (url: string) => Promise<{ data: unknown }>
type MockableApi = {
  get: ApiMethod
}
type RenderedDrawer = {
  host: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
let renderedDrawer: RenderedDrawer | null = null

const currentRow = {
  id: 1,
  user_id: 0,
  name: 'existing',
  key: 'code',
  status: 1,
  quota: 5_000_000,
  created_time: 0,
  redeemed_time: 0,
  expired_time: 0,
  used_user_id: 0,
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

function getQuotaInput(): HTMLInputElement {
  const label = [...document.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent?.includes('Quota')
  )
  assert.ok(label, 'Expected quota label')
  const input = label
    .closest('[data-slot="form-item"]')
    ?.querySelector<HTMLInputElement>('input[type="number"]')
  assert.ok(input, 'Expected quota input')
  return input
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

async function renderDrawer(isUpdate: boolean): Promise<HTMLInputElement> {
  apiClient.get = async (url) => {
    assert.equal(url, `/api/redemption/${currentRow.id}`)
    return { data: { success: true, data: currentRow } }
  }

  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  renderedDrawer = { host, root }

  await act(async () =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <RedemptionsProvider>
          <RedemptionsMutateDrawer
            open
            onOpenChange={() => undefined}
            currentRow={isUpdate ? currentRow : undefined}
          />
        </RedemptionsProvider>
      </I18nextProvider>
    )
  )

  if (isUpdate) {
    await act(async () =>
      waitForCondition(
        () => getQuotaInput().value === '10',
        'Redemption data did not finish loading'
      )
    )
  }

  return getQuotaInput()
}

afterEach(async () => {
  apiClient.get = originalGet
  if (renderedDrawer) {
    await act(async () => renderedDrawer?.root.unmount())
    renderedDrawer.host.remove()
    renderedDrawer = null
  }
  document.body.replaceChildren()
})

after(() => {
  domWindow.close()
})

describe('Redemption quota input', () => {
  test('allows clearing the quota while creating a redemption code', async () => {
    const input = await renderDrawer(false)

    await changeInput(input, '')

    assert.equal(input.value, '')
  })

  test('allows clearing the quota while updating a redemption code', async () => {
    const input = await renderDrawer(true)

    await changeInput(input, '')

    assert.equal(input.value, '')
  })
})
