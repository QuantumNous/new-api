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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import type { AgentPlanQuota } from '../../types'
import { ProviderQuotas } from '../provider-quotas'

test('shows one shared upstream key and opens a separate seat by keyboard', async () => {
  const now = Math.floor(Date.now() / 1000)
  const plans: AgentPlanQuota[] = [
    {
      id: 'personal',
      name: 'Personal plan',
      product: 'coding-plan',
      status: 'ok',
      last_success_at: now,
      windows: [{ period: 'five_hour', used_percent: 88 }],
      keys: [
        {
          id: '12:0',
          label: '••••7F2A',
          today_tokens: 3_278_000,
          channels: [
            { id: 12, name: 'Claude channel', today_tokens: 2_418_000 },
            { id: 13, name: 'OpenAI channel', today_tokens: 860_000 },
          ],
        },
      ],
    },
    {
      id: 'team',
      name: 'Team seat A',
      status: 'rate_limited',
      last_success_at: now,
      windows: [{ period: 'monthly', quota: 100, used: 20 }],
      keys: [
        {
          id: '14:0',
          label: '••••D120',
          channels: [{ id: 14, name: 'Team channel' }],
        },
      ],
    },
  ]
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: plans },
  })
  const client = new QueryClient()
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider client={client}>
      <ProviderQuotas />
    </QueryClientProvider>
  )

  try {
    const personal = await screen.findByRole('button', {
      name: /Personal plan/,
    })
    expect(personal).toHaveAttribute('aria-expanded', 'true')
    expect(within(personal).getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getAllByText('12% remaining')).toHaveLength(2)
    expect(screen.getAllByText(/7F2A/)).toHaveLength(1)
    expect(screen.getByText('Claude channel')).toBeVisible()
    expect(screen.getByText('OpenAI channel')).toBeVisible()
    expect(screen.getByText('Total: 3,278,000 tokens')).toBeVisible()
    expect(screen.getByText('Claude channel').closest('li')).toHaveTextContent(
      '2,418,000 tokens'
    )
    expect(screen.getByText('OpenAI channel').closest('li')).toHaveTextContent(
      '860,000 tokens'
    )

    const team = screen.getByRole('button', { name: /Team seat A/ })
    expect(team).toHaveAttribute('aria-expanded', 'false')
    expect(within(team).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText('Team channel')).not.toBeInTheDocument()
    team.focus()
    await user.keyboard('{Enter}')
    expect(team).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Team channel')).toBeVisible()
    expect(screen.getByText('80 / 100 AFP')).toBeVisible()
    expect(screen.getByText('Usage unavailable')).toBeVisible()
  } finally {
    view.unmount()
    client.clear()
    get.mockRestore()
  }
})
