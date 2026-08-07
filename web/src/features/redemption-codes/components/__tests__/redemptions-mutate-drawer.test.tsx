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

import { Window } from 'happy-dom'

import type { Redemption } from '../../types'

// Use Bun's runner at runtime while reusing the Node test types installed here.
const bunTestModule = 'bun:test'
const { afterAll, afterEach, test } = (await import(bunTestModule)) as {
  afterAll: typeof import('node:test').after
  afterEach: typeof import('node:test').afterEach
  test: typeof import('node:test').test
}

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLInputElement',
  'HTMLFormElement',
  'HTMLLabelElement',
  'HTMLFieldSetElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'KeyboardEvent',
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
const i18n = (await import('i18next')).default
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { Toaster, toast } = await import('sonner')
const { api } = await import('@/lib/api')
const { useSystemConfigStore } = await import('@/stores/system-config-store')
const { RedemptionsProvider } = await import('../redemptions-provider')
const { RedemptionsMutateDrawer } = await import('../redemptions-mutate-drawer')

await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Failed to load': 'Failed to load',
        'Loading...': 'Loading...',
        'Save changes': 'Save changes',
        'Something went wrong!': 'Something went wrong!',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = {
  get: ApiMethod
  put: ApiMethod
}
type RenderedDrawer = {
  host: HTMLDivElement
  root: ReturnType<typeof createRoot>
}
type CurrencyFixture = {
  quotaDisplayType: 'USD' | 'CNY'
  usdExchangeRate: number
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPut = apiClient.put
const originalConsoleLog = Reflect.get(console, 'log')
let renderedDrawer: RenderedDrawer | null = null

function redemption(id: number, quota = 500001): Redemption {
  return {
    id,
    user_id: 1,
    name: `code-${id}`,
    key: `key-${id}`,
    status: 1,
    quota,
    created_time: 1,
    redeemed_time: 0,
    expired_time: 0,
    used_user_id: 0,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function drawerTree(currentRow: Redemption) {
  return (
    <I18nextProvider i18n={i18n}>
      <RedemptionsProvider>
        <RedemptionsMutateDrawer
          open
          currentRow={currentRow}
          onOpenChange={() => undefined}
        />
      </RedemptionsProvider>
      <Toaster duration={60_000} />
    </I18nextProvider>
  )
}

async function renderDrawer(
  currentRow: Redemption,
  currency: CurrencyFixture = {
    quotaDisplayType: 'USD',
    usdExchangeRate: 1,
  }
): Promise<void> {
  useSystemConfigStore.getState().setConfig({
    currency: {
      displayInCurrency: true,
      quotaDisplayType: currency.quotaDisplayType,
      quotaPerUnit: 500000,
      usdExchangeRate: currency.usdExchangeRate,
      customCurrencySymbol: '¤',
      customCurrencyExchangeRate: 1,
    },
  })

  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  renderedDrawer = { host, root }

  await act(async () => root.render(drawerTree(currentRow)))
}

async function rerenderDrawer(currentRow: Redemption): Promise<void> {
  assert.ok(renderedDrawer)
  await act(async () => renderedDrawer?.root.render(drawerTree(currentRow)))
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

function getSaveButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    'button[form="redemption-form"][type="submit"]'
  )
  assert.ok(button)
  return button
}

function getControlByLabel<T extends HTMLElement>(labelText: string): T {
  const label = [...document.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent?.trim() === labelText
  )
  assert.ok(label, `Expected label "${labelText}"`)
  assert.ok(label.htmlFor)
  const control =
    label.control ??
    label
      .closest('[data-slot="form-item"]')
      ?.querySelector<HTMLElement>('[data-slot="form-control"], input')
  assert.ok(control)
  return control as T
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

async function submitForm(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('#redemption-form')
  assert.ok(form)
  await act(async () =>
    form.dispatchEvent(
      new domWindow.Event('submit', {
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    )
  )
}

async function waitForLoadedForm(): Promise<void> {
  await act(async () =>
    waitForCondition(() => {
      const saveButton = getSaveButton()
      return (
        saveButton.textContent?.includes('Save changes') === true &&
        !saveButton.disabled
      )
    }, 'redemption drawer did not finish loading')
  )
}

afterEach(async () => {
  apiClient.get = originalGet
  apiClient.put = originalPut
  Reflect.set(console, 'log', originalConsoleLog)
  toast.dismiss()
  domWindow.localStorage.clear()
  if (renderedDrawer) {
    await act(async () => renderedDrawer?.root.unmount())
    renderedDrawer.host.remove()
    renderedDrawer = null
  }
  document.body.replaceChildren()
})

afterAll(() => {
  domWindow.close()
})

test('redemption drawer shows the reported CNY quota without floating-point noise', async () => {
  const original = redemption(1, 13888889)
  apiClient.get = async () => ({ data: { success: true, data: original } })

  await renderDrawer(original, {
    quotaDisplayType: 'CNY',
    usdExchangeRate: 7.2,
  })
  await waitForLoadedForm()

  assert.equal(getControlByLabel<HTMLInputElement>('Quota (CNY)').value, '200')
})

test('redemption drawer blocks updates and reports an error when loading rejects', async () => {
  const updates: unknown[] = []
  Reflect.set(console, 'log', () => undefined)
  apiClient.get = async () => {
    throw new Error('network failure')
  }
  apiClient.put = async (_url, data) => {
    updates.push(data)
    return { data: { success: true } }
  }

  await renderDrawer(redemption(1))
  await act(async () =>
    waitForCondition(
      () =>
        document.body.textContent?.includes('Something went wrong!') === true,
      'load error toast was not shown'
    )
  )

  assert.equal(getSaveButton().disabled, true)
  await submitForm()
  assert.deepEqual(updates, [])
})

test('redemption drawer blocks updates and uses localized feedback for unsuccessful responses', async () => {
  apiClient.get = async () => ({
    data: { success: false, message: 'raw server message' },
  })

  await renderDrawer(redemption(1))
  await act(async () =>
    waitForCondition(
      () => document.body.textContent?.includes('Failed to load') === true,
      'unsuccessful-load toast was not shown'
    )
  )

  assert.equal(getSaveButton().disabled, true)
  assert.equal(document.body.textContent?.includes('raw server message'), false)
})

test('redemption drawer keeps the original quota when another field changes', async () => {
  const original = redemption(1)
  const updates: Array<Record<string, unknown>> = []
  apiClient.get = async () => ({ data: { success: true, data: original } })
  apiClient.put = async (_url, data) => {
    assert.ok(data && typeof data === 'object')
    updates.push(data as Record<string, unknown>)
    return { data: { success: true, data: original } }
  }

  await renderDrawer(original)
  await waitForLoadedForm()
  assert.equal(getControlByLabel<HTMLInputElement>('Quota (USD)').value, '1')

  await changeInput(getControlByLabel<HTMLInputElement>('Name'), 'renamed')
  await submitForm()
  await act(async () =>
    waitForCondition(() => updates.length === 1, 'update was not submitted')
  )

  assert.equal(updates[0]?.name, 'renamed')
  assert.equal(updates[0]?.quota, 500001)
})

test('redemption drawer recalculates quota when the quota field changes', async () => {
  const original = redemption(1)
  const updates: Array<Record<string, unknown>> = []
  apiClient.get = async () => ({ data: { success: true, data: original } })
  apiClient.put = async (_url, data) => {
    assert.ok(data && typeof data === 'object')
    updates.push(data as Record<string, unknown>)
    return { data: { success: true, data: original } }
  }

  await renderDrawer(original)
  await waitForLoadedForm()
  await changeInput(getControlByLabel<HTMLInputElement>('Quota (USD)'), '2')
  await submitForm()
  await act(async () =>
    waitForCondition(() => updates.length === 1, 'update was not submitted')
  )

  assert.equal(updates[0]?.quota, 1000000)
})

test('redemption drawer ignores an older response after switching records', async () => {
  const first = redemption(1, 500001)
  const second = redemption(2, 1000001)
  const firstRequest = deferred<{ data: unknown }>()
  const secondRequest = deferred<{ data: unknown }>()
  const requestedUrls: string[] = []
  const updates: Array<Record<string, unknown>> = []
  apiClient.get = (url) => {
    requestedUrls.push(url)
    if (url === '/api/redemption/1') return firstRequest.promise
    if (url === '/api/redemption/2') return secondRequest.promise
    throw new Error(`Unexpected GET ${url}`)
  }
  apiClient.put = async (_url, data) => {
    assert.ok(data && typeof data === 'object')
    updates.push(data as Record<string, unknown>)
    return { data: { success: true, data: second } }
  }

  await renderDrawer(first)
  await rerenderDrawer(second)
  await act(async () =>
    waitForCondition(
      () => requestedUrls.includes('/api/redemption/2'),
      'second redemption was not requested'
    )
  )
  await act(async () =>
    secondRequest.resolve({ data: { success: true, data: second } })
  )
  await waitForLoadedForm()

  await act(async () =>
    firstRequest.resolve({ data: { success: true, data: first } })
  )
  assert.equal(getControlByLabel<HTMLInputElement>('Name').value, 'code-2')

  await changeInput(getControlByLabel<HTMLInputElement>('Name'), 'second')
  await submitForm()
  await act(async () =>
    waitForCondition(() => updates.length === 1, 'update was not submitted')
  )

  assert.equal(updates[0]?.id, 2)
  assert.equal(updates[0]?.quota, 1000001)
})
