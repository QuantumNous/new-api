import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getAdminPlans,
  getUserSubscriptions,
  restoreUserSubscriptionQuota,
} from '../../api'
import type {
  PlanRecord,
  SubscriptionQuotaRestoreResult,
  UserSubscriptionRecord,
} from '../../types'
import { UserSubscriptionsDialog } from '../dialogs/user-subscriptions-dialog'

vi.mock('../../api', () => ({
  createUserSubscription: vi.fn(),
  deleteUserSubscription: vi.fn(),
  getAdminPlans: vi.fn(),
  getUserSubscriptions: vi.fn(),
  invalidateUserSubscription: vi.fn(),
  restoreUserSubscriptionQuota: vi.fn(),
}))

const mockedGetAdminPlans = vi.mocked(getAdminPlans)
const mockedGetUserSubscriptions = vi.mocked(getUserSubscriptions)
const mockedRestoreUserSubscriptionQuota = vi.mocked(
  restoreUserSubscriptionQuota
)

const plan: PlanRecord = {
  plan: {
    id: 10,
    title: 'Weekly plan',
    price_amount: 10,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    quota_reset_period: 'weekly',
    quota_reset_custom_seconds: 0,
    enabled: true,
    sort_order: 0,
    allow_balance_pay: true,
    allow_wallet_overflow: true,
    max_purchase_per_user: 0,
    total_amount: 500_000,
    window_amount: 100_000,
    quota_model_version: 1,
    upgrade_group: '',
    downgrade_group: '',
  },
}

function createSubscription(
  overrides: Partial<UserSubscriptionRecord['subscription']> = {}
): UserSubscriptionRecord {
  return {
    subscription: {
      id: 11,
      user_id: 7,
      plan_id: 10,
      status: 'active',
      source: 'admin',
      start_time: 1_700_000_000,
      end_time: 1_900_000_000,
      amount_total: 500_000,
      amount_used: 0,
      amount_reserved: 10_000,
      last_reset_time: 1_700_000_000,
      next_reset_time: 1_700_604_800,
      window_amount: 100_000,
      quota_model_version: 1,
      total_amount_used: 50_000,
      window_amount_used: 20_000,
      window_amount_reserved: 10_000,
      historical_amount_used: 80_000,
      ...overrides,
    },
  }
}

function createRestoreResult(
  overrides: Partial<SubscriptionQuotaRestoreResult> = {}
): { success: true; data: SubscriptionQuotaRestoreResult } {
  return {
    success: true,
    data: {
      idempotency_key: 'restore-1',
      user_id: 7,
      user_subscription_id: 11,
      action: 'restore_window',
      returned_quota: 20_000,
      total_remaining: 470_000,
      window_remaining: 100_000,
      unlimited: false,
      created_at: 1_700_000_001,
      ...overrides,
    },
  }
}

function renderDialog(subscription = createSubscription()) {
  mockedGetAdminPlans.mockResolvedValue({ success: true, data: [plan] })
  mockedGetUserSubscriptions.mockResolvedValue({
    success: true,
    data: [subscription],
  })

  return render(
    <UserSubscriptionsDialog
      open
      onOpenChange={vi.fn()}
      user={{ id: 7, username: 'quota-user' }}
    />
  )
}

