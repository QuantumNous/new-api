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

import { EasyOverviewDashboardView } from '@/features/dashboard/components/overview/easy-overview-dashboard'
import { PriceSavings } from '@/features/home/components/sections/price-savings'
import { getLogCostComparison } from '@/features/usage-logs/lib/cost-comparison'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; className?: string; to: string }) => (
    <a className={props.className} href={props.to}>
      {props.children}
    </a>
  ),
}))

describe('missing pricing and usage data', () => {
  it('keeps the savings calculator section visible while live prices recover', () => {
    render(<PriceSavings models={[]} calculatorModels={[]} />)

    expect(screen.getByTestId('savings-unavailable')).toBeVisible()
    expect(screen.getAllByText('Plan your yearly savings')).toHaveLength(2)
    expect(screen.queryByTestId('annual-savings')).not.toBeInTheDocument()
  })

  it('keeps a useful next action without inventing savings', () => {
    render(
      <EasyOverviewDashboardView
        remainQuota={0}
        usedQuota={0}
        connectPanel={
          <section data-testid='connect-panel'>
            <h2>Choose a model</h2>
          </section>
        }
        savings={{
          officialCost: 0,
          siteCost: 0,
          savings: 0,
          comparableRequests: 0,
        }}
      />
    )

    expect(screen.getByTestId('connect-panel')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Choose a model' })
    ).toBeVisible()
    expect(
      screen.getByText(
        'After your first comparable request, savings will appear here automatically.'
      )
    ).toBeVisible()
    expect(screen.queryByText(/saved \d+%/i)).not.toBeInTheDocument()
  })

  it('does not manufacture a comparison when logged rates are incomplete', () => {
    expect(
      getLogCostComparison(50_000, null, {
        priceRate: 1,
        usdExchangeRate: 7.2,
        quotaPerUnit: 500_000,
      })
    ).toBeNull()
    expect(
      getLogCostComparison(
        50_000,
        { group_ratio: 0 },
        {
          priceRate: 1,
          usdExchangeRate: 7.2,
          quotaPerUnit: 500_000,
        }
      )
    ).toBeNull()
  })

  it('derives developer savings only from recorded charge and group rates', () => {
    expect(
      getLogCostComparison(
        900_000,
        { group_ratio: 0.5, user_group_ratio: 0.4, fee_quota: 200_000 },
        { priceRate: 1, usdExchangeRate: 7.2, quotaPerUnit: 500_000 }
      )
    ).toEqual({
      officialCost: 7.2,
      siteCost: 0.4,
      savings: 6.8,
    })
  })
})
