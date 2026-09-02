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

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; className?: string; to: string }) => (
    <a className={props.className} href={props.to}>
      {props.children}
    </a>
  ),
}))

describe('easy dashboard overview', () => {
  it('keeps the inline connection flow in focus without developer request details', () => {
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

    expect(screen.getByTestId('easy-overview')).toBeInTheDocument()
    expect(screen.getByTestId('connect-panel')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Choose a model' })
    ).toBeVisible()
    expect(screen.queryByText('First API request')).not.toBeInTheDocument()
    expect(screen.queryByText(/curl http/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Route active')).not.toBeInTheDocument()
  })

  it('shows the savings receipt beside the inline connection flow before first use', () => {
    render(
      <EasyOverviewDashboardView
        remainQuota={10_000_000}
        usedQuota={0}
        connectPanel={<div data-testid='connect-panel' />}
        savings={{
          officialCost: 0,
          siteCost: 0,
          savings: 0,
          comparableRequests: 0,
        }}
      />
    )

    expect(screen.getByTestId('connect-panel')).toBeVisible()
    expect(screen.getByTestId('easy-savings-receipt')).toBeVisible()
    expect(screen.getByText('Estimated savings')).toBeVisible()
    expect(screen.getAllByText('¥0').length).toBeGreaterThan(0)
  })
})
