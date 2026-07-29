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

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Subscription: 'Subscription',
        'Deducted by subscription': 'Deducted by subscription',
        'Includes tool-call surcharge': 'Includes tool-call surcharge',
      },
    },
  },
})

const { LogCostDisplay } = await import('../log-cost-display')
const { formatLogQuota } = await import('@/lib/format')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedCost = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderCost(
  props: React.ComponentProps<typeof LogCostDisplay>
): Promise<RenderedCost> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <LogCostDisplay {...props} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCost(rendered: RenderedCost) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

function normalizedText(value: string | null): string {
  return (value ?? '').replaceAll(/\s/g, '')
}

describe('log cost display', () => {
  after(() => {
    domWindow.close()
  })

  test('keeps the regular cost visible and adds an accessible surcharge marker', async () => {
    const rendered = await renderCost({
      quota: 12500,
      other: {
        tool_surcharges: [{ name: 'lookup_customer', count: 1, price: 5 }],
      },
    })

    assert.equal(
      normalizedText(rendered.container.textContent).includes(
        normalizedText(formatLogQuota(12500))
      ),
      true
    )
    const marker = rendered.container.querySelector(
      '[data-tool-surcharge-indicator="true"]'
    )
    assert.ok(marker)
    assert.equal(
      marker.getAttribute('aria-label'),
      'Includes tool-call surcharge'
    )
    assert.equal(marker.getAttribute('tabindex'), '0')

    await unmountCost(rendered)
  })

  test('preserves the subscription badge and adds the same legacy surcharge marker', async () => {
    const rendered = await renderCost({
      quota: 5000,
      other: {
        billing_source: 'subscription',
        web_search: true,
        web_search_call_count: 1,
        web_search_price: 10,
      },
    })

    assert.equal(rendered.container.textContent?.includes('Subscription'), true)
    assert.ok(
      rendered.container.querySelector('[data-tool-surcharge-indicator="true"]')
    )

    await unmountCost(rendered)
  })
})
