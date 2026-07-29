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

import type { SystemStatus } from '../../types'

const domWindow = new Window({ url: 'https://app.example.test/' })
const domGlobals = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
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
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
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
        'Continue with {{name}}': 'Continue with {{name}}',
        'Continue with GitHub': 'Continue with GitHub',
        'Or continue with': 'Or continue with',
      },
    },
  },
})

const { OAuthProviders } = await import('../oauth-providers')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function renderOAuthProviders(status: SystemStatus) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await act(async () => {
    root.render(
      <RouterContextProvider router={router}>
        <I18nextProvider i18n={i18next}>
          <OAuthProviders status={status} />
        </I18nextProvider>
      </RouterContextProvider>
    )
  })

  return { container, root }
}

async function unmountOAuthProviders(
  rendered: Awaited<ReturnType<typeof renderOAuthProviders>>
) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

function findButton(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label
  )
}

describe('OIDC provider display name', () => {
  after(() => {
    domWindow.close()
  })

  test('renders the configured provider name on the login button', async () => {
    const rendered = await renderOAuthProviders({
      oidc_enabled: true,
      oidc_display_name: 'Acme SSO',
    })

    assert.ok(findButton(rendered.container, 'Continue with Acme SSO'))

    await unmountOAuthProviders(rendered)
  })

  test('renders OIDC when the provider name is blank', async () => {
    const rendered = await renderOAuthProviders({
      oidc_enabled: true,
      oidc_display_name: '   ',
    })

    assert.ok(findButton(rendered.container, 'Continue with OIDC'))

    await unmountOAuthProviders(rendered)
  })
})
