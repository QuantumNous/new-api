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
import type { Row } from '@tanstack/react-table'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster, toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'

import type { ApiKey } from '../../types'
import { ApiKeysProvider } from '../api-keys-provider'
import { DataTableRowActions } from '../data-table-row-actions'

type KeyResponse = {
  success: boolean
  data?: { key: string }
  message?: string
}

const originalAdapter = api.defaults.adapter
let queryClient: QueryClient

beforeEach(() => {
  localStorage.clear()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  queryClient.clear()
  localStorage.clear()
  toast.dismiss()
  vi.unstubAllGlobals()
})

function renderActions(url = 'https://chat.example/import?key={key}') {
  queryClient.setQueryData(['status'], {
    chats: [{ 'Test chat': url }],
    server_address: 'https://api.example',
  })

  let respond: (value: KeyResponse) => void
  const response = new Promise<KeyResponse>((resolve) => {
    respond = resolve
  })
  api.defaults.adapter = async (config) => {
    expect(config.url).toBe('/api/token/7/key')
    return {
      data: await response,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }

  const row = {
    original: {
      id: 7,
      name: 'Export key',
      key: 'masked-key',
      status: 1,
      remain_quota: 100,
      used_quota: 0,
      unlimited_quota: false,
      expired_time: -1,
      created_time: 0,
      accessed_time: 0,
      model_limits_enabled: false,
    },
  } as Row<ApiKey>

  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ApiKeysProvider>
          <DataTableRowActions row={row} />
          <Toaster />
        </ApiKeysProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )

  return { respond: (value: KeyResponse) => respond(value) }
}

async function openPresetMenu(): Promise<HTMLElement> {
  const user = userEvent.setup()
  const exportButton = screen.queryByRole('button', {
    name: 'Chat (Export to)',
  })
  if (exportButton) {
    await user.click(exportButton)
  } else {
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Chat' }))
  }
  return screen.findByRole('menuitem', { name: 'Test chat' })
}

describe('API key chat export popup', () => {
  test('reserves the web tab during the click and navigates after the key resolves', async () => {
    const request = renderActions()
    const popup = {
      opener: window as Window | null,
      location: { href: '' },
      close: vi.fn(),
    }
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(popup as unknown as Window)
    const preset = await openPresetMenu()

    fireEvent.click(preset)

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(popup.location.href).toBe('')
    await act(async () =>
      request.respond({ success: true, data: { key: 'export-secret' } })
    )
    await waitFor(() =>
      expect(popup.location.href).toBe(
        'https://chat.example/import?key=sk-export-secret'
      )
    )
    expect(popup.opener).toBeNull()
    expect(popup.close).not.toHaveBeenCalled()
  })

  test('closes the reserved tab when the key request fails', async () => {
    const request = renderActions()
    const popup = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const preset = await openPresetMenu()

    fireEvent.click(preset)
    await act(async () =>
      request.respond({ success: false, message: 'Key unavailable' })
    )

    await waitFor(() => expect(popup.close).toHaveBeenCalled())
    expect(popup.location.href).toBe('')
  })

  test('reports a blocked popup while keeping the current page unchanged', async () => {
    const request = renderActions()
    vi.spyOn(window, 'open').mockReturnValue(null)
    const currentUrl = window.location.href
    const preset = await openPresetMenu()

    fireEvent.click(preset)
    await act(async () =>
      request.respond({ success: true, data: { key: 'export-secret' } })
    )

    expect(
      await screen.findByText(
        'Popup blocked. Please allow popups for this site.'
      )
    ).toBeVisible()
    expect(window.location.href).toBe(currentUrl)
  })

  test('launches a desktop protocol from the current page without creating a blank tab', async () => {
    const request = renderActions('cherry-studio://import?key={key}')
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const preset = await openPresetMenu()
    const location = { href: '' }
    vi.stubGlobal(
      'window',
      new Proxy(window, {
        get: (target, property) =>
          property === 'location'
            ? location
            : Reflect.get(target, property, target),
      })
    )

    fireEvent.click(preset)
    await act(async () =>
      request.respond({ success: true, data: { key: 'export-secret' } })
    )

    await waitFor(() =>
      expect(location.href).toBe('cherry-studio://import?key=sk-export-secret')
    )
    expect(open).not.toHaveBeenCalled()
  })
})
