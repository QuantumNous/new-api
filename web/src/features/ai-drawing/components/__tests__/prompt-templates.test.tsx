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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getDrawingTemplates, saveDrawingTemplate } from '../../api'
import { PromptTemplates } from '../prompt-templates'

vi.mock('../../api', () => ({
  getDrawingTemplates: vi.fn(),
  saveDrawingTemplate: vi.fn(),
  deleteDrawingTemplate: vi.fn(),
  drawingErrorMessage: () => 'Request failed',
}))
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: { auth: { user: { id: number } } }) => unknown
  ) => selector({ auth: { user: { id: 1 } } }),
}))
function TemplateForm() {
  const [value, setValue] = useState('Customer requirement')
  return (
    <>
      <PromptTemplates value={value} disabled={false} onApply={setValue} />
      <textarea
        aria-label='Current prompt'
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </>
  )
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <TemplateForm />
    </QueryClientProvider>
  )
}
afterEach(() => vi.clearAllMocks())
describe('saved prompt templates', () => {
  it('fills a saved template without losing the current requirement or changing the saved content', async () => {
    vi.mocked(getDrawingTemplates).mockResolvedValue([
      {
        id: 'saved',
        name: 'My product template',
        prompt: 'Reusable base',
        updated_at: 1,
      },
    ])
    mount()
    await waitFor(() => expect(getDrawingTemplates).toHaveBeenCalled())
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Prompt templates' }))
    await user.click(
      await screen.findByRole('option', { name: 'My product template' })
    )
    expect(screen.getByLabelText('Current prompt')).toHaveValue(
      'Reusable base\n\nCustomer requirement'
    )
    fireEvent.change(screen.getByLabelText('Current prompt'), {
      target: { value: 'Customized prompt' },
    })
    expect(saveDrawingTemplate).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit prompt template' })
    )
    expect(screen.getByLabelText('Template content')).toHaveValue(
      'Reusable base'
    )
  })
  it('saves the edited prompt with a name to the account', async () => {
    vi.mocked(getDrawingTemplates).mockResolvedValue([])
    vi.mocked(saveDrawingTemplate).mockResolvedValue({
      id: 'new',
      name: 'Reusable',
      prompt: 'Customer requirement',
      updated_at: 1,
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Save as template' }))
    fireEvent.change(screen.getByLabelText('Template name'), {
      target: { value: 'Reusable' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveDrawingTemplate).toHaveBeenCalledWith({
        name: 'Reusable',
        prompt: 'Customer requirement',
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
