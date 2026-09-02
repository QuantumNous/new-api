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
import { describe, expect, it } from 'vitest'

import { DrawingResult } from '../drawing-result'

describe('AI drawing result panel', () => {
  it('shows a ready state before generation starts', () => {
    render(<DrawingResult resultUrl='' isLoading={false} />)

    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })

  it('shows generation progress while waiting for the provider', () => {
    render(<DrawingResult resultUrl='' isLoading />)

    expect(screen.getByText('Generating image')).toBeInTheDocument()
  })

  it('shows the generated image and a download action', () => {
    render(
      <DrawingResult
        resultUrl='https://example.com/generated.png'
        isLoading={false}
      />
    )

    expect(
      screen.getByRole('img', { name: 'Generated image' })
    ).toHaveAttribute('src', 'https://example.com/generated.png')
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'href',
      'https://example.com/generated.png'
    )
  })
})
