import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import type { PlanRecord } from '../../types'
import { SubscriptionsMutateDrawer } from '../subscriptions-mutate-drawer'

vi.mock('../../api', () => ({
  createPlan: vi.fn(),
  createWaffoPancakeSubscriptionProduct: vi.fn(),
  getGroups: vi.fn().mockResolvedValue({ success: true, data: [] }),
  listWaffoPancakeSubscriptionProductOptions: vi.fn().mockResolvedValue({
    success: true,
    message: 'success',
    data: { products: [] },
  }),
  updatePlan: vi.fn(),
}))

vi.mock('../subscriptions-provider', () => ({
  useSubscriptions: () => ({ triggerRefresh: vi.fn() }),
}))

afterEach(() => vi.clearAllMocks())

function renderPlanDrawer() {
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

  render(
    <SubscriptionsMutateDrawer open onOpenChange={vi.fn()} currentRow={plan} />
  )
}

it('disables the window quota and explains it is ignored when total quota becomes unlimited', async () => {
  const user = userEvent.setup()
  renderPlanDrawer()

  const totalQuota = await screen.findByRole('spinbutton', {
    name: /Total quota/,
  })
  const windowQuota = screen.getByRole('spinbutton', {
    name: /Window quota/,
  })

  expect(windowQuota).toBeEnabled()
  await user.clear(totalQuota)
  await user.type(totalQuota, '0')

  await waitFor(() => expect(windowQuota).toBeDisabled())
  expect(
    screen.getByText('Unlimited total quota; window quota is not applied.')
  ).toBeInTheDocument()
})

it('re-enables the window quota when a finite total quota is restored', async () => {
  const user = userEvent.setup()
  renderPlanDrawer()

  const totalQuota = await screen.findByRole('spinbutton', {
    name: /Total quota/,
  })
  const windowQuota = screen.getByRole('spinbutton', {
    name: /Window quota/,
  })
  await user.clear(totalQuota)
  await user.type(totalQuota, '0')
  await waitFor(() => expect(windowQuota).toBeDisabled())

  await user.clear(totalQuota)
  await user.type(totalQuota, '1')

  await waitFor(() => expect(windowQuota).toBeEnabled())
  expect(
    screen.getByText(
      'Quota available in each reset window. Later windows may have partial or no quota when total quota is used up.'
    )
  ).toBeInTheDocument()
})
