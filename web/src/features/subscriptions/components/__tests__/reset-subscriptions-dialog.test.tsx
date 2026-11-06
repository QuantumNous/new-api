import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resetPlanSubscriptions,
  restorePlanSubscriptionWindows,
} from '../../api'
import type { PlanRecord } from '../../types'
import { DataTableRowActions } from '../data-table-row-actions'
import { ResetSubscriptionsDialog } from '../dialogs/reset-subscriptions-dialog'
import {
  SubscriptionsProvider,
  useSubscriptions,
} from '../subscriptions-provider'

vi.mock('../../api', () => ({
  resetPlanSubscriptions: vi.fn(),
  restorePlanSubscriptionWindows: vi.fn(),
}))

const restore = vi.mocked(restorePlanSubscriptionWindows)
const reset = vi.mocked(resetPlanSubscriptions)
const plan: PlanRecord = {
  plan: {
    id: 10,
    title: 'Weekly plan',
    price_amount: 10,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    quota_reset_period: 'weekly',
    enabled: true,
    sort_order: 0,
    allow_balance_pay: true,
    allow_wallet_overflow: true,
    max_purchase_per_user: 0,
    total_amount: 500_000,
    window_amount: 100_000,
    quota_model_version: 1,
  },
}

function Harness() {
  const { open, currentRow, refreshTrigger } = useSubscriptions()
  const table = useReactTable({
    data: [plan],
    columns: [],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <>
      <DataTableRowActions row={table.getRowModel().rows[0]} />
      <output aria-label='Refresh count'>{refreshTrigger}</output>
      <ResetSubscriptionsDialog key={`${open}:${currentRow?.plan.id}`} />
    </>
  )
}

function renderActions(complianceConfirmed = true) {
  const client = new QueryClient()
  client.setQueryData(['system-options'], {
    success: true,
    data: [
      {
        key: 'payment_setting.compliance_confirmed',
        value: String(complianceConfirmed),
      },
      { key: 'payment_setting.compliance_terms_version', value: 'v1' },
    ],
  })
  return render(
    <QueryClientProvider client={client}>
      <SubscriptionsProvider>
        <Harness />
      </SubscriptionsProvider>
    </QueryClientProvider>
  )
}

afterEach(() => vi.resetAllMocks())

async function openResetDialog(
  user: ReturnType<typeof userEvent.setup>,
  action: 'Reset window quota' | 'Reset subscription quota'
) {
  await user.click(screen.getByRole('button', { name: 'More actions' }))
  await user.click(screen.getByRole('menuitem', { name: action }))
}

describe('plan window quota restoration', () => {
  it('requires a reason, prevents duplicate submissions, and refreshes after success', async () => {
    const user = userEvent.setup()
    let resolveRestore!: (
      value: Awaited<ReturnType<typeof restorePlanSubscriptionWindows>>
    ) => void
    restore.mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = resolve
      })
    )
    renderActions()
    await openResetDialog(user, 'Reset window quota')
    expect(
      screen.getByText(/each active subscription under Weekly plan/)
    ).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Restore window' })
    expect(confirm).toBeDisabled()
    await user.type(
      screen.getByRole('textbox', { name: 'Reason' }),
      '  Courtesy reset  '
    )
    await user.click(confirm)
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    await user.keyboard('{Escape}')
    expect(
      screen.getByRole('button', { name: 'Restore window' })
    ).toBeDisabled()
    expect(restore).toHaveBeenCalledExactlyOnceWith(10, {
      idempotency_key: expect.any(String),
      reason: 'Courtesy reset',
    })
    resolveRestore({
      success: true,
      data: {
        idempotency_key: 'receipt',
        plan_id: 10,
        matched_count: 3,
        reset_count: 2,
        user_count: 2,
        created_at: 1_700_000_000,
      },
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Restore window' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText('Refresh count')).toHaveTextContent('1')
    expect(reset).not.toHaveBeenCalled()
  })

  it('retries with the same request and resets the form when reopened', async () => {
    const user = userEvent.setup()
    restore.mockResolvedValue({ success: false, message: 'Temporary failure' })
    renderActions()
    await openResetDialog(user, 'Reset window quota')
    await user.type(
      screen.getByRole('textbox', { name: 'Reason' }),
      'Retry safely'
    )
    await user.click(screen.getByRole('button', { name: 'Restore window' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Restore window' })
      ).toBeEnabled()
    )
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveAttribute(
      'readonly'
    )
    await user.click(screen.getByRole('button', { name: 'Restore window' }))
    expect(restore.mock.calls[1]).toEqual(restore.mock.calls[0])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await openResetDialog(user, 'Reset window quota')
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveValue('')
    await user.type(
      screen.getByRole('textbox', { name: 'Reason' }),
      'Another reset'
    )
    await user.click(screen.getByRole('button', { name: 'Restore window' }))
    expect(restore.mock.calls[2][1].idempotency_key).not.toBe(
      restore.mock.calls[0][1].idempotency_key
    )
  })

  it('keeps the existing total quota reset and reset-time option available', async () => {
    const user = userEvent.setup()
    reset.mockResolvedValue({
      success: true,
      data: {
        plan_id: 10,
        matched_count: 2,
        reset_count: 2,
        user_count: 2,
        advance_reset_time: false,
      },
    })
    renderActions()
    await openResetDialog(user, 'Reset subscription quota')
    const advance = screen.getByRole('switch', {
      name: /Advance next reset time/,
    })
    expect(advance).toBeChecked()
    await user.click(advance)
    await user.click(screen.getByRole('button', { name: 'Reset quota' }))
    expect(reset).toHaveBeenCalledExactlyOnceWith(10, {
      advance_reset_time: false,
    })
    expect(restore).not.toHaveBeenCalled()
  })

  it.each([
    ['Reset subscription quota', '{Enter}', 'Reset quota'],
    ['Reset window quota', '{ArrowDown}{Enter}', 'Restore window'],
  ])(
    'opens %s from the icon menu using the keyboard',
    async (action, keys, confirmLabel) => {
      const user = userEvent.setup()
      renderActions()
      const trigger = screen.getByRole('button', { name: 'More actions' })
      expect(trigger).toHaveTextContent('')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(
        screen.queryByRole('button', { name: action })
      ).not.toBeInTheDocument()
      await user.tab()
      await user.tab()
      expect(trigger).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      expect(
        screen.getByRole('menuitem', { name: 'Reset subscription quota' })
      ).toBeVisible()
      expect(
        screen.getByRole('menuitem', { name: 'Reset window quota' })
      ).toBeVisible()
      await user.keyboard(keys)
      expect(screen.getByRole('button', { name: confirmLabel })).toBeVisible()
      expect(reset).not.toHaveBeenCalled()
      expect(restore).not.toHaveBeenCalled()
    }
  )

  it('uses the existing compliance restriction for both reset actions', () => {
    renderActions(false)
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDisabled()
  })
})
