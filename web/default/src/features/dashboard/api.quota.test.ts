import { describe, expect, test } from 'bun:test'
import { api } from '@/lib/api'
import {
  QuotaSeriesError,
  getLogUsageAnalysis,
  getUserQuotaDataByUsers,
  getUserQuotaDates,
  unwrapQuotaSeries,
} from './api'
import { describeQuotaFailure, isAbortError, quotaFailureCode } from './lib'
import { DASHBOARD_MAX_TIMESTAMP, DashboardRangeError } from './lib/range'

// 2026-07-01 00:00:42 through 2026-08-05 11:07:45 Asia/Shanghai.
const REPORTED_START = 1782835242
const REPORTED_END = 1785899265

interface CapturedRequest {
  url: string
  params: Record<string, unknown>
  signal?: AbortSignal
  disableDuplicate?: boolean
  skipErrorHandler?: boolean
}

interface StubConfig {
  params?: Record<string, unknown>
  signal?: AbortSignal
  disableDuplicate?: boolean
  skipErrorHandler?: boolean
}

async function withCapturedGet(
  respond: (request: CapturedRequest) => unknown,
  run: (captured: CapturedRequest[]) => Promise<void>
): Promise<void> {
  const originalGet = api.get
  const captured: CapturedRequest[] = []
  api.get = (async (url: string, config?: StubConfig) => {
    const request: CapturedRequest = {
      url,
      params: config?.params ?? {},
      signal: config?.signal,
      disableDuplicate: config?.disableDuplicate,
      skipErrorHandler: config?.skipErrorHandler,
    }
    captured.push(request)
    return { data: respond(request) }
  }) as unknown as typeof api.get
  try {
    await run(captured)
  } finally {
    api.get = originalGet
  }
}

const okResponse = { success: true, data: [{ quota: 1 }] }

describe('quota series requests carry the caller AbortSignal', () => {
  test('getUserQuotaDates forwards the signal to the HTTP client', async () => {
    const controller = new AbortController()
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        await getUserQuotaDates(
          {
            start_timestamp: REPORTED_START,
            end_timestamp: REPORTED_END,
            default_time: 'hour',
          },
          false,
          controller.signal
        )

        expect(captured).toHaveLength(1)
        expect(captured[0].url).toBe('/api/data/self')
        // Checking signal.aborted locally is not enough: the signal has to
        // reach the transport so the request is actually cancelled.
        expect(captured[0].signal).toBe(controller.signal)
        expect(captured[0].disableDuplicate).toBe(true)
        expect(captured[0].skipErrorHandler).toBe(true)
      }
    )
  })

  test('the admin endpoint forwards the signal too', async () => {
    const controller = new AbortController()
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        await getUserQuotaDates(
          { start_timestamp: REPORTED_START, end_timestamp: REPORTED_END },
          true,
          controller.signal
        )
        expect(captured[0].url).toBe('/api/data')
        expect(captured[0].signal).toBe(controller.signal)
      }
    )
  })

  test('getUserQuotaDataByUsers forwards the TanStack Query signal', async () => {
    const controller = new AbortController()
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        await getUserQuotaDataByUsers(
          { start_timestamp: REPORTED_START, end_timestamp: REPORTED_END },
          controller.signal
        )
        expect(captured[0].url).toBe('/api/data/users')
        expect(captured[0].signal).toBe(controller.signal)
      }
    )
  })

  test('an already aborted signal is still handed to the client', async () => {
    const controller = new AbortController()
    controller.abort()
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        await getUserQuotaDates(
          { start_timestamp: REPORTED_START, end_timestamp: REPORTED_END },
          false,
          controller.signal
        )
        expect(captured[0].signal?.aborted).toBe(true)
      }
    )
  })
})

