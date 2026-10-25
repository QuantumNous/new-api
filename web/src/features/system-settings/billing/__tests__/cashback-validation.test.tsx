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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppQueryClient } from '@/lib/query-client'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SettingsPageProvider } from '../../components/settings-page-context'
import type { CashbackConfig } from '../../types'
import { CashbackCampaigns } from '../cashback-campaigns'
import { CashbackSettingsForm } from '../cashback-settings-form'
import { parseCnyCents } from '../cashback-tier-amount'

const {
  updateCashbackConfig,
  listCashbackCampaigns,
  createCashbackCampaign,
  stopCashbackCampaign,
} = vi.hoisted(() => ({
  updateCashbackConfig: vi.fn(),
  listCashbackCampaigns: vi.fn(),
  createCashbackCampaign: vi.fn(),
  stopCashbackCampaign: vi.fn(),
}))

vi.mock('../../api', () => ({
  updateCashbackConfig,
  listCashbackCampaigns,
  createCashbackCampaign,
  stopCashbackCampaign,
}))

const config: CashbackConfig = {
  inviter_enabled: false,
  invitee_enabled: false,
  inviter_rate_bps: 0,
  invitee_rate_bps: 0,
  inviter_strategy: 'rate',
  invitee_strategy: 'rate',
  inviter_fixed_per_hundred: 0,
  invitee_fixed_per_hundred: 0,
  settlement_days: 7,
  max_reward_quota: 1000,
  daily_reward_quota: 5000,
  ip_account_threshold: 3,
  device_account_threshold: 2,
  daily_topup_count_threshold: 5,
  auto_review_enabled: false,
  auto_review_risk_flags: null,
  available_auto_review_risk_flags: [
    'device_missing',
    'login_ip_mismatch',
    'open_debt',
  ],
  auto_review_immediate_issue: true,
  first_enabled_at: 0,
  version: 1,
  compliance_confirmed: true,
}

let actionsContainer: HTMLDivElement | null = null
let queryClient: QueryClient | null = null

