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
import userEvent from '@testing-library/user-event'
import { Wallet } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import {
  YecaiAction,
  YecaiBentoGrid,
  YecaiBentoItem,
  YecaiMetric,
  YecaiPanel,
  YecaiPriceFlow,
} from '../yecai-components'

describe('Yecai components', () => {
  it('preserves semantic panel elements and exposes visual meaning as data', () => {
    render(
      <YecaiPanel as='section' tone='money' layer='raised'>
        Savings
      </YecaiPanel>
    )

    const panel = screen.getByText('Savings')
    expect(panel.tagName).toBe('SECTION')
    expect(panel).toHaveAttribute('data-tone', 'money')
    expect(panel).toHaveAttribute('data-layer', 'raised')
  })

  it('keeps actions keyboard accessible and reports the click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<YecaiAction onClick={onClick}>Create key</YecaiAction>)

    const action = screen.getByRole('button', { name: 'Create key' })
    action.focus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a metric as one readable label and value group', () => {
    render(
      <YecaiMetric icon={Wallet} label='Credit remaining' value='¥1,440' />
    )

    expect(screen.getByText('Credit remaining')).toBeVisible()
    expect(screen.getByText('¥1,440')).toBeVisible()
  })

  it('creates a semantic bento layout without legacy card wrappers', () => {
    render(
      <YecaiBentoGrid density='compact' aria-label='Usage layout'>
        <YecaiBentoItem as='aside' tone='signal'>
          Runway
        </YecaiBentoItem>
      </YecaiBentoGrid>
    )

    expect(screen.getByLabelText('Usage layout')).toHaveAttribute(
      'data-density',
      'compact'
    )
    expect(screen.getByText('Runway').tagName).toBe('ASIDE')
    expect(screen.getByText('Runway')).toHaveAttribute('data-tone', 'signal')
  })

  it('labels the complete price comparison and keeps both prices visible', () => {
    render(
      <YecaiPriceFlow
        accessibleLabel='Price comparison'
        officialLabel='Official API'
        officialValue='¥100'
        siteLabel='Yecai price'
        siteValue='¥35'
        savingsLabel='Saved'
        savingsValue='¥65'
      />
    )

    expect(
      screen.getByRole('figure', { name: 'Price comparison' })
    ).toBeVisible()
    expect(screen.getByText('¥100')).toBeVisible()
    expect(screen.getByText('¥35')).toBeVisible()
    expect(screen.getByText('¥65')).toBeVisible()
  })
})
