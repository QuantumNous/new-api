// @ts-nocheck
import axios from 'axios'
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

test('analysis retries an aborted identical request without dedupe or global toast', async () => {
  const originalAdapter = api.defaults.adapter
  const captured = []
  let rejectFirst
  let resolveSecond
  api.defaults.adapter = (config) => {
    captured.push(config)
    if (captured.length === 1) {
      return new Promise((resolve, reject) => {
        rejectFirst = reject
      })
    }
    return new Promise((resolve) => {
      resolveSecond = resolve
    })
  }

  const filters = {
    start_timestamp: new Date('2024-01-01T00:00:00+08:00'),
    end_timestamp: new Date('2024-01-02T00:00:00+08:00'),
    time_granularity: 'day',
  }
  const firstController = new AbortController()
  const secondController = new AbortController()

  try {
    const first = getLogUsageAnalysis(
      filters,
      true,
      undefined,
      firstController.signal
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    firstController.abort()
    const second = getLogUsageAnalysis(
      filters,
      true,
      undefined,
      secondController.signal
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(captured).toHaveLength(2)
    expect(captured[0].disableDuplicate).toBe(true)
    expect(captured[0].skipErrorHandler).toBe(true)
    expect(captured[0].signal).toBe(firstController.signal)
    expect(captured[1].disableDuplicate).toBe(true)
    expect(captured[1].skipErrorHandler).toBe(true)
    expect(captured[1].signal).toBe(secondController.signal)

    rejectFirst(new axios.CanceledError('aborted analysis'))
    resolveSecond({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: captured[1],
    })
    await expect(first).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    await expect(second).resolves.toMatchObject({ success: true })
  } finally {
    api.defaults.adapter = originalAdapter
  }
})
