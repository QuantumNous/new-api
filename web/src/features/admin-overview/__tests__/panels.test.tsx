import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { formatLogQuota } from '@/lib/format'

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
