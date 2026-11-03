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
import { afterAll, describe, test } from 'bun:test'
import assert from 'node:assert/strict'

import type React from 'react'

import { resetSharedDomWindow } from '@/test-utils/happy-dom-env'

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
        'Subscription + Wallet': 'Subscription + Wallet',
        'Deducted by subscription': 'Deducted by subscription',
        'Wallet overflow charge': 'Wallet overflow charge',
        'Includes tool-call surcharge': 'Includes tool-call surcharge',
        'Charged for empty response': 'Charged for empty response',
        'Empty reply': 'Empty reply',
      },
    },
  },
})

const { LogCostDisplay } = await import('../log-cost-display')
const { formatLogQuota } = await import('@/lib/format')
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
  afterAll(async () => {
    await resetSharedDomWindow()
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

  test('preserves the subscription quota badge and adds the same legacy surcharge marker', async () => {
    const rendered = await renderCost({
      quota: 5000,
      other: {
        billing_source: 'subscription',
        web_search: true,
        web_search_call_count: 1,
        web_search_price: 10,
      },
    })

    const badge = rendered.container.querySelector('span[role="img"]')
    assert.ok(badge)
    assert.equal(badge.getAttribute('aria-label')?.startsWith('Subscription'), true)
    assert.ok(badge.className.includes('border-green-500'))
    assert.ok(
      rendered.container.querySelector('[data-tool-surcharge-indicator="true"]')
    )

    await unmountCost(rendered)
  })

  test('adds an accessible empty-response marker when the charge is scaled', async () => {
    const rendered = await renderCost({
      quota: 1250,
      other: {
        empty_response_multiplier: 0.1,
        empty_response_waived: true,
      },
    })

    assert.equal(
      normalizedText(rendered.container.textContent).includes(
        normalizedText(formatLogQuota(1250))
      ),
      true
    )
    const marker = rendered.container.querySelector(
      '[data-empty-response-indicator="true"]'
    )
    assert.ok(marker)
    assert.equal(
      marker.getAttribute('aria-label'),
      'Empty reply — Charged for empty response'
    )
    assert.equal(marker.getAttribute('tabindex'), '0')
    assert.equal(
      normalizedText(rendered.container.textContent).includes(
        normalizedText('Empty reply')
      ),
      true
    )

    await unmountCost(rendered)
  })

  test('shows red-bordered quota badge when subscription has wallet overflow', async () => {
    const rendered = await renderCost({
      quota: 20000,
      other: {
        billing_source: 'subscription',
        wallet_quota_deducted: 5000,
      },
    })

    const badge = rendered.container.querySelector('span[role="img"]')
    assert.ok(badge)
    assert.equal(badge.getAttribute('aria-label')?.startsWith('Subscription + Wallet'), true)
    assert.ok(badge.className.includes('border-red-500'))
    assert.equal(
      normalizedText(rendered.container.textContent).includes(
        normalizedText(formatLogQuota(20000))
      ),
      true
    )

    await unmountCost(rendered)
  })
})
