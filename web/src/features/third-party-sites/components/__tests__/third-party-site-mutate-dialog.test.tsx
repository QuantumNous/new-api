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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { api } from '@/lib/api'

import { THIRD_PARTY_SITES_QUERY_KEY } from '../../constants'
import { THIRD_PARTY_SITE_FORM_DEFAULTS } from '../../lib/third-party-site-form'
import type { ThirdPartySite } from '../../types'
import { ThirdPartySiteMutateDialog } from '../third-party-site-mutate-dialog'

type User = ReturnType<typeof userEvent.setup>

const row: ThirdPartySite = {
  id: 5,
  name: 'Alpha',
  type: 'newapi',
  base_url: 'https://alpha.example.com',
  remote_user_id: 7,
  receivable_discount: 0.85,
  created_time: 1,
  updated_time: 1,
}

const createdSite = { ...row, receivable_discount: 1 }

const cacheText = (client: QueryClient) =>
  JSON.stringify([
    client
      .getQueryCache()
      .getAll()
      .map((query) => query.state),
    client
      .getMutationCache()
      .getAll()
      .map((mutation) => mutation.state),
  ])

let client: QueryClient
let onOpenChange: Mock<(open: boolean) => void>

function wrap(open: boolean, currentRow?: ThirdPartySite) {
  return (
    <QueryClientProvider client={client}>
      <ThirdPartySiteMutateDialog
        open={open}
        onOpenChange={onOpenChange}
        currentRow={currentRow}
      />
    </QueryClientProvider>
  )
}

async function setField(user: User, label: string, value: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  await user.type(input, value)
}

async function fillCreateForm(
  user: User,
  overrides: Record<string, string> = {}
) {
  const values: Record<string, string> = {
    Name: 'Alpha',
    'Site Base URL': 'https://alpha.example.com',
    'Remote User ID': '7',
    ApiKey: 'secret-create-key',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    await setField(user, label, value)
  }
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  onOpenChange = vi.fn()
})

