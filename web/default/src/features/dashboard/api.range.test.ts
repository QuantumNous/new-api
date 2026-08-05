// @ts-nocheck
import { expect, test } from 'bun:test'
import { api } from '@/lib/api'
import { getLogUsageAnalysis, getUserQuotaDates } from './api'
import { DashboardRangeError } from './lib/range'

const DAY = 24 * 60 * 60
// 2026-07-01 00:00:42 through 2026-08-05 11:07:45 Asia/Shanghai: the exact
// dashboard selection moni reported as rejected.
const REPORTED_START = new Date('2026-07-01T00:00:42+08:00')
const REPORTED_END = new Date('2026-08-05T11:07:45+08:00')

interface CapturedRequest {
  url: string
  params: Record<string, number | string>
}

async function withCapturedGet(
  run: (captured: CapturedRequest[]) => Promise<void>
): Promise<void> {
  const originalGet = api.get
  const captured: CapturedRequest[] = []
  api.get = (async (
    url: string,
    config?: { params?: CapturedRequest['params'] }
  ) => {
    captured.push({ url, params: config?.params ?? {} })
    return { data: { success: true, data: [] } }
  }) as unknown as typeof api.get
  try {
    await run(captured)
  } finally {
    api.get = originalGet
  }
}

test('the reported 35 day dashboard range is sent to the analysis endpoint', async () => {
  await withCapturedGet(async (captured) => {
    const result = await getLogUsageAnalysis(
      {
        start_timestamp: REPORTED_START,
        end_timestamp: REPORTED_END,
        time_granularity: 'hour',
      },
      false
    )

    expect(result.success).toBe(true)
    expect(captured).toHaveLength(1)
    expect(captured[0].url).toBe('/api/log/self/analysis')
    const span =
      Number(captured[0].params.end_timestamp) -
      Number(captured[0].params.start_timestamp)
    expect(span).toBeGreaterThan(31 * DAY)
    expect(captured[0].params.granularity).toBe('hour')
  })
})

test('an over-long analysis range is rejected without issuing a request', async () => {
  await withCapturedGet(async (captured) => {
    const start = new Date('2026-01-01T00:00:00+08:00')
    const end = new Date(start.getTime() + (90 * DAY + 1) * 1000)

    const result = await getLogUsageAnalysis(
      { start_timestamp: start, end_timestamp: end, time_granularity: 'day' },
      true
    )

    expect(captured).toHaveLength(0)
    expect(result.success).toBe(false)
    expect(result.code).toBe('dashboard_range_too_large')
    // Must not reuse the row-overflow code, which would trigger the automatic
    // dimension downgrade instead of telling the user to shorten the range.
    expect(result.code).not.toBe('analysis_too_many_rows')
    expect(result.message).toContain('90')
  })
})

test('the reported 35 day range reaches the quota series endpoint', async () => {
  await withCapturedGet(async (captured) => {
    await getUserQuotaDates(
      {
        start_timestamp: Math.floor(REPORTED_START.getTime() / 1000),
        end_timestamp: Math.floor(REPORTED_END.getTime() / 1000),
        default_time: 'hour',
      },
      false
    )

    expect(captured).toHaveLength(1)
    expect(captured[0].url).toBe('/api/data/self')
  })
})

test('an over-long quota series range throws before any request', async () => {
  await withCapturedGet(async (captured) => {
    const start = 1782835242
    let thrown: unknown
    try {
      await getUserQuotaDates(
        {
          start_timestamp: start,
          end_timestamp: start + 90 * DAY + 1,
          default_time: 'hour',
        },
        false
      )
    } catch (error) {
      thrown = error
    }

    expect(captured).toHaveLength(0)
    expect(thrown).toBeInstanceOf(DashboardRangeError)
    expect((thrown as DashboardRangeError).code).toBe(
      'dashboard_range_too_large'
    )
  })
})
