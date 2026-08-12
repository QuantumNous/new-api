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
  'HTMLButtonElement',
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
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { ApiKeyGroupCell } = await import('../api-key-group-cell')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Auto: 'Auto',
        'Cross-group': 'Cross-group',
        Ratio: 'Ratio',
        'Automatically selects the best available group with circuit breaker mechanism':
          'Automatically selects the best available group with circuit breaker mechanism',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

function CellHarness(props: {
  group: string
  ratio?: number | string
  crossGroupRetry?: boolean
  shouldReduceMotion?: boolean
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <ApiKeyGroupCell
          group={props.group}
          ratio={props.ratio}
          crossGroupRetry={props.crossGroupRetry ?? false}
          shouldReduceMotion={props.shouldReduceMotion ?? false}
        />
      </TooltipProvider>
    </I18nextProvider>
  )
}

describe('API key group table cell', () => {
  after(() => {
    domWindow.close()
  })

  test('renders two unclipped rings and a localized Auto ratio when API data uses a nonlocalized string', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () =>
      root.render(
        <CellHarness
          group='auto'
          ratio='自动'
          crossGroupRetry
          shouldReduceMotion={false}
        />
      )
    )

    const badgeCell = container.querySelector<HTMLElement>(
      '[data-api-key-group-cell="auto"]'
    )
    assert.ok(badgeCell)
    assert.equal(badgeCell.classList.contains('overflow-visible'), true)
    assert.equal(badgeCell.classList.contains('overflow-hidden'), false)

    const frames = container.querySelectorAll('[data-auto-group-frame]')
    const movingRings = container.querySelectorAll(
      '[data-auto-group-flow-border]'
    )
    assert.equal(frames.length, 2)
    assert.equal(movingRings.length, 2)
    for (const frame of frames) {
      assert.equal(frame.classList.contains('relative'), true)
      assert.equal(frame.classList.contains('overflow-visible'), true)
      assert.equal(frame.classList.contains('rounded-4xl'), true)
      assert.equal(frame.classList.contains('p-px'), true)
    }

    const ratio = container.querySelector<HTMLElement>(
      '[data-auto-group-effect="ratio"]'
    )
    assert.ok(ratio)
    assert.equal(ratio.textContent, 'Auto Ratio')
    assert.equal(ratio.textContent?.includes('x'), false)
    assert.equal(container.textContent?.includes('自动'), false)
    assert.equal(container.textContent?.includes('Cross-group'), true)

    const crossGroupBadge = [
      ...container.querySelectorAll<HTMLElement>('[data-slot="status-badge"]'),
    ].find((badge) => badge.textContent === 'Cross-group')
    assert.ok(crossGroupBadge)
    assert.equal(crossGroupBadge.closest('[data-auto-group-frame]'), null)

    await act(async () => root.unmount())
    container.remove()
  })

  test('keeps static Auto frames but omits both moving layers for reduced motion', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () =>
      root.render(<CellHarness group='auto' ratio='Auto' shouldReduceMotion />)
    )

    assert.equal(
      container.querySelectorAll('[data-auto-group-frame]').length,
      2
    )
    assert.equal(
      container.querySelectorAll('[data-auto-group-flow-border]').length,
      0
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('shows only the Auto badge when ratio data is unavailable', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () =>
      root.render(<CellHarness group='auto' shouldReduceMotion={false} />)
    )

    assert.equal(
      container.querySelectorAll('[data-auto-group-frame]').length,
      1
    )
    assert.equal(
      container.querySelectorAll('[data-auto-group-flow-border]').length,
      1
    )
    assert.equal(
      container.querySelector('[data-auto-group-effect="ratio"]'),
      null
    )
    assert.equal(container.textContent?.includes('Auto'), true)
    assert.equal(container.textContent?.includes('Ratio'), false)

    await act(async () => root.unmount())
    container.remove()
  })

  test('narrows normal group ratios to numbers and never applies Auto rings', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () =>
      root.render(
        <CellHarness group='vip' ratio='自动' shouldReduceMotion={false} />
      )
    )

    assert.equal(container.textContent?.includes('vip'), true)
    assert.equal(container.textContent?.includes('自动'), false)
    assert.equal(container.querySelector('[data-auto-group-frame]'), null)
    assert.equal(container.querySelector('[data-auto-group-flow-border]'), null)

    await act(async () =>
      root.render(
        <CellHarness group='vip' ratio={3} shouldReduceMotion={false} />
      )
    )

    assert.equal(container.textContent?.includes('3x'), true)
    assert.equal(container.querySelector('[data-auto-group-frame]'), null)

    await act(async () => root.unmount())
    container.remove()
  })
})