async function openRestoreDialog(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  await screen.findByText('User Subscription Management')
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  await user.click(await screen.findByRole('menuitem', { name: label }))
  return screen.findByRole('textbox', { name: 'Reason' })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('UserSubscriptionsDialog quota restoration', () => {
  it('keeps an oversized UTF-8 reason editable until corrected', async () => {
    const user = userEvent.setup()
    renderDialog()
    const reason = await openRestoreDialog(user, 'Restore window quota')
    fireEvent.change(reason, { target: { value: '中'.repeat(667) } })
    const confirm = screen.getByRole('button', { name: 'Restore window' })
    expect(confirm).toBeDisabled()
    expect(reason).toHaveAttribute('aria-invalid', 'true')
    expect(reason).not.toHaveAttribute('readonly')
    expect(mockedRestoreUserSubscriptionQuota).not.toHaveBeenCalled()
    fireEvent.change(reason, {
      target: { value: '  ' + '中'.repeat(666) + 'ab  ' },
    })
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(mockedRestoreUserSubscriptionQuota).toHaveBeenCalledWith(
      7,
      11,
      expect.objectContaining({ reason: '中'.repeat(666) + 'ab' })
    )
  })
  it('offers per-subscription initialization without the legacy plan reset action', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText('User Subscription Management')
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(
      screen.getByRole('menuitem', { name: 'Initialize subscription quota' })
    ).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: /^Reset quota$/ })
    ).not.toBeInTheDocument()
  })
  it('requires a reason and keeps the confirmation disabled until one is entered', async () => {
    const user = userEvent.setup()
    renderDialog()

    await openRestoreDialog(user, 'Restore window quota')

    const confirm = screen.getByRole('button', { name: 'Restore window' })
    expect(confirm).toBeDisabled()

    await user.type(
      screen.getByRole('textbox', { name: 'Reason' }),
      'Courtesy reset'
    )

    expect(confirm).toBeEnabled()
  })

  it('shows loading during restore and closes after a successful response', async () => {
    const user = userEvent.setup()
    let resolveRestore!: (value: ReturnType<typeof createRestoreResult>) => void
    mockedRestoreUserSubscriptionQuota.mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = resolve
      })
    )
    renderDialog()

    const reason = await openRestoreDialog(user, 'Restore window quota')
    await user.type(reason, 'Courtesy reset')
    const confirm = screen.getByRole('button', { name: 'Restore window' })
    await user.click(confirm)

    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(mockedRestoreUserSubscriptionQuota).toHaveBeenCalledTimes(1)
    expect(mockedRestoreUserSubscriptionQuota).toHaveBeenCalledWith(
      7,
      11,
      expect.objectContaining({
        action: 'restore_window',
        reason: 'Courtesy reset',
        idempotency_key: expect.any(String),
      })
    )

    resolveRestore(createRestoreResult())
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Restore window' })
      ).not.toBeInTheDocument()
    )
    expect(mockedGetUserSubscriptions).toHaveBeenCalledTimes(2)
  })

  it('keeps the dialog open after a failed restore so the administrator can retry', async () => {
    const user = userEvent.setup()
    mockedRestoreUserSubscriptionQuota
      .mockResolvedValueOnce({ success: false, message: 'Temporary failure' })
      .mockResolvedValueOnce(createRestoreResult())
    renderDialog()

    const reason = await openRestoreDialog(user, 'Restore window quota')
    await user.type(reason, 'Retry after failure')
    const confirm = screen.getByRole('button', { name: 'Restore window' })
    await user.click(confirm)

    await waitFor(() => expect(confirm).toBeEnabled())
    expect(reason).toHaveAttribute('readonly')
    await user.type(reason, ' changed')
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveValue(
      'Retry after failure'
    )

    await user.click(confirm)
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Restore window' })
      ).not.toBeInTheDocument()
    )
    expect(mockedRestoreUserSubscriptionQuota).toHaveBeenCalledTimes(2)
    const firstRequest = mockedRestoreUserSubscriptionQuota.mock.calls[0][2]
    const retryRequest = mockedRestoreUserSubscriptionQuota.mock.calls[1][2]
    expect(retryRequest).toEqual(firstRequest)
  })

  it('explains that unlimited subscriptions do not gain quota during initialization', async () => {
    const user = userEvent.setup()
    mockedRestoreUserSubscriptionQuota.mockResolvedValue(
      createRestoreResult({
        action: 'initialize',
        unlimited: true,
        returned_quota: 0,
        total_remaining: 0,
        window_remaining: 0,
      })
    )
    renderDialog(createSubscription({ amount_total: 0 }))

    const reason = await openRestoreDialog(
      user,
      'Initialize subscription quota'
    )
    expect(
      screen.getByText('Quota is unlimited; restoration did not add quota.')
    ).toBeInTheDocument()
    await user.type(reason, 'Initialize traffic')
    await user.click(screen.getByRole('button', { name: 'Initialize traffic' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Initialize traffic' })
      ).not.toBeInTheDocument()
    )
    expect(mockedRestoreUserSubscriptionQuota).toHaveBeenCalledWith(
      7,
      11,
      expect.objectContaining({
        action: 'initialize',
        reason: 'Initialize traffic',
      })
    )
  })

  it('shows the purchased plan title and version from the subscription snapshot', async () => {
    renderDialog(
      createSubscription({
        plan_title: 'Legacy weekly plan',
        plan_version: 2,
      })
    )

    expect(await screen.findByText(/Legacy weekly plan/)).toBeInTheDocument()
    expect(await screen.findByText(/Version 2/)).toBeInTheDocument()
  })
})
