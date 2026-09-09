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
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { afterEach, expect, it, vi } from 'vitest'

import { SettingsPageProvider } from '@/features/system-settings/components/settings-page-context'
import { ModelPricingEditorPanel } from '@/features/system-settings/models/model-pricing-sheet'
import { ModelRatioForm } from '@/features/system-settings/models/model-ratio-form'
import { api } from '@/lib/api'

const clients: QueryClient[] = []
const originalColumnVisibility = localStorage.getItem(
  'model-ratio-column-visibility'
)

afterEach(() => {
  cleanup()
  for (const client of clients) client.clear()
  clients.length = 0
  if (originalColumnVisibility === null) {
    localStorage.removeItem('model-ratio-column-visibility')
  } else {
    localStorage.setItem(
      'model-ratio-column-visibility',
      originalColumnVisibility
    )
  }
})

function renderEditor(embedded = false) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: [], vendors: [] },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <ModelPricingEditorPanel
        embedded={embedded}
        editData={{
          name: 'example-model',
          billingMode: 'per-token',
          ratio: '3.25',
          completionRatio: '2',
          cacheRatio: '0.2',
        }}
        onSave={() => {}}
      />
    </QueryClientProvider>
  )
}

it('keeps the preview expanded and the save action outside the scrolling embedded form', () => {
  renderEditor(true)
  const scrollRegion = screen.getByRole('region', {
    name: 'Edit model pricing',
  })
  expect(scrollRegion).toHaveClass(
    'overflow-y-auto',
    'min-h-0',
    '@container/pricing-editor'
  )
  expect(
    within(scrollRegion).getByRole('complementary', { name: 'Preview' })
  ).toBeVisible()
  expect(
    within(scrollRegion).queryByRole('button', { name: 'Save model prices' })
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Save model prices' })
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Edit model pricing' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('textbox', { name: 'Model name' })
  ).not.toBeInTheDocument()
  expect(screen.getAllByText(/USD price per 1M tokens\./)).toHaveLength(1)
})

it('retains the model identity and heading when the editor is used standalone', () => {
  renderEditor()
  expect(
    screen.getByRole('heading', { name: 'Edit model pricing' })
  ).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Model name' })).toHaveValue(
    'example-model'
  )
  expect(screen.getByRole('textbox', { name: 'Model name' })).toBeDisabled()
})

it('updates the preview for explicit zero and disabled prices and explains dependent audio controls', async () => {
  renderEditor(true)
  const user = userEvent.setup()
  const preview = screen.getByRole('complementary', { name: 'Preview' })
  const cache = screen.getByRole('textbox', { name: 'Cache read price' })
  await user.clear(cache)
  await user.type(cache, '0')
  expect(within(preview).getByText('$0')).toBeVisible()
  await user.click(screen.getByRole('switch', { name: 'Cache read price' }))
  expect(cache).toBeDisabled()
  expect(within(preview).queryByText('$0')).not.toBeInTheDocument()
  const audio = screen.getByRole('switch', { name: 'Audio output price' })
  expect(audio).toHaveAttribute('aria-disabled', 'true')
  expect(audio).toHaveAccessibleDescription(
    'Audio output price requires an audio input price.'
  )
  await user.click(screen.getByRole('switch', { name: 'Audio input price' }))
  await user.type(
    screen.getByRole('textbox', { name: 'Audio input price' }),
    '1'
  )
  expect(audio).not.toHaveAttribute('aria-disabled', 'true')
})

function PricingFormFixture(props: {
  variant: 'default' | 'unset'
  onSave: () => Promise<void>
}) {
  const values = {
    ModelPrice: props.variant === 'default' ? '{"example-model":0.1}' : '{}',
    ModelRatio: '{}',
    CacheRatio: '{}',
    CreateCacheRatio: '{}',
    CompletionRatio: '{}',
    ImageRatio: '{}',
    AudioRatio: '{}',
    AudioCompletionRatio: '{}',
    BillingMode: '{}',
    BillingExpr: '{}',
    ExposeRatioEnabled: false,
  }
  const [actionsContainer, setActionsContainer] =
    useState<HTMLDivElement | null>(null)
  const form = useForm({ defaultValues: values })
  return (
    <>
      <header>
        <div ref={setActionsContainer} />
      </header>
      <SettingsPageProvider actionsContainer={actionsContainer}>
        <ModelRatioForm
          form={form}
          savedValues={values}
          variant={props.variant}
          onSave={props.onSave}
          onReset={() => undefined}
          isSaving={false}
          isResetting={false}
        />
      </SettingsPageProvider>
    </>
  )
}

it.each(['default', 'unset'] as const)(
  'keeps the %s pricing workspace shrinkable and saves from its fixed action bar',
  async (variant) => {
    const user = userEvent.setup()
    const save = vi.fn(async () => undefined)
    vi.spyOn(api, 'get').mockImplementation(async (url) => ({
      data: {
        success: true,
        data: url === '/api/channel/models_enabled' ? ['example-model'] : [],
        vendors: [],
      },
    }))
    localStorage.removeItem('model-ratio-column-visibility')
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    clients.push(client)
    render(
      <QueryClientProvider client={client}>
        <PricingFormFixture variant={variant} onSave={save} />
      </QueryClientProvider>
    )
    const workspace = screen.getByRole('region', { name: 'Model prices' })
    expect(workspace).toHaveClass(
      'flex-1',
      'min-h-0',
      'grid-rows-[minmax(0,1fr)]'
    )
    await waitFor(() => expect(client.isFetching()).toBe(0))
    if (variant === 'default') {
      const toggle = screen.getByRole('switch', { name: 'Expose ratio API' })
      expect(screen.getByRole('banner')).toContainElement(toggle)
      const help = within(screen.getByRole('banner')).getByRole('button', {
        name: 'Learn more',
      })
      await user.click(help)
      expect(screen.getByRole('dialog')).toHaveTextContent(
        'Allow clients to query configured prices via `/api/ratio`.'
      )
      expect(toggle).not.toBeChecked()
      await user.keyboard('{Escape}')
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      )
      expect(help).toHaveFocus()
      expect(toggle).toHaveAccessibleDescription(
        'Allow clients to query configured prices via `/api/ratio`.'
      )
      await user.click(toggle)
      expect(toggle).toBeChecked()
      await user.click(screen.getByRole('button', { name: 'Switch to JSON' }))
      expect(
        screen.getAllByRole('switch', { name: 'Expose ratio API' })
      ).toHaveLength(1)
      expect(
        screen.getByRole('switch', { name: 'Expose ratio API' })
      ).toBeChecked()
      await user.click(screen.getByRole('button', { name: 'Switch to Visual' }))
    } else {
      expect(
        screen.queryByRole('switch', { name: 'Expose ratio API' })
      ).not.toBeInTheDocument()
    }
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('tab', { name: 'Per-request' }))
    const price = screen.getByRole('textbox', { name: 'Fixed price' })
    await user.clear(price)
    await user.type(price, '0.25')
    const region = screen.getByRole('region', { name: 'Edit model pricing' })
    const button = screen.getByRole('button', { name: 'Save model prices' })
    expect(region).not.toContainElement(button)
    expect(button.parentElement?.parentElement).toHaveClass('shrink-0')
    await user.click(button)
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ ExposeRatioEnabled: variant === 'default' }),
      undefined
    )
  }
)
