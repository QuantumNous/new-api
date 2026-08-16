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
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

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
  test('renders two unclipped rings and a localized Auto ratio when API data uses a nonlocalized string', () => {
    const { container } = render(
      <CellHarness
        group='auto'
        ratio='自动'
        crossGroupRetry
        shouldReduceMotion={false}
      />
    )

    const badgeCell = container.querySelector<HTMLElement>(
      '[data-api-key-group-cell="auto"]'
    )
    expect(badgeCell).toHaveClass('overflow-visible')
    expect(badgeCell).not.toHaveClass('overflow-hidden')

    const frames = container.querySelectorAll('[data-auto-group-frame]')
    const movingRings = container.querySelectorAll(
      '[data-auto-group-flow-border]'
    )
    expect(frames.length).toBe(2)
    expect(movingRings.length).toBe(2)
    for (const frame of frames) {
      expect(frame).toHaveClass(
        'relative',
        'overflow-visible',
        'rounded-4xl',
        'p-px'
      )
    }

    const ratio = container.querySelector<HTMLElement>(
      '[data-auto-group-effect="ratio"]'
    )
    expect(ratio).toHaveTextContent('Auto Ratio')
    expect(ratio).not.toHaveTextContent('x')
    expect(container).not.toHaveTextContent('自动')
    expect(container).toHaveTextContent('Cross-group')

    const crossGroupBadge = [
      ...container.querySelectorAll<HTMLElement>('[data-slot="status-badge"]'),
    ].find((badge) => badge.textContent === 'Cross-group')
    expect(crossGroupBadge).not.toBeUndefined()
    expect(crossGroupBadge?.closest('[data-auto-group-frame]')).toBeNull()
  })

  test('keeps static Auto frames but omits both moving layers for reduced motion', () => {
    const { container } = render(
      <CellHarness group='auto' ratio='Auto' shouldReduceMotion />
    )

    expect(container.querySelectorAll('[data-auto-group-frame]').length).toBe(2)
    expect(
      container.querySelectorAll('[data-auto-group-flow-border]').length
    ).toBe(0)
  })

  test('shows only the Auto badge when ratio data is unavailable', () => {
    const { container } = render(
      <CellHarness group='auto' shouldReduceMotion={false} />
    )

    expect(container.querySelectorAll('[data-auto-group-frame]').length).toBe(1)
    expect(
      container.querySelectorAll('[data-auto-group-flow-border]').length
    ).toBe(1)
    expect(container.querySelector('[data-auto-group-effect="ratio"]')).toBe(
      null
    )
    expect(container).toHaveTextContent('Auto')
    expect(container).not.toHaveTextContent('Ratio')
  })

  test('narrows normal group ratios to numbers and never applies Auto rings', () => {
    const { container, rerender } = render(
      <CellHarness group='vip' ratio='自动' shouldReduceMotion={false} />
    )

    expect(container).toHaveTextContent('vip')
    expect(container).not.toHaveTextContent('自动')
    expect(container.querySelector('[data-auto-group-frame]')).toBe(null)
    expect(container.querySelector('[data-auto-group-flow-border]')).toBe(null)

    rerender(<CellHarness group='vip' ratio={3} shouldReduceMotion={false} />)

    expect(container).toHaveTextContent('3x')
    expect(container.querySelector('[data-auto-group-frame]')).toBe(null)
  })
})
