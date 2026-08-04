// @ts-nocheck
import { expect, test } from 'bun:test'
import { api } from '@/lib/api'
import { buildLogUsageAnalysisParams, getLogUsageAnalysis } from './api'

test('admin analysis request carries the username filter', () => {
  const params = buildLogUsageAnalysisParams(
    {
      start_timestamp: new Date('2024-01-01T00:00:00+08:00'),
      end_timestamp: new Date('2024-01-02T00:00:00+08:00'),
      time_granularity: 'day',
      username: '  wanxin1  ',
    },
    true
  )

  expect(params.username).toBe('wanxin1')
  expect(params.dimensions).toBe('period,model_name')
})

test('self analysis does not forward the admin username filter', () => {
  const params = buildLogUsageAnalysisParams(
    {
      start_timestamp: new Date('2024-01-01T00:00:00+08:00'),
      end_timestamp: new Date('2024-01-02T00:00:00+08:00'),
      time_granularity: 'day',
      username: 'other-user',
    },
    false
  )

  expect(Object.prototype.hasOwnProperty.call(params, 'username')).toBe(false)
})

test('analysis API forwards the built username request parameter', async () => {
  const originalGet = api.get
  let captured: {
    url: string
    config: { params?: Record<string, unknown> }
  } | null = null
  api.get = (async (
    url: string,
    config: { params?: Record<string, unknown> }
  ) => {
    captured = { url, config }
    return { data: { success: true } }
  }) as typeof api.get

  try {
    await getLogUsageAnalysis(
      {
        start_timestamp: new Date('2024-01-01T00:00:00+08:00'),
        end_timestamp: new Date('2024-01-02T00:00:00+08:00'),
        time_granularity: 'day',
        username: '  wanxin1  ',
      },
      true
    )
  } finally {
    api.get = originalGet
  }

  expect(captured?.url).toBe('/api/log/analysis')
  expect(captured?.config.params?.username).toBe('wanxin1')
})
