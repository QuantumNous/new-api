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
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ImagePreviewDialog } from '../image-preview-dialog'

describe('ImagePreviewDialog', () => {
  it('keeps a tall image inside a bounded preview viewport', () => {
    render(
      <ImagePreviewDialog
        src='https://example.com/tall-image.png'
        alt='Tall generated image'
        onClose={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog')
    const image = screen.getByRole('img', { name: 'Tall generated image' })

    expect(dialog).toHaveClass('flex', 'h-[85vh]', 'overflow-hidden')
    expect(image).toHaveClass('max-h-full', 'max-w-full', 'object-contain')
  })
})
