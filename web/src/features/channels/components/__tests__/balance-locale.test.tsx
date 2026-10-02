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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { type ReactNode, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { channelSchema } from '../../types'
import { BalanceCell } from '../channels-columns'
import { ChannelsProvider, useChannels } from '../channels-provider'
import { BalanceQueryDialog } from '../dialogs/balance-query-dialog'

// Persian currency amounts from Intl start with a left-to-right mark.
const LRM = '‎'

// 500000 quota units are $1 with the default currency settings.
const channel = channelSchema.parse({
  id: 7,
  type: 1,
  key: '',
  name: 'Test',
  status: 1,
  created_time: 1,
  test_time: 0,
  response_time: 0,
  balance_updated_time: 0,
  balance: 12.5,
  used_quota: 1_000_000,
})

function renderInChannels(children: ReactNode): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChannelsProvider>{children}</ChannelsProvider>
      <Toaster />
    </QueryClientProvider>
  )
}

function BalanceDialogForChannel(): ReactNode {
  const { setCurrentRow } = useChannels()
  useEffect(() => setCurrentRow(channel), [setCurrentRow])
  return <BalanceQueryDialog open onOpenChange={() => undefined} />
}

async function updateBalanceTo(
  balance: number,
  remainingBadge: string
): Promise<void> {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, balance } })
  renderInChannels(<BalanceCell channel={channel} />)
  await userEvent.click(screen.getByText(remainingBadge))
}

afterEach(async () => {
  toast.dismiss()
  cleanup()
  await i18next.changeLanguage('en')
})

describe('channel balance amounts', () => {
  it('in English, keeps the used and remaining badges as before', async () => {
    await i18next.changeLanguage('en')
    renderInChannels(<BalanceCell channel={channel} />)
    expect(screen.getByText('$2')).toBeInTheDocument()
    expect(screen.getByText('$12.5')).toBeInTheDocument()
  })

  it('in Persian, writes the used and remaining badges with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderInChannels(<BalanceCell channel={channel} />)
    expect(screen.getByText(`${LRM}$۲`)).toBeInTheDocument()
    expect(screen.getByText(`${LRM}$۱۲٫۵`)).toBeInTheDocument()
  })

  it('in English, keeps the updated balance notice as before', async () => {
    await i18next.changeLanguage('en')
    await updateBalanceTo(20, '$12.5')
    expect(await screen.findByText('Balance updated: $20')).toBeInTheDocument()
  })

  it('in Persian, writes the updated balance notice with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    await updateBalanceTo(20, `${LRM}$۱۲٫۵`)
    expect(
      await screen.findByText(new RegExp(`${LRM}\\$۲۰`))
    ).toBeInTheDocument()
  })

  it('in English, keeps the current balance in the balance dialog as before', async () => {
    await i18next.changeLanguage('en')
    renderInChannels(<BalanceDialogForChannel />)
    expect(await screen.findByText('$12.5')).toBeInTheDocument()
  })

  it('in Persian, writes the current balance in the balance dialog with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderInChannels(<BalanceDialogForChannel />)
    expect(await screen.findByText(`${LRM}$۱۲٫۵`)).toBeInTheDocument()
  })
})