describe('ThirdPartySiteMutateDialog', () => {
  it('creates a site with numeric fields and the default discount', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: createdSite },
    })
    const user = userEvent.setup()
    render(wrap(true))

    expect(screen.getByLabelText('Receivable Discount')).toHaveValue('1')
    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(post).toHaveBeenCalledWith('/api/third_party_site/', {
      name: 'Alpha',
      type: 'newapi',
      base_url: 'https://alpha.example.com',
      remote_user_id: 7,
      receivable_discount: 1,
      api_key: 'secret-create-key',
    })
    expect(cacheText(client)).not.toContain('secret-create-key')
    for (const mutation of client.getMutationCache().getAll()) {
      expect(mutation.state.variables).toBeUndefined()
    }
  })

  const baseUrlMessage =
    'Base URL must be an http or https address without credentials, query or fragment'
  const userIdMessage = 'Remote user ID must be a positive integer'
  const discountMessage =
    'Receivable discount must be greater than 0 and at most 1, with at most 4 decimal places'

  it.each([
    ['Name', '   ', 'Site name is required'],
    ['Site Base URL', 'https://example.com/?', baseUrlMessage],
    ['Site Base URL', 'ftp://example.com', baseUrlMessage],
    ['Remote User ID', '0', userIdMessage],
    ['Remote User ID', '7.5', userIdMessage],
    ['ApiKey', '   ', 'ApiKey is required'],
    ['Receivable Discount', '0', discountMessage],
    ['Receivable Discount', '0.12345', discountMessage],
    ['Receivable Discount', '1.0001', discountMessage],
    ['Receivable Discount', '0.0000000001', discountMessage],
    ['Receivable Discount', '0.85000000001', discountMessage],
  ])('blocks submit when %s is %j', async (label, value, message) => {
    const post = vi.spyOn(api, 'post')
    const user = userEvent.setup()
    render(wrap(true))

    await fillCreateForm(user, { [label]: value })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('accepts a comma as the decimal separator', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: createdSite },
    })
    const user = userEvent.setup()
    render(wrap(true))

    await fillCreateForm(user)
    await setField(user, 'Receivable Discount', '0,85')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(post).toHaveBeenCalledWith(
      '/api/third_party_site/',
      expect.objectContaining({ receivable_discount: 0.85 })
    )
  })

  it('accepts an http base URL', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: createdSite },
    })
    const user = userEvent.setup()
    render(wrap(true))

    await fillCreateForm(user, { 'Site Base URL': 'http://10.0.0.5:3000' })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(post).toHaveBeenCalledWith(
      '/api/third_party_site/',
      expect.objectContaining({ base_url: 'http://10.0.0.5:3000' })
    )
  })

  it('renders the ApiKey as a plain text field rather than a password field', () => {
    render(wrap(true))

    const input = screen.getByRole('textbox', { name: 'ApiKey' })
    expect(input).not.toHaveAttribute('type', 'password')
  })

  it('keeps autocomplete, spellcheck and autocorrect off on the ApiKey field', () => {
    render(wrap(true))

    const input = screen.getByLabelText('ApiKey')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
    expect(input).toHaveAttribute('autocapitalize', 'off')
    expect(input).toHaveAttribute('autocorrect', 'off')
  })

  it('prefills an edit and omits a blank ApiKey', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true, data: row },
    })
    const user = userEvent.setup()
    render(wrap(true, row))

    expect(
      screen.getByRole('dialog', { name: 'Edit Site' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Remote User ID')).toHaveValue('7')
    expect(screen.getByLabelText('Receivable Discount')).toHaveValue('0.85')
    expect(screen.getByLabelText('ApiKey')).toHaveValue('')
    expect(screen.getByLabelText('ApiKey')).toHaveAttribute(
      'placeholder',
      'Leave empty to keep unchanged'
    )

    await user.type(screen.getByLabelText('ApiKey'), '   ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(put).toHaveBeenCalled())
    const [url, payload] = put.mock.calls[0]
    expect(url).toBe('/api/third_party_site/5')
    expect(payload).toEqual({
      name: 'Alpha',
      type: 'newapi',
      base_url: 'https://alpha.example.com',
      remote_user_id: 7,
      receivable_discount: 0.85,
    })
    expect(payload).not.toHaveProperty('api_key')
  })

  it('replaces the ApiKey on edit when one is typed', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true, data: row },
    })
    const user = userEvent.setup()
    render(wrap(true, row))

    await user.type(screen.getByLabelText('ApiKey'), ' new-secret ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][1]).toHaveProperty('api_key', 'new-secret')
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(cacheText(client)).not.toContain('new-secret')
  })

  it('shows a server field error under that field', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        success: false,
        message: 'A site with this name already exists',
        message_key: 'A site with this name already exists',
        field: 'name',
      },
    })
    const user = userEvent.setup()
    render(wrap(true))

    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('A site with this name already exists')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('keeps the ApiKey out of the caches when the request fails', async () => {
    const config = {
      headers: new AxiosHeaders(),
      data: JSON.stringify({ api_key: 'secret-create-key' }),
    } as InternalAxiosRequestConfig
    vi.spyOn(api, 'post').mockRejectedValue(
      new AxiosError(
        'Request failed with status code 502',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        {
          status: 502,
          statusText: 'Bad Gateway',
          headers: {},
          config,
          data: {},
        }
      )
    )
    const user = userEvent.setup()
    render(wrap(true))

    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(client.getMutationCache().getAll()[0]?.state.status).toBe('error')
    )
    expect(cacheText(client)).not.toContain('secret-create-key')
    const failure = client.getMutationCache().getAll()[0].state.error as Error
    expect(failure.cause).toEqual({})
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('keeps the ApiKey out of the caches when a non-Axios error is thrown', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      Object.assign(new Error('boom'), {
        config: { data: JSON.stringify({ api_key: 'secret-create-key' }) },
      })
    )
    const user = userEvent.setup()
    render(wrap(true))

    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(client.getMutationCache().getAll()[0]?.state.status).toBe('error')
    )
    expect(cacheText(client)).not.toContain('secret-create-key')
    const failure = client.getMutationCache().getAll()[0].state.error as Error
    expect(failure.cause).toBeUndefined()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('announces the creation and marks the site list stale', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: createdSite },
    })
    const success = vi.spyOn(toast, 'success')
    const listKey = [...THIRD_PARTY_SITES_QUERY_KEY, { p: 1 }]
    client.setQueryData(listKey, { items: [] })
    const user = userEvent.setup()
    render(wrap(true))

    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith('Site created successfully')
    )
    await waitFor(() =>
      expect(client.getQueryState(listKey)?.isInvalidated).toBe(true)
    )
  })

  it('announces the update after saving an edit', async () => {
    vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true, data: row },
    })
    const success = vi.spyOn(toast, 'success')
    const user = userEvent.setup()
    render(wrap(true, row))

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith('Site updated successfully')
    )
  })

  it('starts clean after closing, including after an edit', async () => {
    const user = userEvent.setup()
    const view = render(wrap(true, row))
    view.rerender(wrap(false))
    view.rerender(wrap(true))

    expect(screen.getByLabelText('Name')).toHaveValue(
      THIRD_PARTY_SITE_FORM_DEFAULTS.name
    )
    expect(screen.getByLabelText('Site Base URL')).toHaveValue(
      THIRD_PARTY_SITE_FORM_DEFAULTS.base_url
    )
    expect(screen.getByLabelText('Remote User ID')).toHaveValue(
      THIRD_PARTY_SITE_FORM_DEFAULTS.remote_user_id
    )
    expect(screen.getByLabelText('ApiKey')).toHaveValue(
      THIRD_PARTY_SITE_FORM_DEFAULTS.api_key
    )
    expect(screen.getByLabelText('Receivable Discount')).toHaveValue(
      THIRD_PARTY_SITE_FORM_DEFAULTS.receivable_discount
    )
    expect(screen.getByLabelText('Type')).toHaveTextContent('Native NewAPI')

    await user.type(screen.getByLabelText('ApiKey'), 'leftover-secret')
    view.rerender(wrap(false))
    view.rerender(wrap(true))
    expect(screen.getByLabelText('ApiKey')).toHaveValue('')
  })
})
