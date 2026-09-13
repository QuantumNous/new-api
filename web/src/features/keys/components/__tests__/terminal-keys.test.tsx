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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { ApiKey } from '../../types'
import { TerminalKeys } from '../terminal-keys'

function key(id: number, name = `key-${id}`): ApiKey {
  return {
    id,
    name,
    key: 'abcd**********efgh',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 1,
    accessed_time: 1,
    group: 'standard',
    auto_groups: [],
    cross_group_retry: false,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
  }
}

let keys: ApiKey[]
let failReveal: boolean
let failDelete: boolean
let keepDeletedKeys: boolean
let creates: number
let client: QueryClient
let originalAdapter: typeof api.defaults.adapter
const deleted: number[] = []

beforeEach(() => {
  keys = [key(1, 'existing')]
  failReveal = false
  failDelete = false
  keepDeletedKeys = false
  creates = 0
  deleted.length = 0
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60000 })
  client.setQueryData(
    ['pricing'],
    {
      vendors: [],
      data: [
        {
          id: 1,
          model_name: 'standard-model',
          quota_type: 0,
          model_ratio: 1,
          completion_ratio: 2,
          enable_groups: ['standard'],
        },
        {
          id: 2,
          model_name: 'cheap-model',
          quota_type: 0,
          model_ratio: 1,
          completion_ratio: 2,
          enable_groups: ['cheap'],
        },
      ],
      group_ratio: { standard: 1, cheap: 0.5 },
    },
    { updatedAt: Date.now() + 60000 }
  )
  originalAdapter = api.defaults.adapter
  api.defaults.adapter = async (config) => {
    const url = new URL(config.url ?? '', 'http://localhost')
    let data: unknown
    if (url.pathname === '/api/pricing') {
      throw new AxiosError(
        'Pricing disabled',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          data: { success: false, message: 'Pricing disabled' },
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config,
        }
      )
    } else if (url.pathname === '/api/user/self/groups') {
      data = {
        success: true,
        data: {
          standard: { desc: 'Standard lane', ratio: 1 },
          cheap: { desc: 'Cheap lane', ratio: 0.5 },
        },
      }
    } else if (config.method === 'get' && url.pathname === '/api/token/') {
      const page = Number(url.searchParams.get('p') ?? 1)
      const size = Number(url.searchParams.get('size') ?? 10)
      data = {
        success: true,
        data: {
          items: keys.slice((page - 1) * size, page * size),
          total: keys.length,
          page,
          page_size: size,
        },
      }
    } else if (config.method === 'post' && url.pathname === '/api/token/') {
      creates++
      const body = JSON.parse(config.data as string) as {
        name: string
        group: string
      }
      const created = { ...key(1000 + creates, body.name), group: body.group }
      keys = [created, ...keys]
      data = { success: true, data: created }
    } else if (
      config.method === 'post' &&
      /\/api\/token\/\d+\/key$/.test(url.pathname)
    ) {
      data = failReveal
        ? { success: false, message: 'Reveal unavailable' }
        : { success: true, data: { key: 'complete-test-key' } }
    } else if (
      config.method === 'post' &&
      url.pathname === '/api/token/batch'
    ) {
      const { ids } = JSON.parse(config.data as string) as { ids: number[] }
      if (failDelete) data = { success: false, message: 'Delete unavailable' }
      else {
        deleted.push(...ids)
        if (!keepDeletedKeys) {
          keys = keys.filter((item) => !ids.includes(item.id))
        }
        data = { success: true, data: ids.length }
      }
    } else if (
      config.method === 'delete' &&
      /^\/api\/token\/\d+\/?$/.test(url.pathname)
    ) {
      const id = Number(url.pathname.match(/\/(\d+)\/?$/)?.[1])
      keys = keys.filter((item) => item.id !== id)
      data = { success: true }
    } else {
      throw new Error(`Unexpected request: ${config.method} ${url.pathname}`)
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  client.clear()
})

