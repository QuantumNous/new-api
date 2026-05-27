import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  isCachedPerfMetricsFeatureAvailable,
  isPerfMetricsFeatureAvailable,
  isMissingPerfMetricsEndpoint,
  isPerfMetricsEndpointUnavailable,
  markPerfMetricsEndpointUnavailable,
} from './compat.ts'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

type BrowserStorage = {
  localStorage?: StorageLike
  sessionStorage?: StorageLike
}

const originalWindow = globalThis.window

function installBrowserStorage(storage: BrowserStorage): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: storage,
  })
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

describe('performance metrics endpoint compatibility', () => {
  test('disables perf metrics when status does not advertise backend support', () => {
    assert.equal(isPerfMetricsFeatureAvailable({}), false)
  })

  test('enables perf metrics when status advertises backend support', () => {
    assert.equal(
      isPerfMetricsFeatureAvailable({
        perf_metrics_setting: { enabled: true },
      }),
      true
    )
    assert.equal(
      isPerfMetricsFeatureAvailable({
        data: { perf_metrics_setting: '{"enabled":true}' },
      }),
      true
    )
  })

  test('reads cached perf metrics support from local storage', () => {
    installBrowserStorage({
      localStorage: {
        getItem: () => JSON.stringify({ perf_metrics_setting: { enabled: true } }),
        setItem: () => undefined,
      },
    })

    assert.equal(isCachedPerfMetricsFeatureAvailable(), true)
  })

  test('detects legacy backend invalid request response for perf metrics', () => {
    const error = {
      response: {
        status: 404,
        data: {
          error: {
            message: 'Invalid URL (GET /api/perf-metrics/summary)',
          },
        },
      },
    }

    assert.equal(isMissingPerfMetricsEndpoint(error), true)
  })

  test('does not treat unrelated 404 responses as missing perf metrics', () => {
    const error = {
      response: {
        status: 404,
        data: {
          error: {
            message: 'Invalid URL (GET /api/users/missing)',
          },
        },
      },
    }

    assert.equal(isMissingPerfMetricsEndpoint(error), false)
  })

  test('marks the perf metrics endpoint unavailable for the current browser session', () => {
    const values = new Map<string, string>()
    installBrowserStorage({
      sessionStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    })

    assert.equal(isPerfMetricsEndpointUnavailable(), false)

    markPerfMetricsEndpointUnavailable()

    assert.equal(isPerfMetricsEndpointUnavailable(), true)
  })
})