describe('a refused quota query is never presented as an empty range', () => {
  test('unwrapQuotaSeries throws on success:false instead of returning []', () => {
    let thrown: unknown
    try {
      unwrapQuotaSeries({
        success: false,
        data: [],
        message: '查询时间跨度不能超过 90 天',
        code: 'dashboard_range_too_large',
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(QuotaSeriesError)
    expect(describeQuotaFailure(thrown)).toBe('查询时间跨度不能超过 90 天')
    expect(quotaFailureCode(thrown)).toBe('dashboard_range_too_large')
  })

  test('an undefined payload is a failure, not an empty range', () => {
    expect(() => unwrapQuotaSeries(undefined)).toThrow()
  })

  test('a successful empty range is data, not a failure', () => {
    expect(unwrapQuotaSeries({ success: true, data: [] })).toEqual([])
  })

  test('a successful range returns its rows', () => {
    expect(
      unwrapQuotaSeries({ success: true, data: [{ quota: 5 } as never] })
    ).toEqual([{ quota: 5 }])
  })

  test('an HTTP 400 body is described from the server message and code', () => {
    const httpError = {
      name: 'AxiosError',
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: {
          success: false,
          message: '请选择有效的查询时间范围',
          code: 'dashboard_range_invalid',
        },
      },
    }
    expect(describeQuotaFailure(httpError)).toBe('请选择有效的查询时间范围')
    expect(quotaFailureCode(httpError)).toBe('dashboard_range_invalid')
  })

  test('an unrecognised failure still yields a non-empty message', () => {
    expect(describeQuotaFailure({}, 'fallback')).toBe('fallback')
    expect(describeQuotaFailure(null, 'fallback')).toBe('fallback')
  })

  test('cancellations are recognised so they stay silent', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true)
    expect(isAbortError({ name: 'CanceledError' })).toBe(true)
    expect(isAbortError({ code: 'ERR_CANCELED' })).toBe(true)
    expect(isAbortError({ name: 'AxiosError' })).toBe(false)
    expect(isAbortError(null)).toBe(false)
  })
})

describe('the reported cross-month range still reaches the server', () => {
  test('the 35 day selection is sent with both bounds', async () => {
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        await getUserQuotaDates(
          {
            start_timestamp: REPORTED_START,
            end_timestamp: REPORTED_END,
            default_time: 'hour',
          },
          false
        )
        expect(captured[0].params.start_timestamp).toBe(REPORTED_START)
        expect(captured[0].params.end_timestamp).toBe(REPORTED_END)
        expect(
          Number(captured[0].params.end_timestamp) -
            Number(captured[0].params.start_timestamp)
        ).toBeGreaterThan(31 * 24 * 60 * 60)
      }
    )
  })
})

// Mirrors the exact promise chain the stat-card panel runs, so the
// clear -> error -> recover sequence is asserted end to end rather than
// assumed. (The repository has no DOM test runner; the component wiring
// itself is covered by tsc plus this contract.)
describe('quota panel state transitions', () => {
  interface PanelState {
    rows: unknown[] | null
    error: string
  }

  async function loadInto(
    state: PanelState,
    respond: () => unknown,
    signal: AbortSignal
  ) {
    await withCapturedGet(respond, async () => {
      await getUserQuotaDates(
        { start_timestamp: REPORTED_START, end_timestamp: REPORTED_END },
        false,
        signal
      )
        .then((res) => {
          if (signal.aborted) return
          const data = unwrapQuotaSeries(res)
          state.rows = data
          state.error = ''
        })
        .catch((loadError: unknown) => {
          if (signal.aborted) return
          if (isAbortError(loadError)) return
          state.rows = null
          state.error = describeQuotaFailure(loadError)
        })
    })
  }

  test('a refused range clears the numbers and shows an error, then recovers', async () => {
    const controller = new AbortController()
    const state: PanelState = { rows: [{ quota: 500 }], error: '' }

    await loadInto(
      state,
      () => ({
        success: false,
        data: [],
        message: '查询时间跨度不能超过 90 天',
        code: 'dashboard_range_too_large',
      }),
      controller.signal
    )

    // Not a zeroed statistic: rows are invalidated and the reason is shown.
    expect(state.rows).toBeNull()
    expect(state.error).toBe('查询时间跨度不能超过 90 天')

    await loadInto(
      state,
      () => ({ success: true, data: [{ quota: 42 }] }),
      controller.signal
    )

    expect(state.rows).toEqual([{ quota: 42 }])
    expect(state.error).toBe('')
  })

  test('an aborted panel load leaves the previous numbers untouched', async () => {
    const controller = new AbortController()
    const state: PanelState = { rows: [{ quota: 7 }], error: '' }
    controller.abort()

    await loadInto(
      state,
      () => ({ success: false, data: [] }),
      controller.signal
    )

    expect(state.rows).toEqual([{ quota: 7 }])
    expect(state.error).toBe('')
  })
})