function renderKeys() {
  render(
    <QueryClientProvider client={client}>
      <TerminalKeys />
    </QueryClientProvider>
  )
}

describe('terminal key management', () => {
  it('copies a complete existing key from its reveal endpoint after loading masks', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderKeys()
    const row = await screen.findByRole('row', { name: /existing/ })
    await user.click(within(row).getByRole('button', { name: /Copy/ }))
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith('sk-complete-test-key')
    )
  })

  it('refreshes a successfully created key when reveal fails and allows retry without creating twice', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    failReveal = true
    renderKeys()
    await screen.findByText('existing')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Model' }),
      'standard-model'
    )
    await user.click(screen.getByRole('button', { name: 'Create key' }))
    const row = await screen.findByRole('row', { name: /Daily key/ })
    expect(creates).toBe(1)
    failReveal = false
    await user.click(within(row).getByRole('button', { name: /Copy/ }))
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith('sk-complete-test-key')
    )
    expect(creates).toBe(1)
  })

  it('revokes keys beyond the first page', async () => {
    keys = Array.from({ length: 101 }, (_, index) => key(index + 1))
    const user = userEvent.setup()
    renderKeys()
    await screen.findByText('key-1')
    await user.click(
      screen.getByRole('button', { name: 'Revoke all active keys' })
    )
    expect(keys).toHaveLength(101)
    await user.click(
      screen.getByRole('button', { name: 'Delete', hidden: true })
    )
    await waitFor(() => expect(keys).toHaveLength(0))
    expect(new Set(deleted).size).toBe(101)
  })

  it('does not treat a business deletion failure as success', async () => {
    failDelete = true
    const user = userEvent.setup()
    renderKeys()
    await screen.findByText('existing')
    await user.click(
      screen.getByRole('button', { name: 'Revoke all active keys' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Delete', hidden: true })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Delete unavailable'
    )
    expect(keys).toHaveLength(1)
  })

  it('reports incomplete revocation when the server still lists active keys', async () => {
    keepDeletedKeys = true
    const user = userEvent.setup()
    renderKeys()
    await screen.findByText('existing')
    await user.click(
      screen.getByRole('button', { name: 'Revoke all active keys' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Delete', hidden: true })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to delete API keys'
    )
    expect(screen.getByText('existing')).toBeVisible()
  })

  it('only offers groups that support the chosen model and updates after model changes', async () => {
    const user = userEvent.setup()
    renderKeys()
    await screen.findByText('existing')
    const model = screen.getByRole('combobox', { name: 'Model' })
    await user.selectOptions(model, 'standard-model')
    expect(
      screen.queryByRole('button', { name: /Cheap lane/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Standard lane/ })
    ).toHaveAttribute('aria-pressed', 'true')
    await user.selectOptions(model, 'cheap-model')
    expect(
      screen.queryByRole('button', { name: /Standard lane/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cheap lane/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('waits for confirmation before revoking one key', async () => {
    const user = userEvent.setup()
    renderKeys()
    const row = await screen.findByRole('row', { name: /existing/ })

    await user.click(within(row).getByRole('button', { name: 'Revoke' }))

    expect(keys).toHaveLength(1)
    expect(
      screen.getByRole('alertdialog', { name: 'Delete 1 API key(s)?' })
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Delete', hidden: true })
    )
    await waitFor(() => expect(keys).toHaveLength(0))
  })
})

it('creates a key in an authorized group when the pricing endpoint returns 403', async () => {
  client.removeQueries({ queryKey: ['pricing'] })
  const user = userEvent.setup()
  renderKeys()
  await screen.findByText('existing')
  await waitFor(() =>
    expect(client.getQueryState(['pricing'])?.status).toBe('error')
  )
  const create = screen.getByRole('button', { name: 'Create key' })
  expect(create).toBeEnabled()
  await user.click(create)
  await waitFor(() => expect(creates).toBe(1))
  expect(keys[0].group).toBe('cheap')
})
