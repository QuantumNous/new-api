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
Object.defineProperty(domWindow, 'PointerEvent', {
  configurable: true,
  value: domWindow.MouseEvent,
})
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
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
const { defaultScheduler, notifyManager, QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { api } = await import('@/lib/api')
const { ROLE } = await import('@/lib/roles')
const { useAuthStore } = await import('@/stores/auth-store')
const { ModelsAvailabilitySwitches } =
  await import('../models-availability-switches')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true
notifyManager.setScheduler((callback) => callback())

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}
type MockableApi = {
  get: ApiMethod
  put: ApiMethod
}
type RenderedSwitches = {
  host: HTMLDivElement
  queryClient: InstanceType<typeof QueryClient>
  root: ReturnType<typeof createRoot>
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPut = apiClient.put
let renderedSwitches: RenderedSwitches | null = null

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  assert.ok(resolvePromise)
  return { promise, resolve: resolvePromise }
}

async function renderSwitches(
  role: number,
  initialOptions?: unknown
): Promise<void> {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'test-admin',
    role,
  })

  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  if (initialOptions !== undefined) {
    queryClient.setQueryData(['system-options'], initialOptions, {
      updatedAt: Date.now() + 60_000,
    })
  }
  renderedSwitches = { host, queryClient, root }

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ModelsAvailabilitySwitches />
        </I18nextProvider>
      </QueryClientProvider>
    )
    await Promise.resolve()
  })
}

function findButton(text: string): HTMLButtonElement {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((candidate) => candidate.textContent?.trim() === text)
  assert.ok(button, `Expected button "${text}"`)
  return button
}

afterEach(async () => {
  apiClient.get = originalGet
  apiClient.put = originalPut
  if (renderedSwitches) {
    await act(async () => renderedSwitches?.root.unmount())
    renderedSwitches.queryClient.clear()
    renderedSwitches.host.remove()
    renderedSwitches = null
  }
  useAuthStore.getState().auth.reset()
  document.body.replaceChildren()
})

after(() => {
  notifyManager.setScheduler(defaultScheduler)
  domWindow.close()
})

describe('model availability switches', () => {
  test('does not query or render root-only settings for an ordinary admin', async () => {
    let getCalls = 0
    apiClient.get = async () => {
      getCalls++
      throw new Error('ordinary admins must not request system options')
    }

    await renderSwitches(ROLE.ADMIN)

    assert.equal(getCalls, 0)
    assert.equal(document.querySelector('[role="switch"]'), null)
    assert.equal(document.body.textContent, '')
  })

  test('keeps controls unavailable after a business load failure and retries explicitly', async () => {
    let getCalls = 0
    const retryRequest = createDeferred<{ data: unknown }>()
    apiClient.get = (url) => {
      assert.equal(url, '/api/option/')
      getCalls++
      return retryRequest.promise
    }

    await renderSwitches(ROLE.SUPER_ADMIN, {
      success: false,
      message: 'load failed',
    })

    assert.equal(getCalls, 0)
    assert.equal(document.querySelector('[role="switch"]'), null)
    assert.equal(document.body.textContent?.includes('Failed to load'), true)
    assert.ok(findButton('Retry').closest('[role="alert"]'))

    await act(async () => {
      findButton('Retry').click()
      assert.ok(renderedSwitches)
      const refetch = renderedSwitches.queryClient.refetchQueries(
        { queryKey: ['system-options'] },
        { cancelRefetch: false }
      )
      retryRequest.resolve({
        data: {
          success: true,
          message: '',
          data: [
            { key: 'AutomaticDisableModelEnabled', value: 'false' },
            { key: 'AutomaticEnableModelEnabled', value: 'false' },
          ],
        },
      })
      await refetch
    })
    assert.equal(getCalls, 1)

    const control = document.querySelector<HTMLInputElement>(
      '#auto-disable-models'
    )
    assert.ok(control)
    assert.equal(control.disabled, false)
    assert.equal(document.querySelector('[role="alert"]'), null)
  })

  test('requires destructive confirmation before enabling automatic disable', async () => {
    const putPayloads: Array<Record<string, unknown>> = []
    const refetchRequest = createDeferred<{ data: unknown }>()
    const putRequest = createDeferred<{ data: unknown }>()
    apiClient.get = (url) => {
      assert.equal(url, '/api/option/')
      return refetchRequest.promise
    }
    apiClient.put = (url, data) => {
      assert.equal(url, '/api/option/')
      assert.ok(data && typeof data === 'object')
      putPayloads.push(data as Record<string, unknown>)
      return putRequest.promise
    }

    await renderSwitches(ROLE.SUPER_ADMIN, {
      success: true,
      message: '',
      data: [
        { key: 'AutomaticDisableModelEnabled', value: 'false' },
        { key: 'AutomaticEnableModelEnabled', value: 'false' },
      ],
    })
    assert.ok(renderedSwitches)
    renderedSwitches.queryClient.setQueryData(['models'], { cached: true })

    const disableInput = document.querySelector<HTMLInputElement>(
      '#auto-disable-models'
    )
    assert.ok(disableInput)
    const disableLabel = document.querySelector<HTMLLabelElement>(
      'label[for="auto-disable-models"]'
    )
    assert.ok(disableLabel)
    assert.equal(disableLabel.classList.contains('min-w-0'), true)
    assert.equal(disableLabel.classList.contains('flex-1'), true)
    const disableSwitch = disableInput.previousElementSibling
    assert.ok(disableSwitch instanceof HTMLElement)
    assert.equal(disableSwitch.getAttribute('role'), 'switch')
    assert.equal(disableSwitch.classList.contains('shrink-0'), true)
    await act(async () => {
      disableInput.click()
    })

    const confirmationCopy =
      'Enabling this setting immediately disables all currently enabled models with no available channels. Turning it off later will not automatically re-enable those models. Continue?'
    assert.equal(document.body.textContent?.includes(confirmationCopy), true)
    assert.equal(putPayloads.length, 0)

    await act(async () => {
      findButton('Enable').click()
      await Promise.resolve()
    })
    assert.equal(putPayloads.length, 1)
    await act(async () => {
      putRequest.resolve({ data: { success: true, message: '' } })
      await putRequest.promise
    })

    assert.deepEqual(putPayloads, [
      { key: 'AutomaticDisableModelEnabled', value: true },
    ])
    assert.equal(
      renderedSwitches.queryClient.getQueryState(['models'])?.isInvalidated,
      true
    )
    const enableInput = document.querySelector<HTMLInputElement>(
      '#auto-enable-models'
    )
    const enableLabel = document.querySelector<HTMLLabelElement>(
      'label[for="auto-enable-models"]'
    )
    assert.ok(enableInput)
    assert.ok(enableLabel)
    assert.equal(enableLabel.classList.contains('min-w-0'), true)
    assert.equal(enableLabel.classList.contains('flex-1'), true)
    const enableSwitch = enableInput.previousElementSibling
    assert.ok(enableSwitch instanceof HTMLElement)
    assert.equal(enableSwitch.getAttribute('role'), 'switch')
    assert.equal(enableSwitch.classList.contains('shrink-0'), true)
    assert.equal(document.body.textContent?.includes(confirmationCopy), false)
  })
})
