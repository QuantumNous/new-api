import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { SubscriptionQuotaSummary } from '../subscription-quota-summary'
import { SubscriptionResetSchedule } from '../subscription-reset-schedule'

const baseSubscription = {
  id: 1,
  user_id: 2,
  plan_id: 3,
  status: 'active',
  start_time: 1,
  end_time: 2,
  amount_total: 400,
  amount_used: 0,
  quota_model_version: 1,
  total_amount_used: 80,
  amount_reserved: 50,
  window_amount: 100,
  window_amount_used: 30,
  window_amount_reserved: 40,
  historical_amount_used: 300,
}

it('ticket01: shows available total and window quota after subtracting reservations', () => {
  render(<SubscriptionQuotaSummary subscription={baseSubscription} />)

  const summary = screen.getByTestId('subscription-quota-summary')
  expect(summary).toHaveTextContent(/Remaining\s+\$0\.0005/)
  expect(summary).toHaveTextContent(
    /Window quota:\s+\$0\.0001\s+\/\s+\$0\.0002/
  )
  expect(summary).toHaveTextContent(/Historical consumption:\s+\$0\.0006/)
})

it('ticket01: explains that window quota is ignored for unlimited subscriptions', () => {
  render(
    <SubscriptionQuotaSummary
      subscription={{ ...baseSubscription, amount_total: 0 }}
    />
  )

  const summary = screen.getByTestId('subscription-quota-summary')
  expect(summary).toHaveTextContent(/Total Quota:\s+Unlimited/)
  expect(summary).toHaveTextContent(
    'Unlimited total quota; window quota is not applied.'
  )
  expect(summary).toHaveTextContent(/Historical consumption:\s+\$0\.0006/)
})

it('ticket01: shows legacy finite remaining quota without dual-quota details', () => {
  render(
    <SubscriptionQuotaSummary
      subscription={{ ...baseSubscription, quota_model_version: 0 }}
    />
  )

  const summary = screen.getByTestId('subscription-quota-summary')
  expect(summary).toHaveTextContent(/Remaining\s+\$0\.0008/)
  expect(summary).not.toHaveTextContent(/Window quota:/)
})

it('ticket02: shows the current window start and next reset time', () => {
  render(
    <SubscriptionResetSchedule
      lastResetTime={1793908800}
      nextResetTime={1793995200}
      resetPolicySource='migration_baseline'
      legacyResetBaselineAt={1793908800}
    />
  )

  expect(screen.getByText(/^Window started:/)).toBeVisible()
  expect(screen.getByText(/^Next reset:/)).toBeVisible()
  expect(screen.getByText(/^Legacy migration baseline:/)).toBeVisible()
})
