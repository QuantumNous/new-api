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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceSkill } from '../types'
import { SkillPaywallDialog } from './skill-paywall-dialog'

const { navigateMock, purchaseSkillMock, recordMarketplaceSkillEventMock } =
  vi.hoisted(() => ({
    navigateMock: vi.fn(),
    purchaseSkillMock: vi.fn(),
    recordMarketplaceSkillEventMock: vi.fn(),
  }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      if (!values) return key
      return Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, value),
        key
      )
    },
  }),
}))

vi.mock('../api', () => ({
  purchaseSkill: purchaseSkillMock,
  recordMarketplaceSkillEvent: recordMarketplaceSkillEventMock,
}))

const lockedSkill: MarketplaceSkill = {
  id: 'skill-1',
  slug: 'roi-writer',
  name: 'ROI Writer',
  category: 'writing',
  required_plan: 'pro',
  status: 'published',
  availability: { locked: true, cta: 'upgrade' },
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SkillPaywallDialog
        skill={lockedSkill}
        open
        onOpenChange={vi.fn()}
        onContinue={vi.fn()}
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  recordMarketplaceSkillEventMock.mockResolvedValue(undefined)
  purchaseSkillMock.mockResolvedValue({
    order_id: 'order-1',
    skill_id: 'skill-1',
    status: 'succeeded',
    entitled: true,
    amount_usd: 2,
    currency: 'USD',
    quota_charged: 1000,
    monetization_type: 'one_time',
  })
})

describe('SkillPaywallDialog', () => {
  it('tracks paywall impression and purchases with paywall attribution', async () => {
    renderDialog()

    expect(await screen.findByText('Unlock ROI Writer')).toBeInTheDocument()
    expect(screen.getByText('$19.9/mo')).toBeInTheDocument()

    await waitFor(() => {
      expect(recordMarketplaceSkillEventMock).toHaveBeenCalledWith(
        'roi-writer',
        {
          event_type: 'skill_impression',
          entry_point: 'paywall',
        }
      )
    })

    await userEvent.click(
      screen.getByRole('button', { name: '$2 解锁本个 (永久)' })
    )

    await waitFor(() => {
      expect(purchaseSkillMock).toHaveBeenCalledWith(
        'roi-writer',
        expect.objectContaining({
          entry_point: 'paywall',
        })
      )
    })
    expect(recordMarketplaceSkillEventMock).toHaveBeenCalledWith('roi-writer', {
      event_type: 'skill_detail_view',
      entry_point: 'paywall',
    })
    expect(await screen.findByText('Purchase complete')).toBeInTheDocument()
  })

  it('routes PLUS CTA to pricing with paywall click attribution', async () => {
    renderDialog()

    await userEvent.click(screen.getByRole('button', { name: '升级 PLUS' }))

    expect(recordMarketplaceSkillEventMock).toHaveBeenCalledWith('roi-writer', {
      event_type: 'skill_detail_view',
      entry_point: 'paywall',
    })
    expect(navigateMock).toHaveBeenCalledWith({ to: '/pricing' })
  })
})
