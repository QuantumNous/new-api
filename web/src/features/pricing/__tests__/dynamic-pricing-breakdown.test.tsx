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
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'

import { DynamicPricingBreakdown } from '../components/dynamic-pricing-breakdown'

it.each([false, true])(
  'shows hour ranges as clock times without the hour label (compact=%s)',
  (compact) => {
    render(
      <DynamicPricingBreakdown
        compact={compact}
        billingExpr='hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 18 ? tier("高峰时段", p * 3.5 + cr * 0.15 + c * 9.5) : tier("空闲时段", p * 2 + cr * 0.1 + c * 5)'
        matchedTierLabel='空闲时段'
      />
    )

    const peak = screen.getByRole('row', { name: /高峰时段/ })
    const offPeak = screen.getByRole('row', { name: /空闲时段/ })
    expect(peak).toHaveTextContent('09:00 ~ 18:00 (Asia/Shanghai)')
    expect(within(peak).getByText('$3.5000')).toBeInTheDocument()
    expect(within(peak).getByText('$9.5000')).toBeInTheDocument()
    expect(within(peak).getByText('$0.1500')).toBeInTheDocument()
    expect(within(offPeak).getByText('$2.0000')).toBeInTheDocument()
    expect(within(offPeak).getByText('$5.0000')).toBeInTheDocument()
    expect(within(offPeak).getByText('$0.1000')).toBeInTheDocument()
    expect(within(offPeak).getByText('Matched')).toBeInTheDocument()
    // Both the mobile list and desktop table use the clock-time format.
    expect(screen.getAllByText('09:00 ~ 18:00 (Asia/Shanghai)')).toHaveLength(2)
    expect(screen.queryByText(/Hour/)).not.toBeInTheDocument()
  }
)

it('keeps overnight conditional multiplier hours in their original order', () => {
  render(
    <DynamicPricingBreakdown
      billingExpr='tier("base", p * 2 + c * 5)'
      requestRules={[
        {
          cond: 'hour("UTC") >= 21 || hour("UTC") < 6',
          multiplier: 0.5,
          matched: false,
        },
      ]}
    />
  )

  expect(screen.getByText('21:00 ~ 06:00 (UTC)')).toBeInTheDocument()
  expect(screen.queryByText(/Hour/)).not.toBeInTheDocument()
})
