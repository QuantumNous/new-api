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
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { ModelSquareOrderDialog } from '../components/dialogs/model-square-order-dialog'

function mockApi(
  saved: Record<string, string>,
  usage: Record<string, { requests: number; tokens: number }> = {}
) {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/option/') {
      const data = Object.entries(saved).map(([key, value]) => ({
        key,
        value,
      }))
      return { data: { success: true, data } }
    }
    if (url === '/api/models/square_usage') {
      // Every square model, including ones only other groups can see
      const data = ['alpha', 'beta', 'gamma'].map((name) => ({
        model_name: name,
        vendor_name: 'Acme',
        requests: usage[name]?.requests ?? 0,
        tokens: usage[name]?.tokens ?? 0,
      }))
      return { data: { success: true, data } }
    }
    return { data: { success: true, data: {} } }
  })
  return vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
}

function renderDialog(onOpenChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <ModelSquareOrderDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return {
    rerender: (open: boolean) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <ModelSquareOrderDialog open={open} onOpenChange={onOpenChange} />
        </QueryClientProvider>
      ),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('model square order dialog', () => {
  it('keeps list edits as a draft and saves only the changed setting', async () => {
    const put = mockApi({
      'model_square_setting.sort_mode': 'manual',
      'model_square_setting.sort_models': '["beta","alpha"]',
    })
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      await screen.findByRole('button', { name: 'Move alpha up' })
    )
    await user.click(screen.getByRole('button', { name: 'Remove beta' }))
    await user.click(screen.getByRole('combobox', { name: 'Add model' }))
    await user.click(await screen.findByRole('option', { name: /gamma/ }))
    expect(screen.getByRole('button', { name: 'Remove gamma' })).toBeVisible()
    expect(put).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(put).toHaveBeenCalledWith('/api/option/', {
      key: 'model_square_setting.sort_models',
      value: '["alpha","gamma"]',
    })
  })

  it('shows one success toast for several changed settings', async () => {
    const put = mockApi({ 'model_square_setting.sort_mode': 'manual' })
    const success = vi.spyOn(toast, 'success')
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    renderDialog(onOpenChange)

    await user.click(await screen.findByRole('button', { name: 'Most used' }))
    await user.click(screen.getByRole('button', { name: 'Requests' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(put).toHaveBeenCalledTimes(2)
    expect(success).toHaveBeenCalledTimes(1)
    expect(success).toHaveBeenCalledWith('Setting updated successfully')
  })

  it('keeps the dialog and the draft open when saving fails', async () => {
    const put = mockApi({ 'model_square_setting.sort_mode': 'manual' })
    put.mockResolvedValueOnce({ data: { success: true } })
    put.mockResolvedValueOnce({
      data: { success: false, message: 'Invalid model square order setting' },
    })
    const success = vi.spyOn(toast, 'success')
    const error = vi.spyOn(toast, 'error')
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    renderDialog(onOpenChange)

    await user.click(await screen.findByRole('button', { name: 'Most used' }))
    await user.click(screen.getByRole('button', { name: 'Requests' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    expect(error).toHaveBeenCalledWith('Invalid model square order setting')
    expect(success).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Requests' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('discards the draft when the dialog is cancelled', async () => {
    const put = mockApi({ 'model_square_setting.sort_mode': 'manual' })
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    const dialog = renderDialog(onOpenChange)

    await user.click(await screen.findByRole('button', { name: 'Most used' }))
    expect(screen.getByRole('button', { name: 'Most used' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    dialog.rerender(false)
    dialog.rerender(true)

    expect(
      await screen.findByRole('button', { name: 'Manual order' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(put).not.toHaveBeenCalled()
  })

  it('ranks the other models by the chosen metric after the pinned ones', async () => {
    mockApi(
      {
        'model_square_setting.sort_mode': 'mixed',
        'model_square_setting.sort_metric': 'tokens',
        'model_square_setting.sort_models': '["beta"]',
      },
      {
        gamma: { requests: 3, tokens: 9000 },
        alpha: { requests: 8, tokens: 100 },
      }
    )
    const user = userEvent.setup()
    renderDialog()

    const others = await screen.findByRole('list', { name: 'Other models' })
    const rows = () => within(others).getAllByRole('listitem')
    expect(rows()).toHaveLength(2)
    expect(rows()[0]).toHaveTextContent(/^2.*gamma.*9K$/)
    expect(rows()[1]).toHaveTextContent(/^3.*alpha.*100$/)

    await user.click(screen.getByRole('button', { name: 'Requests' }))

    expect(rows()[0]).toHaveTextContent(/^2.*alpha.*8$/)
    expect(rows()[1]).toHaveTextContent(/^3.*gamma.*3$/)
  })

  it('says the order falls back to names when there is no usage', async () => {
    mockApi({ 'model_square_setting.sort_mode': 'usage' })
    renderDialog()

    expect(
      await screen.findByText('No usage data, so models are ordered by name.')
    ).toBeVisible()
  })
})
