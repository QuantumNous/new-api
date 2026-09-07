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
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ChannelsProvider } from '../../channels-provider'
import { FetchModelsDialog } from '../fetch-models-dialog'

function renderDialog(props: ComponentProps<typeof FetchModelsDialog>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ChannelsProvider>
          <FetchModelsDialog {...props} />
        </ChannelsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

describe('fetched model validation and unsaved selection', () => {
  it('removes dead models while retaining alive and uncertain selections', async () => {
    const user = userEvent.setup()
    const onModelsSelected = vi.fn()
    const customValidator = vi.fn().mockResolvedValue({
      success: true,
      data: {
        results: [
          { model: 'gpt-alive', status: 'alive', upstream_code: 200 },
          { model: 'gpt-dead', status: 'dead', upstream_code: 404 },
          { model: 'gpt-uncertain', status: 'uncertain', upstream_code: 429 },
        ],
        summary: { alive: 1, dead: 1, uncertain: 1 },
      },
    })
    renderDialog({
      open: true,
      onOpenChange: vi.fn(),
      customFetcher: async () => ['gpt-alive', 'gpt-dead', 'gpt-uncertain'],
      customValidator,
      existingModelsOverride: ['gpt-alive', 'gpt-dead', 'gpt-uncertain'],
      onModelsSelected,
    })

    await user.click(
      await screen.findByRole('button', { name: 'Validate Models' })
    )

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: 'gpt-dead' })
      ).not.toBeChecked()
    })
    expect(screen.getByRole('checkbox', { name: 'gpt-alive' })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'gpt-uncertain' })
    ).toBeChecked()
    expect(customValidator).toHaveBeenCalledWith([
      'gpt-alive',
      'gpt-dead',
      'gpt-uncertain',
    ])
    await user.click(screen.getByRole('button', { name: 'Save Models' }))
    expect(onModelsSelected).toHaveBeenCalledWith([
      'gpt-alive',
      'gpt-uncertain',
    ])
  })

  it('preserves current unsaved selections when preview results omit a selected model', async () => {
    const user = userEvent.setup()
    const onModelsSelected = vi.fn()
    renderDialog({
      open: true,
      onOpenChange: vi.fn(),
      customFetcher: async () => ['gpt-new'],
      existingModelsOverride: ['gpt-unsaved'],
      channelName: 'Unsaved channel',
      onModelsSelected,
    })

    await screen.findByRole('checkbox', { name: 'gpt-new' })
    expect(screen.getByText('Unsaved channel')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Validate Models' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save Models' }))
    expect(onModelsSelected).toHaveBeenCalledWith(['gpt-unsaved'])
  })

  it('keeps selected models after a validation service rejection', async () => {
    const user = userEvent.setup()
    const onModelsSelected = vi.fn()
    renderDialog({
      open: true,
      onOpenChange: vi.fn(),
      customFetcher: async () => ['gpt-selected'],
      customValidator: async () => {
        throw new Error('Validation unavailable')
      },
      existingModelsOverride: ['gpt-selected'],
      onModelsSelected,
    })

    await user.click(
      await screen.findByRole('button', { name: 'Validate Models' })
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Models' })).toBeEnabled()
    )
    expect(screen.getByRole('checkbox', { name: 'gpt-selected' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Save Models' }))
    expect(onModelsSelected).toHaveBeenCalledWith(['gpt-selected'])
  })
})
