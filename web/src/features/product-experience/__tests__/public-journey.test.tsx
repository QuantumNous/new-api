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
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Home } from '@/features/home'

vi.mock('@/components/layout', () => ({
  PublicLayout: (props: { children: ReactNode }) => props.children,
}))

vi.mock('@/components/layout/components/footer', () => ({
  Footer: () => null,
}))

vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('@/features/home/hooks', () => ({
  useHomePageContent: () => ({ content: '', isLoaded: true, isUrl: false }),
}))

vi.mock('@/features/pricing/hooks', () => ({
  usePricingData: () => ({ models: [], priceRate: 1, usdExchangeRate: 1 }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { user: null } }),
}))

function JourneyStage(props: { name: string }) {
  return (
    <section data-journey-stage={props.name}>
      <a href={`#${props.name}`} data-primary-action>
        {props.name}
      </a>
    </section>
  )
}

vi.mock('@/features/home/components', () => ({
  Hero: () => <JourneyStage name='value' />,
  CinematicPromise: () => null,
  PriceSavings: () => <JourneyStage name='price' />,
  Stats: () => null,
  HowItWorks: () => <JourneyStage name='setup' />,
  Features: () => null,
  FAQ: () => <JourneyStage name='support' />,
  CTA: () => null,
}))

describe('public product journey', () => {
  it('orders value, price, setup, and support with one primary action each', () => {
    const { container } = render(<Home />)
    const stages = [
      ...container.querySelectorAll<HTMLElement>('[data-journey-stage]'),
    ]

    expect(stages.map((stage) => stage.dataset.journeyStage)).toEqual([
      'value',
      'price',
      'setup',
      'support',
    ])
    for (const stage of stages) {
      expect(stage.querySelectorAll('[data-primary-action]')).toHaveLength(1)
    }
    expect(screen.getByRole('link', { name: 'price' })).toBeVisible()
  })
})
