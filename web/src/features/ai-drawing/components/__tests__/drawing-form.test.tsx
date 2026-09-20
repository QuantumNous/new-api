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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DrawingForm } from '../drawing-form'

vi.mock('../prompt-templates', () => ({ PromptTemplates: () => null }))

const FORM_PROPS = {
  models: [{ label: 'GPT Image', value: 'gpt-image-2' }],
  groups: [{ label: 'default', value: 'default', ratio: 1 }],
  model: 'gpt-image-2',
  group: 'default',
  isLoadingModels: false,
  isSubmitting: false,
  onModelChange: vi.fn(),
  onGroupChange: vi.fn(),
  onSubmit: vi.fn(),
}

describe('AI drawing form', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:source-image')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('focuses the prompt when the page opens', () => {
    render(<DrawingForm {...FORM_PROPS} />)

    expect(screen.getByLabelText('Prompt')).toHaveFocus()
  })

  it('shows a friendly ratio instead of provider pixel dimensions', () => {
    render(<DrawingForm {...FORM_PROPS} />)

    expect(screen.getByText('1:1 · Square')).toBeInTheDocument()
    expect(screen.queryByText('1024x1024')).toBeNull()
  })

  it('accepts an image dropped on the source image area', () => {
    render(<DrawingForm {...FORM_PROPS} />)
    const file = new File(['image'], 'source.png', { type: 'image/png' })

    fireEvent.drop(
      screen.getByRole('group', { name: 'Source image (optional)' }),
      { dataTransfer: { files: [file] } }
    )

    expect(
      screen.getByRole('img', { name: 'Source image preview' })
    ).toHaveAttribute('src', 'blob:source-image')
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeEnabled()
  })

  it.each(['gpt-image-2.5-2k', 'gpt-image-2.5-4k'])(
    'submits %s unchanged and resets an unsupported wide ratio',
    async (model) => {
      const user = userEvent.setup()
      const { rerender } = render(<DrawingForm {...FORM_PROPS} />)
      await user.click(screen.getByLabelText('Aspect ratio'))
      await user.click(
        await screen.findByRole('option', { name: '21:9 · Landscape' })
      )
      rerender(<DrawingForm {...FORM_PROPS} model={model} />)
      expect(screen.getByLabelText('Aspect ratio')).toHaveTextContent(
        '1:1 · Square'
      )
      await user.click(screen.getByLabelText('Aspect ratio'))
      expect(
        screen.queryByRole('option', { name: '21:9 · Landscape' })
      ).not.toBeInTheDocument()
      await user.keyboard('{Escape}')
      await user.type(screen.getByLabelText('Prompt'), 'Product')
      await user.click(screen.getByRole('button', { name: 'Generate image' }))
      await waitFor(() =>
        expect(FORM_PROPS.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ model, size: '1024x1024' })
        )
      )
    }
  )
})
