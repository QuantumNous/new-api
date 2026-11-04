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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { PricingFeedbackDialog } from '../components/pricing-feedback-dialog'
import {
  PRICING_FEEDBACK_DEFAULTS,
  pricingFeedbackSchema,
} from '../lib/feedback-schema'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <PricingFeedbackDialog />
    </QueryClientProvider>
  )
}

describe('pricing feedback schema', () => {
  it('rejects a price report without a model name', () => {
    const result = pricingFeedbackSchema.safeParse(PRICING_FEEDBACK_DEFAULTS)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['model'])
  })

  it('rejects a source link that is not http or https', () => {
    const result = pricingFeedbackSchema.safeParse({
      ...PRICING_FEEDBACK_DEFAULTS,
      model: 'gpt-6-luna',
      source_url: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['source_url'])
  })

  it('rejects an explanation longer than the server limit', () => {
    const result = pricingFeedbackSchema.safeParse({
      ...PRICING_FEEDBACK_DEFAULTS,
      kind: 'other',
      message: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('accepts a missing-model report with an https source', () => {
    const result = pricingFeedbackSchema.safeParse({
      ...PRICING_FEEDBACK_DEFAULTS,
      kind: 'model_missing',
      model: 'grok-5',
      source_url: 'https://docs.x.ai/docs/models',
    })
    expect(result.success).toBe(true)
  })
})

describe('pricing feedback dialog', () => {
  it('posts the report with an empty honeypot and closes on success', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: { stored: true } } })
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      screen.getByRole('button', {
        name: 'Report a wrong price or missing model',
      })
    )
    await user.type(screen.getByLabelText(/^Model/), 'claude-opus-5-5')
    await user.click(screen.getByRole('button', { name: 'Send report' }))

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0]?.[0]).toBe('/api/hw/pricing/feedback')
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      kind: 'price_wrong',
      model: 'claude-opus-5-5',
      website: '',
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Send report' })
      ).not.toBeInTheDocument()
    )
  })

  it('keeps the dialog open and sends nothing when the model is empty', async () => {
    const post = vi.spyOn(api, 'post')
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      screen.getByRole('button', {
        name: 'Report a wrong price or missing model',
      })
    )
    await user.click(screen.getByRole('button', { name: 'Send report' }))

    expect(await screen.findByText('Enter the model name')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Model/)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(post).not.toHaveBeenCalled()
  })
})
