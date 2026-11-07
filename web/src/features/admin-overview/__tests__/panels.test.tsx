import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { formatLogQuota } from '@/lib/format'

import { ActivityTrendPanel } from '../components/activity-trend-panel'
import { ModelUsagePanel } from '../components/model-usage-panel'
import { RevenuePanel } from '../components/revenue-panel'
import { TopModelsPanel } from '../components/top-models-panel'

const models = [
  { model: 'model-a', tokens: 40, quota: 1, requests: 1 },
  { model: 'model-b', tokens: 20, quota: 100, requests: 1 },
  { model: 'model-c', tokens: 15, quota: 0, requests: 1 },
  { model: 'model-d', tokens: 10, quota: 0, requests: 1 },
  { model: 'model-e', tokens: 10, quota: 0, requests: 1 },
  { model: 'model-f', tokens: 5, quota: 0, requests: 1 },
]

describe('admin overview panels', () => {
  it('updates activity totals when the time range changes', async () => {
    const now = new Date(2026, 10, 7, 12)
    const rows = [
      {
        created_at: new Date(2026, 10, 7, 10).getTime() / 1000,
        count: 3,
        token_used: 30,
      },
      {
        created_at: new Date(2026, 9, 30, 10).getTime() / 1000,
        count: 7,
        token_used: 70,
      },
    ]
    render(
      <ActivityTrendPanel
        rows={rows}
        now={now}
        loading={false}
        rates={null}
        ratesLoading={false}
      />
    )
    expect(screen.getByText('30')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: '30 days' }))
    expect(screen.getByText('100')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Today' }))
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('shows the measured minute rates independently of the selected usage period', () => {
    render(
      <ActivityTrendPanel
        rows={[]}
        now={new Date(2026, 10, 7, 12)}
        loading={false}
        rates={{ rpm: 4, tpm: 125 }}
        ratesLoading={false}
      />
    )
    expect(screen.getByText(/Requests per minute/)).toHaveTextContent('4')
    expect(screen.getByText(/Tokens per minute/)).toHaveTextContent('125')
  })

  it('does not present unavailable minute rates as zero', () => {
    render(
      <ActivityTrendPanel
        rows={[]}
        now={new Date(2026, 10, 7, 12)}
        loading={false}
        rates={null}
        ratesLoading={false}
      />
    )
    expect(screen.getByText(/Requests per minute/)).toHaveTextContent('—')
    expect(screen.getByText(/Tokens per minute/)).toHaveTextContent('—')
  })
  it('uses all models for token shares and groups the remaining models', () => {
    render(<ModelUsagePanel models={models} loading={false} />)
    expect(screen.getByText('model-a').closest('li')).toHaveTextContent('40%')
    expect(screen.getByText('Other').closest('li')).toHaveTextContent('5%')
  })

  it('calculates the top model share from tokens rather than quota', () => {
    render(
      <TopModelsPanel
        models={models.slice(0, 2)}
        totalTokens={100}
        loading={false}
      />
    )
    expect(screen.getByText('model-a').closest('li')).toHaveTextContent('40%')
  })

  it('calculates the daily average using elapsed days in the month', () => {
    render(
      <RevenuePanel
        points={[]}
        monthlyPoints={[]}
        revenueToday={0}
        revenueMonth={500000}
        revenueAllTime={null}
        revenueYesterday={undefined}
        daysElapsed={10}
        loading={false}
      />
    )
    expect(screen.getByText('Daily average').parentElement).toHaveTextContent(
      formatLogQuota(50000)
    )
  })
})
