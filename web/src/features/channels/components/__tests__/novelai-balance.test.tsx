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
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { StrictMode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

import { channelSchema, type NovelAIBalance } from '../../types'
import { BalanceCell } from '../channels-columns'
import { ChannelsProvider, useChannels } from '../channels-provider'
import { BalanceQueryDialog } from '../dialogs/balance-query-dialog'
import { NovelAIBalance as NovelAIBalancePanel } from '../novelai-balance'

let client: QueryClient
const channel = channelSchema.parse({
  id: 64,
  type: 64,
  key: '',
  name: 'NovelAI',
  status: 1,
  created_time: 1,
  test_time: 0,
  response_time: 0,
  balance_updated_time: 0,
})

function fixture(): NovelAIBalance {
  return {
    active: true,
    tier: 3,
    expiresAt: 2000000000,
    trainingStepsLeft: {
      fixedTrainingStepsLeft: 9911,
      purchasedTrainingSteps: 100,
    },
    usage: {
      percent: 64,
      purchasedPercent: 25,
      isNegative: false,
      timeUntilNextPercent: 600,
    },
    sampled_at: Math.floor(Date.now() / 1000),
  }
}

function Actions() {
  const context = useChannels()
  return (
    <>
      <Button onClick={() => context.setSensitiveVisible(false)}>Hide</Button>
      <Button
        onClick={() => {
          context.setCurrentRow(channel)
          context.setOpen('balance-query')
        }}
      >
        Details
      </Button>
      <BalanceQueryDialog
        open={context.open === 'balance-query'}
        onOpenChange={() => context.setOpen(null)}
      />
    </>
  )
}

function panel(multiKey = false, detailed = false) {
  return (
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        {detailed ? (
          <NovelAIBalancePanel channel={channel} detailed />
        ) : (
          <BalanceCell
            channel={
              multiKey
                ? {
                    ...channel,
                    channel_info: {
                      ...channel.channel_info,
                      is_multi_key: true,
                    },
                  }
                : channel
            }
          />
        )}
        <Actions />
      </ChannelsProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  localStorage.clear()
})

it('shows only Anlas and allowance text side by side, with separate wallet details', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, novelai: fixture() },
  })
  const user = userEvent.setup()
  render(panel())
  const anlas = await screen.findByLabelText('10,011 Anlas')
  const allowance = screen.getByLabelText('V5 allowance')
  expect(allowance).toHaveTextContent('64%')
  const group = screen.getByRole('group', { name: 'NovelAI' })
  expect(group).toHaveClass('flex-row', 'items-center')
  expect(within(group).getByLabelText('10,011 Anlas')).toBe(anlas)
  expect(within(group).getByLabelText('V5 allowance')).toBe(allowance)
  expect(within(group).queryByRole('progressbar')).not.toBeInTheDocument()
  expect(within(group).queryByRole('button')).not.toBeInTheDocument()
  expect(group.querySelector('svg')).toBeNull()
  await user.tab()
  expect(await screen.findByText('Subscription Anlas')).toBeInTheDocument()
  expect(screen.getByText('9,911')).toBeInTheDocument()
  expect(screen.getByText('100')).toBeInTheDocument()
  expect(screen.getByText('25%')).toBeInTheDocument()
})

it('loads resources after StrictMode remounts without reusing a canceled request', async () => {
  const originalAdapter = api.defaults.adapter
  api.defaults.adapter = async (config) => ({
    data: { success: true, novelai: fixture() },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  try {
    render(<StrictMode>{panel()}</StrictMode>)
    expect(await screen.findByLabelText('10,011 Anlas')).toBeInTheDocument()
    expect(
      screen.queryByText('Failed to query balance')
    ).not.toBeInTheDocument()
  } finally {
    api.defaults.adapter = originalAdapter
  }
})

it('shares the same read-only snapshot with the balance dialog and hides all amounts in privacy mode', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, novelai: fixture() } })
  const user = userEvent.setup()
  render(panel())
  await screen.findByLabelText('10,011 Anlas')
  await user.click(screen.getByRole('button', { name: 'Details' }))
  const dialog = await screen.findByRole('dialog', { name: 'Query Balance' })
  expect(within(dialog).getByText('Subscription Anlas')).toBeInTheDocument()
  expect(within(dialog).getByText('Purchased Anlas')).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(1)
  await user.click(within(dialog).getByRole('button', { name: 'Close' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  await user.click(screen.getByRole('button', { name: 'Hide' }))
  expect(screen.queryByLabelText('V5 allowance')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('10,011 Anlas')).not.toBeInTheDocument()
  expect(screen.queryByText('9,911')).not.toBeInTheDocument()
})

it.each([
  { percent: 0, exhausted: false, label: '0%' },
  { percent: 0, exhausted: true, label: '0% (Exhausted)' },
  { percent: 135, exhausted: false, label: '135%' },
])(
  'preserves zero and over-cap allowance without treating zero Anlas as USD: $label',
  async ({ percent, exhausted, label }) => {
    const data = fixture()
    data.trainingStepsLeft = {
      fixedTrainingStepsLeft: 0,
      purchasedTrainingSteps: 0,
    }
    data.usage = {
      percent,
      purchasedPercent: 25,
      isNegative: exhausted,
      timeUntilNextPercent: 0,
    }
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, novelai: data },
    })
    render(panel())
    expect(await screen.findByLabelText('0 Anlas')).toBeInTheDocument()
    const allowance = screen.getByLabelText('V5 allowance')
    expect(allowance).toHaveTextContent(`${percent}%`)
    expect(allowance).toHaveAttribute('aria-description', label)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Details' }))
    expect(
      within(await screen.findByRole('dialog')).getByText('Refill paused')
    ).toBeInTheDocument()
  }
)

