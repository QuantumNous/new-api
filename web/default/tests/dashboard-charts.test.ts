import { describe, expect, test } from 'bun:test'

import {
  processChartData,
  processUserChartData,
} from '../src/features/dashboard/lib/charts'
import type { QuotaDataItem } from '../src/features/dashboard/types'

const sampleModelUsage: QuotaDataItem[] = [
  {
    created_at: 1_735_689_600,
    model_name: 'gpt-4o-mini',
    count: 3,
    quota: 1200,
    token_used: 800,
  },
]

describe('processChartData', () => {
  test('keeps the model trend chart type stable across loading and populated states', () => {
    const emptySpec = processChartData([], 'day').spec_model_line
    const populatedSpec = processChartData(sampleModelUsage, 'day').spec_model_line

    expect(emptySpec.type).toBe(populatedSpec.type)
  })

  test('disables point update animation for dashboard area charts', () => {
    const chartData = processChartData(sampleModelUsage, 'hour')
    const emptyChartData = processChartData([], 'hour')
    const userChartData = processUserChartData(sampleModelUsage, 'hour')
    const emptyUserChartData = processUserChartData([], 'hour')

    expect(chartData.spec_area.animationUpdate).toBe(false)
    expect(chartData.spec_model_line.animationUpdate).toBe(false)
    expect(emptyChartData.spec_area.animationUpdate).toBe(false)
    expect(emptyChartData.spec_model_line.animationUpdate).toBe(false)
    expect(userChartData.spec_user_trend.animationUpdate).toBe(false)
    expect(emptyUserChartData.spec_user_trend.animationUpdate).toBe(false)
  })
})