// Every direct API helper must refuse an unusable bound BEFORE issuing a
// request. The assertion is the captured request count, not just the thrown
// error: a rejected range must cost zero network calls.
describe('invalid ranges never reach the network', () => {
  const DAY = 24 * 60 * 60

  const invalidRanges: Array<[string, number, number]> = [
    ['0/0', 0, 0],
    ['0/1', 0, 1],
    ['1/0', 1, 0],
    ['negative start', -1, REPORTED_END],
    ['negative end', REPORTED_START, -1],
    ['fractional start', REPORTED_START + 0.5, REPORTED_END],
    ['fractional end', REPORTED_START, REPORTED_START + 0.5],
    ['NaN start', Number.NaN, REPORTED_END],
    ['NaN end', REPORTED_START, Number.NaN],
    ['Infinity end', REPORTED_START, Number.POSITIVE_INFINITY],
    ['-Infinity start', Number.NEGATIVE_INFINITY, REPORTED_END],
    ['MAX_SAFE_INTEGER plus one', REPORTED_START, Number.MAX_SAFE_INTEGER + 1],
    ['past the safe upper bound', REPORTED_START, DASHBOARD_MAX_TIMESTAMP + 1],
    ['inverted', REPORTED_START, REPORTED_START - 1],
    [
      'ninety days plus one second',
      REPORTED_START,
      REPORTED_START + 90 * DAY + 1,
    ],
  ]

  for (const [name, start, end] of invalidRanges) {
    test(`getUserQuotaDates refuses ${name} without a request`, async () => {
      await withCapturedGet(
        () => okResponse,
        async (captured) => {
          let thrown: unknown
          try {
            await getUserQuotaDates(
              { start_timestamp: start, end_timestamp: end },
              false
            )
          } catch (error) {
            thrown = error
          }
          expect(captured).toHaveLength(0)
          expect(thrown).toBeInstanceOf(DashboardRangeError)
        }
      )
    })

    test(`getUserQuotaDataByUsers refuses ${name} without a request`, async () => {
      await withCapturedGet(
        () => okResponse,
        async (captured) => {
          let thrown: unknown
          try {
            await getUserQuotaDataByUsers({
              start_timestamp: start,
              end_timestamp: end,
            })
          } catch (error) {
            thrown = error
          }
          expect(captured).toHaveLength(0)
          expect(thrown).toBeInstanceOf(DashboardRangeError)
        }
      )
    })
  }

  // getLogUsageAnalysis takes Date objects, and computeTimeRange floors them to
  // whole seconds. A sub-second Date is therefore a legitimate instant, not a
  // malformed bound, so the fractional cases are excluded here and covered by
  // the flooring test below. Everything else must still cost zero requests.
  const invalidAnalysisRanges = invalidRanges.filter(
    ([name]) => !name.startsWith('fractional')
  )

  for (const [name, start, end] of invalidAnalysisRanges) {
    test(`getLogUsageAnalysis refuses ${name} without a request`, async () => {
      await withCapturedGet(
        () => okResponse,
        async (captured) => {
          const result = await getLogUsageAnalysis(
            {
              start_timestamp: new Date(start * 1000),
              end_timestamp: new Date(end * 1000),
              time_granularity: 'hour',
            },
            false
          )
          expect(captured).toHaveLength(0)
          expect(result.success).toBe(false)
          // Must not reuse the row-overflow code, which would trigger the
          // automatic dimension downgrade instead of a range message.
          expect(result.code).not.toBe('analysis_too_many_rows')
        }
      )
    })
  }

  test('a sub-second Date is floored to a whole second, not rejected', async () => {
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        const result = await getLogUsageAnalysis(
          {
            start_timestamp: new Date(REPORTED_START * 1000 + 500),
            end_timestamp: new Date(REPORTED_END * 1000 + 750),
            time_granularity: 'hour',
          },
          false
        )
        expect(result.success).toBe(true)
        expect(captured).toHaveLength(1)
        expect(captured[0].params.start_timestamp).toBe(REPORTED_START)
        expect(captured[0].params.end_timestamp).toBe(REPORTED_END)
        expect(Number.isSafeInteger(captured[0].params.start_timestamp)).toBe(
          true
        )
      }
    )
  })

  test('an invalid Date is refused without a request', async () => {
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        const result = await getLogUsageAnalysis(
          {
            start_timestamp: new Date(Number.NaN),
            end_timestamp: new Date(Number.NaN),
            time_granularity: 'hour',
          },
          false
        )
        expect(captured).toHaveLength(0)
        expect(result.success).toBe(false)
      }
    )
  })

  test('the reported 35 day range still costs exactly one request', async () => {
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        await getUserQuotaDates(
          { start_timestamp: REPORTED_START, end_timestamp: REPORTED_END },
          false
        )
        expect(captured).toHaveLength(1)
      }
    )
  })

  test('the exact safe upper bound is accepted and sent', async () => {
    await withCapturedGet(
      () => okResponse,
      async (captured) => {
        await getUserQuotaDates(
          {
            start_timestamp: DASHBOARD_MAX_TIMESTAMP - DAY,
            end_timestamp: DASHBOARD_MAX_TIMESTAMP,
          },
          false
        )
        expect(captured).toHaveLength(1)
        expect(captured[0].params.end_timestamp).toBe(DASHBOARD_MAX_TIMESTAMP)
      }
    )
  })
})
