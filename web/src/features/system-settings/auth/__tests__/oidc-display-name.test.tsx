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

import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { Window } from 'happy-dom'
import type { ReactNode } from 'react'

import type { AuthSettings } from '../../types'

const domWindow = new Window({ url: 'https://app.example.test/' })
const domGlobals = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'HTMLLabelElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'SubmitEvent',
  'CustomEvent',
  'MouseEvent',
  'PointerEvent',
  'KeyboardEvent',
  'FocusEvent',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} = await import('@tanstack/react-router')
const i18next = (await import('i18next')).default
const { I18nextProvider, initReactI18next } = await import('react-i18next')

await i18next.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'OIDC Display Name': 'OIDC Display Name',
        'e.g. Company SSO': 'e.g. Company SSO',
        'Defaults to "OIDC" if left blank': 'Defaults to "OIDC" if left blank',
      },
    },
  },
})

const { api } = await import('@/lib/api')
const { getAuthSectionContent } = await import('../section-registry')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const authSettings: AuthSettings = {
  PasswordLoginEnabled: true,
  PasswordRegisterEnabled: true,
  EmailVerificationEnabled: false,
  RegisterEnabled: true,
  EmailDomainRestrictionEnabled: false,
  EmailAliasRestrictionEnabled: false,
  EmailDomainWhitelist: '',
  ServerAddress: 'https://app.example.test',
  GitHubOAuthEnabled: false,
  GitHubClientId: '',
  GitHubClientSecret: '',
  'discord.enabled': false,
  'discord.client_id': '',
  'discord.client_secret': '',
  'oidc.enabled': true,
  'oidc.display_name': '',
  'oidc.client_id': 'oidc-client',
  'oidc.client_secret': 'oidc-secret',
  'oidc.well_known': '',
  'oidc.authorization_endpoint': 'https://id.example.test/authorize',
  'oidc.token_endpoint': 'https://id.example.test/token',
  'oidc.user_info_endpoint': 'https://id.example.test/userinfo',
  TelegramOAuthEnabled: false,
  TelegramBotToken: '',
  TelegramBotName: '',
  LinuxDOOAuthEnabled: false,
  LinuxDOClientId: '',
  LinuxDOClientSecret: '',
  LinuxDOMinimumTrustLevel: '0',
  WeChatAuthEnabled: false,
  WeChatServerAddress: '',
  WeChatServerToken: '',
  WeChatAccountQRCodeImageURL: '',
  TurnstileCheckEnabled: false,
  TurnstileSiteKey: '',
  TurnstileSecretKey: '',
  'passkey.enabled': false,
  'passkey.rp_display_name': '',
  'passkey.rp_id': '',
  'passkey.origins': '',
  'passkey.allow_insecure_origin': false,
  'passkey.user_verification': 'preferred',
  'passkey.attachment_preference': '',
}

async function renderWithProviders(ui: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await act(async () => {
    root.render(
      <RouterContextProvider router={router}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18next}>{ui}</I18nextProvider>
        </QueryClientProvider>
      </RouterContextProvider>
    )
  })

  return { container, root, queryClient }
}

async function unmountSettings(
  rendered: Awaited<ReturnType<typeof renderWithProviders>>
) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
  rendered.queryClient.clear()
}

async function showOIDCSettings(container: HTMLElement) {
  const oidcTab = [
    ...container.querySelectorAll<HTMLButtonElement>('button'),
  ].find((button) => button.textContent?.trim() === 'OIDC')
  assert.ok(oidcTab)

  await act(async () => oidcTab.click())
}

function getDisplayNameInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>(
    'input[name="oidc.display_name"]'
  )
  assert.ok(input)
  return input
}

function changeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    domWindow.HTMLInputElement.prototype,
    'value'
  )?.set
  assert.ok(valueSetter)
  valueSetter.call(input, value)
  input.dispatchEvent(
    new domWindow.Event('input', { bubbles: true }) as unknown as Event
  )
}

describe('OIDC display-name settings', () => {
  after(() => {
    domWindow.close()
  })

  test('associates the display-name input with its label and help text', async () => {
    const rendered = await renderWithProviders(
      getAuthSectionContent('oauth', authSettings)
    )
    await showOIDCSettings(rendered.container)

    const input = getDisplayNameInput(rendered.container)
    const label = [...rendered.container.querySelectorAll('label')].find(
      (candidate) => candidate.textContent?.trim() === 'OIDC Display Name'
    )
    assert.ok(label)
    assert.equal(label.htmlFor, input.id)

    const descriptionIds =
      input.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    const description = descriptionIds
      .map((id) =>
        rendered.container.querySelector<HTMLElement>(`[id="${id}"]`)
      )
      .find((element) => element?.textContent?.trim())
    assert.equal(
      description?.textContent?.trim(),
      'Defaults to "OIDC" if left blank'
    )

    await unmountSettings(rendered)
  })

  test(
    'serializes an edited display name through the oidc.display_name option',
    { timeout: 5000 },
    async () => {
      const rendered = await renderWithProviders(
        getAuthSectionContent('oauth', authSettings)
      )
      await showOIDCSettings(rendered.container)

      const requests: InternalAxiosRequestConfig[] = []
      const originalAdapter = api.defaults.adapter
      let resolveRequest: (config: InternalAxiosRequestConfig) => void = () =>
        undefined
      const requestSeen = new Promise<InternalAxiosRequestConfig>((resolve) => {
        resolveRequest = resolve
      })
      const adapter: AxiosAdapter = async (config) => {
        requests.push(config)
        resolveRequest(config)
        return {
          data: { success: true, message: '' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }
      }
      api.defaults.adapter = adapter

      rendered.queryClient.setQueryData(['status'], { system_name: 'Test' })
      const statusQuery = rendered.queryClient
        .getQueryCache()
        .find({ queryKey: ['status'] })
      assert.ok(statusQuery)
      let stopWatchingStatus: () => void = () => undefined
      const statusInvalidated = new Promise<void>((resolve) => {
        stopWatchingStatus = rendered.queryClient
          .getQueryCache()
          .subscribe(() => {
            if (statusQuery.state.isInvalidated) {
              stopWatchingStatus()
              resolve()
            }
          })
      })

      try {
        const input = getDisplayNameInput(rendered.container)
        await act(async () => {
          changeInputValue(input, 'Company SSO')
        })

        const form = rendered.container.querySelector('form')
        assert.ok(form)
        window.localStorage.setItem('status', '{"system_name":"Test"}')

        await act(async () => {
          form.dispatchEvent(
            new domWindow.SubmitEvent('submit', {
              bubbles: true,
              cancelable: true,
            }) as unknown as SubmitEvent
          )
          await Promise.all([requestSeen, statusInvalidated])
        })

        assert.equal(requests.length, 1)
        assert.equal(requests[0].method, 'put')
        assert.equal(requests[0].url, '/api/option/')
        const body =
          typeof requests[0].data === 'string'
            ? JSON.parse(requests[0].data)
            : requests[0].data
        assert.deepEqual(body, {
          key: 'oidc.display_name',
          value: 'Company SSO',
        })
        assert.equal(window.localStorage.getItem('status'), null)
      } finally {
        stopWatchingStatus()
        api.defaults.adapter = originalAdapter
        await unmountSettings(rendered)
      }
    }
  )
})
