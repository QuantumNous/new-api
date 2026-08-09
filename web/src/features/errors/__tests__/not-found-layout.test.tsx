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

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
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
const { NotFoundError } = await import('../not-found-error')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Oops! Page Not Found!': 'Page not found',
        'Quick Links': 'Quick links',
        'Back to Home': 'Back to home',
        Docs: 'Docs',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

describe('not found page', () => {
  after(() => {
    domWindow.close()
  })

  test('uses the landing-page layout for console route misses', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () =>
      root.render(
        <I18nextProvider i18n={i18n}>
          <NotFoundError />
        </I18nextProvider>
      )
    )

    const page = container.querySelector<HTMLElement>(
      '[data-landing-not-found]'
    )
    assert.ok(page)
    assert.equal(
      page.querySelector('h1')?.textContent,
      '404 NotFoundPage not found'
    )

    const links = [...page.querySelectorAll<HTMLAnchorElement>('nav a')]
    assert.deepEqual(
      links.map((link) => link.getAttribute('href')),
      ['/', '/docs/']
    )
    assert.deepEqual(
      links.map((link) => link.textContent?.trim()),
      ['Back to home', 'Docs']
    )

    await act(async () => root.unmount())
    container.remove()
  })
})
