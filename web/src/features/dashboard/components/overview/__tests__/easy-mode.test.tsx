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

import { EasyOverviewDashboardView } from '../easy-overview-dashboard'
import { getEasySetupStage } from '../easy-overview-state'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; className?: string; to: string }) => (
    <a className={props.className} href={props.to}>
      {props.children}
    </a>
  ),
}))

describe('easy dashboard setup stage', () => {
  it.each([
    {
      input: { remainQuota: 0, hasApiKey: false, requestCount: 0 },
      expected: 'wallet',
    },
    {
      input: { remainQuota: 1, hasApiKey: false, requestCount: 0 },
      expected: 'key',
    },
    {
      input: { remainQuota: 1, hasApiKey: true, requestCount: 0 },
      expected: 'guide',
    },
    {
      input: { remainQuota: 1, hasApiKey: true, requestCount: 1 },
      expected: 'complete',
    },
  ])(
    'selects $expected as the next meaningful action',
    ({ input, expected }) => {
      expect(getEasySetupStage(input)).toBe(expected)
    }
  )
})

describe('easy dashboard overview', () => {
  it('shows one plain-language next step without developer request details', () => {
    render(
      <EasyOverviewDashboardView
        remainQuota={0}
        usedQuota={0}
        requestCount={0}
        hasApiKey={false}
        savings={{
          officialCost: 0,
          siteCost: 0,
          savings: 0,
          comparableRequests: 0,
        }}
      />
    )

    expect(screen.getByTestId('easy-overview')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add credits' })).toBeVisible()
    expect(
      screen
        .getAllByRole('link', { name: /Top up/i })
        .some((link) => link.getAttribute('href') === '/wallet')
    ).toBe(true)
    expect(screen.queryByText('First API request')).not.toBeInTheDocument()
    expect(screen.queryByText(/curl http/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Route active')).not.toBeInTheDocument()
  })

  it('keeps manual setup available and shows the savings receipt before first use', () => {
    render(
      <EasyOverviewDashboardView
        remainQuota={10_000_000}
        usedQuota={0}
        requestCount={0}
        hasApiKey
        savings={{
          officialCost: 0,
          siteCost: 0,
          savings: 0,
          comparableRequests: 0,
        }}
      />
    )

    expect(
      screen.getByRole('link', { name: /Start manual setup/i })
    ).toHaveAttribute('href', '/guide')
    expect(screen.getByTestId('easy-savings-receipt')).toBeVisible()
    expect(screen.getByText('Estimated savings')).toBeVisible()
    expect(screen.getAllByText('¥0').length).toBeGreaterThan(0)
  })
})
