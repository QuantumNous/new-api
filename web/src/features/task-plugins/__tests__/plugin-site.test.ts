/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { usePluginSiteStore } from '@/stores/plugin-site-store'

import {
  fetchFromPluginSite,
  PLUGIN_SITE_FALLBACK_MS,
  PLUGIN_SITE_TIMEOUT_MS,
} from '../lib/plugin-site'

const AI_INDEX = 'https://www.newapi.ai/api/v1/community/index.json?x=1'
const PRO_INDEX = 'https://www.newapi.pro/api/v1/community/index.json?x=1'

/** newapi.ai never answers; newapi.pro answers at once. */
function aiUnreachable() {
  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (String(input).startsWith('https://www.newapi.ai/')) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        })
      }
      return Promise.resolve(new Response('pro'))
    }
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const requested = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([input]) => String(input))

beforeEach(() => {
  usePluginSiteStore.setState({ site: 'auto', fallbackUntil: 0 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  usePluginSiteStore.setState({ site: 'auto', fallbackUntil: 0 })
})

describe('fetchFromPluginSite', () => {
  test('newapi.ai answering in time is used and nothing is remembered', async () => {
    const fetchMock = vi.fn(async () => new Response('ai'))
    vi.stubGlobal('fetch', fetchMock)

    const response = await fetchFromPluginSite(AI_INDEX, { cache: 'no-cache' })

    expect(await response.text()).toBe('ai')
    expect(requested(fetchMock)).toEqual([AI_INDEX])
    expect(usePluginSiteStore.getState().fallbackUntil).toBe(0)
  })

  test('newapi.ai silent for 10 seconds switches to newapi.pro for a day', async () => {
    vi.useFakeTimers({ now: 1_000_000 })
    const fetchMock = aiUnreachable()

    const pending = fetchFromPluginSite(AI_INDEX, { cache: 'no-cache' })
    await vi.advanceTimersByTimeAsync(PLUGIN_SITE_TIMEOUT_MS - 1)
    expect(requested(fetchMock)).toEqual([AI_INDEX])
    await vi.advanceTimersByTimeAsync(1)

    expect(await (await pending).text()).toBe('pro')
    expect(requested(fetchMock)).toEqual([AI_INDEX, PRO_INDEX])
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: 'no-cache' })
    expect(usePluginSiteStore.getState().fallbackUntil).toBe(
      1_000_000 + PLUGIN_SITE_TIMEOUT_MS + PLUGIN_SITE_FALLBACK_MS
    )
  })

  test('within the remembered day requests go straight to newapi.pro, after it newapi.ai again', async () => {
    vi.useFakeTimers({ now: 5_000 })
    usePluginSiteStore.setState({ fallbackUntil: 5_000 + 60_000 })
    const fetchMock = vi.fn(async () => new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)

    await fetchFromPluginSite(AI_INDEX)
    vi.setSystemTime(5_000 + 60_000)
    await fetchFromPluginSite(AI_INDEX)

    expect(requested(fetchMock)).toEqual([PRO_INDEX, AI_INDEX])
  })

  test('choosing newapi.pro by hand never asks newapi.ai and forgets the automatic switch', async () => {
    usePluginSiteStore.setState({ fallbackUntil: Date.now() + 60_000 })
    usePluginSiteStore.getState().setSite('pro')
    const fetchMock = vi.fn(async () => new Response('pro'))
    vi.stubGlobal('fetch', fetchMock)

    await fetchFromPluginSite(AI_INDEX)

    expect(requested(fetchMock)).toEqual([PRO_INDEX])
    expect(usePluginSiteStore.getState()).toMatchObject({
      site: 'pro',
      fallbackUntil: 0,
    })
  })

  test('an error status from newapi.ai is an answer and does not switch sites', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await fetchFromPluginSite(AI_INDEX)

    expect(response.status).toBe(404)
    expect(requested(fetchMock)).toEqual([AI_INDEX])
    expect(usePluginSiteStore.getState().fallbackUntil).toBe(0)
  })

  test('a slow download after newapi.ai answered is not cut off', async () => {
    vi.useFakeTimers()
    let finish: (value: string) => void = () => undefined
    const body = new Promise<string>((resolve) => {
      finish = resolve
    })
    // Headers arrive at once; the body takes much longer than 10 seconds.
    const fetchMock = vi.fn(
      async () => ({ text: () => body }) as unknown as Response
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await fetchFromPluginSite(AI_INDEX)
    await vi.advanceTimersByTimeAsync(PLUGIN_SITE_TIMEOUT_MS * 3)
    finish('late body')

    expect(await response.text()).toBe('late body')
    expect(requested(fetchMock)).toEqual([AI_INDEX])
    expect(usePluginSiteStore.getState().fallbackUntil).toBe(0)
  })

  test('a request cancelled by the page is not treated as newapi.ai being down', async () => {
    aiUnreachable()
    const controller = new AbortController()

    const pending = fetchFromPluginSite(AI_INDEX, { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toThrow()
    expect(usePluginSiteStore.getState().fallbackUntil).toBe(0)
  })

  test('requests cut off by leaving the page do not switch sites', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    window.dispatchEvent(new Event('pagehide'))
    try {
      await expect(fetchFromPluginSite(AI_INDEX)).rejects.toThrow(
        'Failed to fetch'
      )
      expect(usePluginSiteStore.getState().fallbackUntil).toBe(0)
    } finally {
      window.dispatchEvent(new Event('pageshow'))
    }
  })

  test('newapi.ai refusing the connection switches to newapi.pro at once', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://www.newapi.ai/')) {
        throw new TypeError('Failed to fetch')
      }
      return new Response('pro')
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await (await fetchFromPluginSite(AI_INDEX)).text()).toBe('pro')
    expect(requested(fetchMock)).toEqual([AI_INDEX, PRO_INDEX])
    expect(usePluginSiteStore.getState().fallbackUntil).toBeGreaterThan(
      Date.now()
    )
  })

  test('other addresses are fetched unchanged even with newapi.pro chosen', async () => {
    usePluginSiteStore.getState().setSite('pro')
    const fetchMock = vi.fn(async () => new Response('raw'))
    vi.stubGlobal('fetch', fetchMock)
    const github =
      'https://raw.githubusercontent.com/QuantumNous/new-api-plugins/main/index.json'

    await fetchFromPluginSite(github)

    expect(requested(fetchMock)).toEqual([github])
  })
})
