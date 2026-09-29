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
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { LogStatCards } from '../log-stat-cards'

const quotaRows = [
  {
    model_name: 'gpt-test',
    created_at: 1767225600,
    count: 10,
    quota: 100,
    token_used: 200,
    prompt_tokens: 100,
    cache_tokens: 40,
    cache_creation_tokens: 5,
    cache_hit_count: 6,
  },
]

function renderCards() {
  render(<LogStatCards />)
}

function mockQuotaData(rows: typeof quotaRows | []) {
  return vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data: rows } } as never)
}

describe('log stat cards cache rate slot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
    localStorage.clear()
  })

  test('renders one merged cache card with read/creation rates and the hit rate', async () => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    mockQuotaData(quotaRows)
    renderCards()

    const title = await screen.findByText('Average cache read/creation rate')
    expect(title).toBeVisible()
    // One slot: the token rates share a value line, the request-count hit
    // rate rides along in the caption. Both arrive after the quota request
    // resolves, so query them asynchronously.
    expect(await screen.findByText('40.0% / 5.0%')).toBeVisible()
    expect(await screen.findByText('Read / creation · hit 60.0%')).toBeVisible()
  })

  test('shows 0 percent instead of a placeholder when the range has no usage', async () => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    mockQuotaData([])
    renderCards()

    await screen.findByText('Average cache read/creation rate')
    await waitFor(() => {
      expect(screen.getByText('0.0% / 0.0%')).toBeVisible()
    })
    expect(screen.getByText('Read / creation · hit 0.0%')).toBeVisible()
  })

  test('hides the cache card when the cache rate statistics feature is off', async () => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    useSystemConfigStore
      .getState()
      .setConfig({ cacheRateStatsEnabled: false })
    mockQuotaData(quotaRows)
    renderCards()

    await screen.findByText('Total Count')
    expect(
      screen.queryByText('Average cache read/creation rate')
    ).not.toBeInTheDocument()
  })

  test('renders a placeholder when the quota data request fails', async () => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    vi.spyOn(api, 'get').mockRejectedValue(new Error('request failed'))
    renderCards()

    const title = await screen.findByText('Average cache read/creation rate')
    expect(title).toBeVisible()
    await waitFor(() => {
      expect(screen.getAllByText('--').length).toBeGreaterThan(0)
    })
  })
})
