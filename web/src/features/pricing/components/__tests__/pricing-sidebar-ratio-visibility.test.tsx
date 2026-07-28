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

import type { PricingModel } from '../../types'

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
  'customElements',
  'localStorage',
  'sessionStorage',
  'matchMedia',
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
const { GroupPricingSection } = await import('../model-details')
const { PricingSidebar } = await import('../pricing-sidebar')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {},
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const defaultProps: React.ComponentProps<typeof PricingSidebar> = {
  quotaTypeFilter: 'all',
  endpointTypeFilter: 'all',
  vendorFilter: 'all',
  groupFilter: 'all',
  tagFilter: 'all',
  onQuotaTypeChange: () => undefined,
  onEndpointTypeChange: () => undefined,
  onVendorChange: () => undefined,
  onGroupChange: () => undefined,
  onTagChange: () => undefined,
  vendors: [],
  groups: ['default'],
  groupRatios: { default: 2 },
  tags: [],
  models: [],
  hasActiveFilters: false,
  onClearFilters: () => undefined,
}

async function renderSidebar(showRatio: boolean) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <PricingSidebar {...defaultProps} showRatio={showRatio} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

const defaultModel: PricingModel = {
  id: 1,
  model_name: 'test-model',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 1,
  enable_groups: ['default'],
}

async function renderGroupPricing(model: PricingModel, showRatio: boolean) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <GroupPricingSection
          model={model}
          groupRatio={{ default: 2 }}
          usableGroup={{ default: { desc: 'Default group', ratio: 2 } }}
          autoGroups={[]}
          priceRate={1}
          usdExchangeRate={1}
          tokenUnit='M'
          showRatio={showRatio}
        />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function removeRendered(rendered: {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('model square group ratio visibility', () => {
  after(() => {
    domWindow.close()
  })

  test('hides group ratios from regular users', async () => {
    const rendered = await renderSidebar(false)

    assert.equal(rendered.container.textContent?.includes('x2'), false)

    await removeRendered(rendered)
  })

  test('shows group ratios to administrators', async () => {
    const rendered = await renderSidebar(true)

    assert.equal(rendered.container.textContent?.includes('x2'), true)

    await removeRendered(rendered)
  })

  test('hides static and dynamic detail ratios from regular users', async () => {
    const staticPricing = await renderGroupPricing(defaultModel, false)

    assert.equal(staticPricing.container.textContent?.includes('Ratio'), false)
    assert.equal(staticPricing.container.textContent?.includes('2x'), false)

    await removeRendered(staticPricing)

    const dynamicPricing = await renderGroupPricing(
      {
        ...defaultModel,
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("base", p * 2 + c * 8)',
      },
      false
    )

    assert.equal(dynamicPricing.container.textContent?.includes('2x'), false)

    await removeRendered(dynamicPricing)
  })

  test('shows static and dynamic detail ratios to administrators', async () => {
    const staticPricing = await renderGroupPricing(defaultModel, true)

    assert.equal(staticPricing.container.textContent?.includes('Ratio'), true)
    assert.equal(staticPricing.container.textContent?.includes('2x'), true)

    await removeRendered(staticPricing)

    const dynamicPricing = await renderGroupPricing(
      {
        ...defaultModel,
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("base", p * 2 + c * 8)',
      },
      true
    )

    assert.equal(dynamicPricing.container.textContent?.includes('2x'), true)

    await removeRendered(dynamicPricing)
  })
})