beforeEach(() => {
  updateCashbackConfig.mockReset()
  listCashbackCampaigns.mockReset()
  createCashbackCampaign.mockReset()
  stopCashbackCampaign.mockReset()
  listCashbackCampaigns.mockResolvedValue({ success: true, data: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
  queryClient?.clear()
  actionsContainer?.remove()
  actionsContainer = null
  queryClient = null
})

function renderForm(initialConfig: CashbackConfig = config) {
  actionsContainer = document.createElement('div')
  document.body.append(actionsContainer)
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsPageProvider actionsContainer={actionsContainer}>
        <CashbackSettingsForm config={initialConfig} />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

describe('cashback settings validation', () => {
  it('parses exact cents and rejects sub-cent or unsafe integer values', () => {
    expect(parseCnyCents('100.50')).toBe(10050)
    expect(parseCnyCents('0.01')).toBe(1)
    expect(parseCnyCents('100.001')).toBeNull()
    expect(parseCnyCents('90071992547409.92')).toBeNull()
  })

  it('saves independent cent-precise tiers and keeps inactive tier data on a strategy switch', async () => {
    updateCashbackConfig.mockResolvedValue({ success: true, data: config })
    const user = userEvent.setup()
    renderForm()
    await user.click(
      screen.getByRole('combobox', { name: 'Inviter cashback strategy' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Tiered fixed reward' })
    )
    await user.click(screen.getByRole('button', { name: 'Add tier' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Threshold (CNY)' }), {
      target: { value: '100.50' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Reward (CNY)' }), {
      target: { value: '2.50' },
    })
    await user.click(
      screen.getByRole('combobox', { name: 'Inviter cashback strategy' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Percentage of top-up' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    await waitFor(() => expect(updateCashbackConfig).toHaveBeenCalled())
    expect(updateCashbackConfig.mock.calls[0][0].inviter_tiers).toEqual([
      { threshold_cents: 10050, reward_cents: 250 },
    ])
  })

  it('edits both directions independently and removes a tier with an accessible button', async () => {
    updateCashbackConfig.mockResolvedValue({ success: true, data: config })
    const user = userEvent.setup()
    renderForm()
    await user.click(
      screen.getByRole('combobox', { name: 'Payer cashback strategy' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Tiered fixed reward' })
    )
    await user.click(screen.getByRole('button', { name: 'Add tier' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Threshold (CNY)' }), {
      target: { value: '200' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Reward (CNY)' }), {
      target: { value: '15' },
    })
    await user.click(screen.getByRole('button', { name: 'Add tier' }))
    const remove = screen.getByRole('button', {
      name: 'Remove tier 2 from Payer tiers',
    })
    remove.focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getAllByRole('textbox', { name: 'Threshold (CNY)' })
    ).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Add tier' })).toHaveFocus()
    await user.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    await waitFor(() => expect(updateCashbackConfig).toHaveBeenCalled())
    expect(updateCashbackConfig.mock.calls[0][0]).toMatchObject({
      inviter_tiers: [],
      invitee_tiers: [{ threshold_cents: 20000, reward_cents: 1500 }],
    })
  })

  it('rejects missing, malformed and duplicate tier thresholds before submitting', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('switch', { name: 'Reward the inviter' }))
    await user.click(
      screen.getByRole('combobox', { name: 'Inviter cashback strategy' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Tiered fixed reward' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(await screen.findByText('Configure 1 to 32 tiers')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Add tier' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Threshold (CNY)' }), {
      target: { value: '100.001' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Reward (CNY)' }), {
      target: { value: '2.50' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(
      await screen.findByText(
        'Enter increasing positive CNY amounts with at most two decimals'
      )
    ).toBeVisible()
    expect(updateCashbackConfig).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Threshold (CNY)' }), {
      target: { value: '100.50' },
    })
    await user.click(screen.getByRole('button', { name: 'Add tier' }))
    fireEvent.change(
      screen.getAllByRole('textbox', { name: 'Threshold (CNY)' })[1],
      { target: { value: '100.50' } }
    )
    fireEvent.change(
      screen.getAllByRole('textbox', { name: 'Reward (CNY)' })[1],
      { target: { value: '2.00' } }
    )
    await user.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(
      screen.getAllByRole('textbox', { name: 'Threshold (CNY)' })[1]
    ).toHaveAttribute('aria-invalid', 'true')
    expect(updateCashbackConfig).not.toHaveBeenCalled()
  })

  it('associates the immutable first-enable label with its read-only value', () => {
    renderForm()

    expect(screen.getByLabelText('First enabled at')).toHaveAttribute(
      'readonly'
    )
  })

  it('rejects an enabled direction with a zero rate', async () => {
    renderForm()

    fireEvent.click(screen.getByRole('switch', { name: 'Reward the inviter' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )

    expect(
      await screen.findByText(
        'Enabled inviter cashback requires a positive rate'
      )
    ).toBeInTheDocument()
  })

  it('requires an integer fixed amount for an enabled per-hundred inviter', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('switch', { name: 'Reward the inviter' }))
    await user.click(
      screen.getByRole('combobox', { name: 'Inviter cashback strategy' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Fixed per 100 of top-up' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(
      await screen.findByText('Enter a whole number from 1 to 100')
    ).toBeVisible()
    expect(updateCashbackConfig).not.toHaveBeenCalled()

    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Inviter reward per 100' }),
      {
        target: { value: '20.5' },
      }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(updateCashbackConfig).not.toHaveBeenCalled()
  })

  it('rejects combined nominal return when fixed inviter and rate payer exceed 100%', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('switch', { name: 'Reward the inviter' }))
    await user.click(
      screen.getByRole('combobox', { name: 'Inviter cashback strategy' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Fixed per 100 of top-up' })
    )
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Inviter reward per 100' }),
      {
        target: { value: '60' },
      }
    )
    fireEvent.click(
      screen.getByRole('switch', { name: 'Reward the top-up payer' })
    )
    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: 'Top-up payer cashback rate (%)',
      }),
      {
        target: { value: '50' },
      }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(
      await screen.findByText('Combined cashback return cannot exceed 100%')
    ).toBeVisible()
    expect(updateCashbackConfig).not.toHaveBeenCalled()
  })

  it('describes combined nominal exposure when confirming a fixed reward', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('switch', { name: 'Reward the inviter' }))
    await user.click(
      screen.getByRole('combobox', { name: 'Inviter cashback strategy' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Fixed per 100 of top-up' })
    )
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Inviter reward per 100' }),
      { target: { value: '50' } }
    )
    await user.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(
      await screen.findByText(
        'Enabling cashback or setting a high combined nominal return creates wallet exposure. Confirm the limits and review workflow before saving.'
      )
    ).toBeVisible()
  })

  it('presents malformed configuration errors as an accessible form error', async () => {
    updateCashbackConfig.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: { field: 'config', message: 'Malformed cashback configuration' },
      },
    })
    renderForm()

    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Settlement delay (days)' }),
      { target: { value: '8' } }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )

    expect(
      await screen.findByText('Malformed cashback configuration')
    ).toHaveAttribute('role', 'alert')
  })

  it('shows a rejected risk policy as an accessible field error', async () => {
    updateCashbackConfig.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          field: 'auto_review_risk_flags',
          message: 'Invalid risk selection',
        },
      },
    })
    renderForm()
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate per-flag review policy' })
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'device_missing' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid risk selection'
    )
    expect(
      screen.getByRole('group', { name: 'Risk flags requiring manual review' })
    ).toHaveAttribute('aria-invalid', 'true')
  })

  it('saves unrelated settings without activating an unconfigured review policy', async () => {
    updateCashbackConfig.mockResolvedValue({ success: true, data: config })
    renderForm()
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Settlement delay (days)' }),
      { target: { value: '8' } }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    await waitFor(() => expect(updateCashbackConfig).toHaveBeenCalled())
    expect(updateCashbackConfig.mock.calls[0][0]).not.toHaveProperty(
      'auto_review_risk_flags'
    )
    expect(
      screen.getByText('Per-flag review policy is not configured')
    ).toBeVisible()
  })

  it('requires explicit confirmation before activating an empty risk selection', async () => {
    updateCashbackConfig.mockResolvedValue({
      success: true,
      data: { ...config, auto_review_risk_flags: [] },
    })
    renderForm()
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate per-flag review policy' })
    )
    expect(
      screen.getByRole('button', { name: 'Save cashback settings' })
    ).toBeEnabled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    expect(await screen.findByText(/No risk flags are selected/)).toBeVisible()
    expect(updateCashbackConfig).not.toHaveBeenCalled()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(updateCashbackConfig).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )
    await user.click(
      await screen.findByRole('button', { name: 'Confirm and save' })
    )
    await waitFor(() =>
      expect(updateCashbackConfig).toHaveBeenCalledWith(
        expect.objectContaining({ auto_review_risk_flags: [] }),
        expect.anything()
      )
    )
  })

  it('loads independent saved selections and supports keyboard toggling', async () => {
    renderForm({ ...config, auto_review_risk_flags: ['open_debt'] })
    const selected = screen.getByRole('checkbox', { name: 'open_debt' })
    expect(selected).toHaveAttribute('aria-checked', 'true')
    selected.focus()
    await userEvent.setup().keyboard(' ')
    expect(selected).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.getByRole('checkbox', { name: 'device_missing' })
    ).toHaveAttribute('aria-checked', 'false')
  })

  it('sends independently selected flags and immediate issuance when automatic payer review is enabled', async () => {
    updateCashbackConfig.mockResolvedValue({ success: true, data: config })
    renderForm()

    fireEvent.click(
      screen.getByRole('switch', { name: 'Enable automatic payer review' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate per-flag review policy' })
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'device_missing' }))
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Issue automatically approved payer rewards immediately',
      })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )

    await waitFor(() =>
      expect(updateCashbackConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          auto_review_enabled: true,
          auto_review_risk_flags: ['device_missing'],
          auto_review_immediate_issue: false,
        }),
        expect.anything()
      )
    )
  })

  it('edits reward limits in the display currency and saves them as quota', async () => {
    const originalConfig = useSystemConfigStore.getState().config
    useSystemConfigStore.setState({
      config: {
        ...originalConfig,
        currency: {
          ...originalConfig.currency,
          quotaPerUnit: 500_000,
          quotaDisplayType: 'CNY',
          usdExchangeRate: 1,
        },
      },
    })
    try {
      updateCashbackConfig.mockResolvedValue({ success: true, data: config })
      const user = userEvent.setup()
      renderForm()

      const single = screen.getByLabelText('Single reward limit (CNY)')
      expect(single).toHaveValue(0.002)
      await user.clear(single)
      await user.type(single, '100')
      await user.click(
        screen.getByRole('button', { name: 'Save cashback settings' })
      )

      await waitFor(() =>
        expect(updateCashbackConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            max_reward_quota: 50_000_000,
            // Untouched limits keep their exact stored quota.
            daily_reward_quota: 5000,
          }),
          expect.anything()
        )
      )
    } finally {
      useSystemConfigStore.setState({ config: originalConfig })
    }
  })

  it('rejects a combined rate above one hundred percent', async () => {
    renderForm()

    fireEvent.click(screen.getByRole('switch', { name: 'Reward the inviter' }))
    fireEvent.click(
      screen.getByRole('switch', { name: 'Reward the top-up payer' })
    )
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Inviter cashback rate (%)' }),
      {
        target: { value: '60' },
      }
    )
    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: 'Top-up payer cashback rate (%)',
      }),
      { target: { value: '50' } }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save cashback settings' })
    )

    expect(
      await screen.findByText('Combined cashback return cannot exceed 100%')
    ).toBeInTheDocument()
  })
})

