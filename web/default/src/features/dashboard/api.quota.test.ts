import { describe, expect, test } from 'bun:test'
import { api } from '@/lib/api'
import {
  QuotaSeriesError,
  getUserQuotaDataByUsers,
  getUserQuotaDates,
  unwrapQuotaSeries,
} from './api'
import { describeQuotaFailure, isAbortError, quotaFailureCode } from './lib'

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