it('keeps absent allowance and a missing purchased wallet unknown rather than free or zero', async () => {
  const data = fixture()
  data.usage = null
  data.trainingStepsLeft = {
    fixedTrainingStepsLeft: 0,
    purchasedTrainingSteps: null,
  }
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, novelai: data },
  })
  render(panel())
  expect(await screen.findByLabelText('Unknown Anlas')).toBeInTheDocument()
  expect(screen.getByLabelText('V5 allowance')).toHaveTextContent('Unknown')
})

it('shows query failures, retries from the refresh icon and labels stale snapshots after failed refreshes', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValueOnce({
    data: { success: false, message: 'Query failed' },
  })
  const user = userEvent.setup()
  render(panel(false, true))
  expect(await screen.findByRole('status')).toHaveTextContent('Query failed')
  await user.hover(screen.getByLabelText('V5 allowance'))
  const tooltip = (await screen.findByText('V5 allowance: Unknown'))
    .parentElement
  if (!tooltip) throw new Error('Missing NovelAI allowance tooltip')
  expect(within(tooltip).queryByText('Inactive')).not.toBeInTheDocument()
  expect(within(tooltip).getAllByText('Unknown').length).toBeGreaterThan(0)
  await user.unhover(screen.getByLabelText('V5 allowance'))
  get.mockResolvedValueOnce({ data: { success: true, novelai: fixture() } })
  await user.click(
    screen.getByRole('button', { name: 'Refresh NovelAI resources' })
  )
  expect(await screen.findByLabelText('10,011 Anlas')).toBeInTheDocument()
  get.mockRejectedValueOnce(new Error('Connection failed'))
  await user.click(
    screen.getByRole('button', { name: 'Refresh NovelAI resources' })
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Refresh failed. Showing the last successful snapshot.'
  )
  expect(screen.getByLabelText('10,011 Anlas')).toBeInTheDocument()
})

it.each([
  { active: true, expected: 'Active' },
  { active: false, expected: 'Inactive' },
  { active: null, expected: 'Unknown' },
  { active: undefined, expected: 'Unknown' },
])(
  'shows subscription status $expected for active=$active in details and the allowance tooltip',
  async ({ active, expected }) => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, novelai: { ...fixture(), active } },
    })
    const user = userEvent.setup()
    render(panel(false, true))
    await screen.findByLabelText('10,011 Anlas')
    expect(screen.getByText('Status').nextElementSibling).toHaveTextContent(
      expected
    )
    await user.hover(screen.getByLabelText('V5 allowance'))
    const tooltip = (await screen.findByText('V5 allowance: 64%')).parentElement
    if (!tooltip) throw new Error('Missing NovelAI allowance tooltip')
    expect(within(tooltip).getByText(expected)).toBeInTheDocument()
    if (active !== false) {
      expect(within(tooltip).queryByText('Inactive')).not.toBeInTheDocument()
    }
  }
)

it('preserves the server response message instead of a generic transport error on an initial failure', async () => {
  vi.spyOn(api, 'get').mockRejectedValue({
    isAxiosError: true,
    message: 'Request failed with status code 502',
    response: {
      status: 502,
      data: { message: 'NovelAI subscription request timed out' },
    },
  })
  render(panel(false, true))
  expect(await screen.findByRole('status')).toHaveTextContent(
    'NovelAI subscription request timed out'
  )
  expect(screen.getByRole('status')).not.toHaveTextContent(
    'Request failed with status code 502'
  )
})

it('uses the translated fallback when an initial failure has no server message', async () => {
  const i18n = createInstance()
  await i18n.init({
    lng: 'zhCN',
    resources: {
      zhCN: {
        translation: {
          'Failed to query balance': '\u4f59\u989d\u67e5\u8be2\u5931\u8d25',
        },
      },
    },
  })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: false } })
  render(<I18nextProvider i18n={i18n}>{panel(false, true)}</I18nextProvider>)
  expect(await screen.findByRole('status')).toHaveTextContent(
    '\u4f59\u989d\u67e5\u8be2\u5931\u8d25'
  )
})

it('disables duplicate refresh requests while loading and allows refreshing after completion', async () => {
  let complete!: (value: unknown) => void
  vi.spyOn(api, 'get').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      })
  )
  render(panel(false, true))
  expect(
    screen.getByRole('button', { name: 'Refresh NovelAI resources' })
  ).toBeDisabled()
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  complete({ data: { success: true, novelai: fixture() } })
  await screen.findByLabelText('10,011 Anlas')
  expect(
    screen.getByRole('button', { name: 'Refresh NovelAI resources' })
  ).toBeEnabled()
})

it('does not query an ambiguous multi-key account', () => {
  const get = vi.spyOn(api, 'get')
  render(panel(true))
  expect(
    screen.getByText('Multi-key channels do not support balance queries')
  ).toBeInTheDocument()
  expect(get).not.toHaveBeenCalled()
})

it.each([
  ['zhCN', 'zh-CN'],
  ['zhTW', 'zh-TW'],
  ['en', 'en'],
  ['fr', 'fr'],
  ['ru', 'ru'],
  ['ja', 'ja'],
  ['vi', 'vi'],
])('formats resources with a valid locale for %s', async (language, locale) => {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    resources: { [language]: { translation: {} } },
  })
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, novelai: fixture() },
  })
  render(<I18nextProvider i18n={i18n}>{panel()}</I18nextProvider>)
  const expected =
    `${new Intl.NumberFormat(locale).format(10011)} Anlas`.replaceAll(
      /\s/g,
      ' '
    )
  expect(
    await screen.findByLabelText(
      (label) => label.replaceAll(/\s/g, ' ') === expected
    )
  ).toBeInTheDocument()
})