describe('cashback campaigns', () => {
  function renderCampaigns() {
    queryClient = createAppQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CashbackCampaigns />
      </QueryClientProvider>
    )
  }

  it('rejects an invalid window and count before calling the campaign API', async () => {
    renderCampaigns()
    fireEvent.change(screen.getByLabelText('Campaign start'), {
      target: { value: dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm') },
    })
    fireEvent.change(screen.getByLabelText('Campaign end'), {
      target: { value: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm') },
    })
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Rewards per payer' }),
      { target: { value: '0' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    expect(
      await screen.findByText('Campaign end must be after the start')
    ).toBeVisible()
    expect(
      screen.getByText('Reward limit must be between 1 and 100000')
    ).toBeVisible()
    expect(createCashbackCampaign).not.toHaveBeenCalled()
  })

  it('creates a first-top-up campaign with a fixed limit of one reward', async () => {
    vi.spyOn(toast, 'success').mockReturnValue('success')
    createCashbackCampaign.mockResolvedValueOnce({ success: true, data: {} })
    renderCampaigns()
    await screen.findByText('No campaigns created yet')
    const limit = screen.getByRole('spinbutton', { name: 'Rewards per payer' })
    fireEvent.change(limit, { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Campaign start'), {
      target: { value: dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm') },
    })
    fireEvent.change(screen.getByLabelText('Campaign end'), {
      target: { value: dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm') },
    })

    await userEvent.click(
      screen.getByRole('switch', { name: 'First top-up only' })
    )
    expect(limit).toBeDisabled()
    expect(limit).toHaveValue(1)
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }))

    await waitFor(() =>
      expect(createCashbackCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          max_rewards_per_user: 1,
          payer_scope: 'first_top_up',
        }),
        expect.anything()
      )
    )
  })

  it('labels each campaign with the orders it rewards', async () => {
    const start = dayjs().add(2, 'hour').startOf('minute')
    const campaign = {
      id: 3,
      start_at: start.unix(),
      end_at: start.add(1, 'day').unix(),
      stopped_at: 0,
      stopped_by: 0,
      created_by: 9,
      max_rewards_per_user: 1,
      created_at: start.unix(),
      status: 'planned' as const,
    }
    listCashbackCampaigns.mockResolvedValueOnce({
      success: true,
      data: [
        { ...campaign, payer_scope: 'first_top_up' },
        { ...campaign, id: 4, payer_scope: '' },
      ],
    })
    renderCampaigns()

    expect(
      await screen.findByRole('cell', { name: 'First top-up only' })
    ).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Every top-up' })).toBeVisible()
  })

  it('shows the backend reason instead of the HTTP status when creating a campaign fails', async () => {
    const errorToast = vi.spyOn(toast, 'error').mockReturnValue('error')
    createCashbackCampaign.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status code 409'), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { success: false, message: 'Campaign window overlaps' },
        },
      })
    )
    renderCampaigns()
    await screen.findByText('No campaigns created yet')
    fireEvent.change(screen.getByLabelText('Campaign start'), {
      target: { value: dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm') },
    })
    fireEvent.change(screen.getByLabelText('Campaign end'), {
      target: { value: dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm') },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }))

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith('Campaign window overlaps')
    )
    expect(errorToast).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Campaign start')).not.toHaveValue('')
  })

  it('shows the backend reason and keeps confirmation open when stopping a campaign fails', async () => {
    const errorToast = vi.spyOn(toast, 'error').mockReturnValue('error')
    const start = dayjs().add(2, 'hour').startOf('minute')
    listCashbackCampaigns.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 3,
          start_at: start.unix(),
          end_at: start.add(1, 'day').unix(),
          stopped_at: 0,
          stopped_by: 0,
          created_by: 9,
          max_rewards_per_user: 1,
          created_at: start.unix(),
          status: 'planned',
        },
      ],
    })
    stopCashbackCampaign.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status code 409'), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { success: false, message: 'Campaign cannot be stopped' },
        },
      })
    )
    renderCampaigns()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop campaign' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop campaign' }))

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith('Campaign cannot be stopped')
    )
    expect(errorToast).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Stop campaign early?')).toBeVisible()
  })

  it('allows dismissing a pending stop while keeping confirmation disabled and refreshing after success', async () => {
    const successToast = vi.spyOn(toast, 'success').mockReturnValue('success')
    const start = dayjs().add(2, 'hour').startOf('minute')
    const campaign = {
      id: 3,
      start_at: start.unix(),
      end_at: start.add(1, 'day').unix(),
      stopped_at: 0,
      stopped_by: 0,
      created_by: 9,
      max_rewards_per_user: 1,
      created_at: start.unix(),
      status: 'planned' as const,
    }
    listCashbackCampaigns.mockResolvedValue({ success: true, data: [campaign] })
    let finishStop = () => {}
    stopCashbackCampaign.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishStop = () =>
            resolve({ success: true, data: { ...campaign, status: 'ended' } })
        })
    )
    renderCampaigns()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop campaign' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop campaign' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Stop campaign' })
      ).toBeDisabled()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(screen.queryByText('Stop campaign early?')).not.toBeInTheDocument()
    )

    finishStop()
    await waitFor(() =>
      expect(successToast).toHaveBeenCalledWith('Campaign stopped')
    )
    await waitFor(() => expect(listCashbackCampaigns).toHaveBeenCalledTimes(2))
    expect(stopCashbackCampaign).toHaveBeenCalledTimes(1)
  })

  it('reports a stop failure even after the pending dialog is dismissed', async () => {
    const errorToast = vi.spyOn(toast, 'error').mockReturnValue('error')
    const start = dayjs().add(2, 'hour').unix()
    listCashbackCampaigns.mockResolvedValue({
      success: true,
      data: [
        {
          id: 3,
          start_at: start,
          end_at: start + 86400,
          stopped_at: 0,
          stopped_by: 0,
          created_by: 9,
          max_rewards_per_user: 1,
          created_at: start,
          status: 'planned',
        },
      ],
    })
    let failStop = () => {}
    stopCashbackCampaign.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          failStop = () => reject(new Error('Campaign cannot be stopped'))
        })
    )
    renderCampaigns()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop campaign' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop campaign' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Stop campaign' })
      ).toBeDisabled()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(screen.queryByText('Stop campaign early?')).not.toBeInTheDocument()
    )

    failStop()
    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith('Campaign cannot be stopped')
    )
    expect(errorToast).toHaveBeenCalledTimes(1)
    expect(listCashbackCampaigns).toHaveBeenCalledTimes(1)
  })

  it.each(['Escape', 'Close'])(
    'dismisses the pending stop with %s while leaving the request in flight',
    async (dismiss) => {
      const start = dayjs().add(2, 'hour').unix()
      listCashbackCampaigns.mockResolvedValue({
        success: true,
        data: [
          {
            id: 3,
            start_at: start,
            end_at: start + 86400,
            stopped_at: 0,
            stopped_by: 0,
            created_by: 9,
            max_rewards_per_user: 1,
            created_at: start,
            status: 'planned',
          },
        ],
      })
      stopCashbackCampaign.mockImplementation(() => new Promise(() => {}))
      renderCampaigns()
      fireEvent.click(
        await screen.findByRole('button', { name: 'Stop campaign' })
      )
      fireEvent.click(screen.getByRole('button', { name: 'Stop campaign' }))
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Stop campaign' })
        ).toBeDisabled()
      )

      if (dismiss === 'Escape') {
        fireEvent.keyDown(document, { key: 'Escape' })
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      }
      await waitFor(() =>
        expect(
          screen.queryByText('Stop campaign early?')
        ).not.toBeInTheDocument()
      )
      expect(stopCashbackCampaign).toHaveBeenCalledTimes(1)
    }
  )

  it('creates a bounded campaign then confirms an early stop without editing its window', async () => {
    const start = dayjs().add(2, 'hour').startOf('minute')
    const end = start.add(1, 'day')
    const campaign = {
      id: 3,
      start_at: start.unix(),
      end_at: end.unix(),
      stopped_at: 0,
      stopped_by: 0,
      created_by: 9,
      max_rewards_per_user: 1,
      created_at: start.unix(),
      status: 'planned',
    }
    createCashbackCampaign.mockResolvedValue({ success: true, data: campaign })
    stopCashbackCampaign.mockResolvedValue({
      success: true,
      data: { ...campaign, stopped_at: start.unix(), status: 'ended' },
    })
    listCashbackCampaigns
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: [campaign] })
    renderCampaigns()
    await screen.findByText('No campaigns created yet')
    fireEvent.change(screen.getByLabelText('Campaign start'), {
      target: { value: start.format('YYYY-MM-DDTHH:mm') },
    })
    fireEvent.change(screen.getByLabelText('Campaign end'), {
      target: { value: end.format('YYYY-MM-DDTHH:mm') },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() =>
      expect(createCashbackCampaign).toHaveBeenCalledWith(
        {
          start_at: start.unix(),
          end_at: end.unix(),
          max_rewards_per_user: 1,
          payer_scope: '',
        },
        expect.anything()
      )
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop campaign' })
    )
    expect(stopCashbackCampaign).not.toHaveBeenCalled()
    await screen.findByText('Stop campaign early?')
    fireEvent.click(screen.getByRole('button', { name: 'Stop campaign' }))
    await waitFor(() => expect(stopCashbackCampaign).toHaveBeenCalledWith(3))
  })
})
