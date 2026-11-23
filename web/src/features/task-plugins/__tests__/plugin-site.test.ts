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

import { fetchFromPluginSite } from '../lib/plugin-site'

const AI_INDEX = 'https://www.newapi.ai/api/v1/community/index.json?x=1'
const PRO_INDEX = 'https://www.newapi.pro/api/v1/community/index.json?x=1'

const requested = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([input]) => String(input))

beforeEach(() => {
  usePluginSiteStore.setState({ site: 'ai' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.removeItem('plugin-site')
  usePluginSiteStore.setState({ site: 'ai' })
})

describe('fetchFromPluginSite', () => {
  test('the main site is used as is and keeps the request options', async () => {
    const fetchMock = vi.fn(async () => new Response('ai'))
    vi.stubGlobal('fetch', fetchMock)

    const response = await fetchFromPluginSite(AI_INDEX, { cache: 'no-cache' })

    expect(await response.text()).toBe('ai')
    expect(requested(fetchMock)).toEqual([AI_INDEX])
    expect(fetchMock.mock.calls[0]).toEqual([AI_INDEX, { cache: 'no-cache' }])
  })

  test('the main site failing never switches to the backup site by itself', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchFromPluginSite(AI_INDEX)).rejects.toThrow(
      'Failed to fetch'
    )
    await expect(fetchFromPluginSite(AI_INDEX)).rejects.toThrow(
      'Failed to fetch'
    )

    expect(requested(fetchMock)).toEqual([AI_INDEX, AI_INDEX])
    expect(usePluginSiteStore.getState().site).toBe('ai')
  })

  test('with the backup site picked, newapi.ai addresses go to newapi.pro only', async () => {
    usePluginSiteStore.getState().setSite('pro')
    const fetchMock = vi.fn(async () => new Response('pro'))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal

    await fetchFromPluginSite(AI_INDEX, { cache: 'no-cache', signal })

    expect(fetchMock.mock.calls).toEqual([
      [PRO_INDEX, { cache: 'no-cache', signal }],
    ])
  })

  test('picking the main site again goes back to newapi.ai', async () => {
    usePluginSiteStore.getState().setSite('pro')
    usePluginSiteStore.getState().setSite('ai')
    const fetchMock = vi.fn(async () => new Response('ai'))
    vi.stubGlobal('fetch', fetchMock)

    await fetchFromPluginSite(AI_INDEX)

    expect(requested(fetchMock)).toEqual([AI_INDEX])
  })

  test('other addresses are fetched unchanged even with the backup site picked', async () => {
    usePluginSiteStore.getState().setSite('pro')
    const fetchMock = vi.fn(async () => new Response('raw'))
    vi.stubGlobal('fetch', fetchMock)
    const github =
      'https://raw.githubusercontent.com/QuantumNous/new-api-plugins/main/index.json'

    await fetchFromPluginSite(github)

    expect(requested(fetchMock)).toEqual([github])
  })
})

describe('saved site choice', () => {
  test.each([
    ['auto', 'ai'],
    ['pro', 'pro'],
  ])(
    'a choice saved as %s by the earlier version reads as %s',
    async (saved, expected) => {
      localStorage.setItem(
        'plugin-site',
        JSON.stringify({
          state: { site: saved, fallbackUntil: Date.now() + 60_000 },
          version: 0,
        })
      )

      await usePluginSiteStore.persist.rehydrate()

      expect(usePluginSiteStore.getState().site).toBe(expected)
      expect(usePluginSiteStore.getState()).not.toHaveProperty('fallbackUntil')
    }
  )
})
