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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'

import type { ApiKey } from '../../types'
import { ApiKeysProvider, useApiKeys } from '../api-keys-provider'
import { DataTableRowActions } from '../data-table-row-actions'
import { CCSwitchDialog } from '../dialogs/cc-switch-dialog'

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
})

function ExportDialog(): React.ReactNode {
  const context = useApiKeys()
  return (
    <CCSwitchDialog
      open={context.open === 'cc-switch'}
      onOpenChange={(open) => !open && context.setOpen(null)}
      tokenKey={context.resolvedKey}
    />
  )
}

function renderActions(
  chats: Record<string, string>[] = [
    { 'First chat': 'https://first.example/?key={key}' },
    { 'Second chat': 'https://second.example/?key={key}' },
  ]
): void {
  queryClient.setQueryData(['status'], {
    chats,
    server_address: 'https://api.example',
  })
  queryClient.setQueryData(['user-models-ccswitch'], {
    success: true,
    data: ['test-model'],
  })
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
          <ExportDialog />
        </ApiKeysProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

describe('API key export actions', () => {
  test('shows both export buttons directly and keyboard activation opens choices without exporting to a default chat', async () => {
    const user = userEvent.setup()
    const request = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { success: true, data: { key: 'export-secret' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    api.defaults.adapter = request
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderActions()
    const chat = screen.getByRole('button', { name: 'Chat (Export to)' })

    expect(chat).toBeVisible()
    expect(screen.getByRole('button', { name: 'Export to CCS' })).toBeVisible()
    expect(chat).toHaveAttribute('aria-expanded', 'false')
    act(() => chat.focus())
    await user.keyboard('{Enter}')

    expect(chat).toHaveAttribute('aria-expanded', 'true')
    expect(
      await screen.findByRole('menuitem', { name: 'First chat' })
    ).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Second chat' })).toBeVisible()
    expect(request).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  test('keeps CC Switch available when no chat presets are configured', () => {
    renderActions([])

    expect(
      screen.queryByRole('button', { name: 'Chat (Export to)' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export to CCS' })).toBeVisible()
  })

  test('opens the CC Switch import dialog after resolving the selected API key', async () => {
    const user = userEvent.setup()
    let respond: (value: { success: boolean; data: { key: string } }) => void
    const response = new Promise<{ success: boolean; data: { key: string } }>(
      (resolve) => {
        respond = resolve
      }
    )
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
    renderActions()

    await user.click(screen.getByRole('button', { name: 'Export to CCS' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await act(async () =>
      respond({ success: true, data: { key: 'export-secret' } })
    )

    expect(
      await screen.findByRole('dialog', { name: 'Import to CC Switch' })
    ).toBeVisible()
  })
})
