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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDrawingImage, getDrawingZip } from '../../api'
import type { DrawingBatch } from '../../types'
import { DrawingResult } from '../drawing-result'

vi.mock('../../api', () => ({
  getDrawingImage: vi.fn(),
  getDrawingZip: vi.fn(),
  drawingErrorMessage: () => 'Request failed',
}))
const expires = Math.floor(Date.now() / 1000) + 7200
const batch: DrawingBatch = {
  id: 'batch-1',
  model: 'gpt-image-2',
  group: 'default',
  ratio: '3:4',
  created_at: expires - 7200,
  expires_at: expires,
  items: Array.from({ length: 8 }, (_, index) => ({
    id: `image-${index}`,
    batch_id: 'batch-1',
    title: `Product ${index + 1}`,
    prompt: 'Product',
    position: index + 1,
    status: index === 4 ? 'failed' : 'succeeded',
    attempts: 1,
    request_id: '',
    error: '',
    mime: 'image/png',
    width: 864,
    height: 1152,
    expires_at: expires,
  })),
}
const props = {
  isLoading: false,
}
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.mocked(getDrawingImage).mockResolvedValue(
    new Blob(['image'], { type: 'image/png' })
  )
  vi.mocked(getDrawingZip).mockResolvedValue(new Blob(['zip']))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.useRealTimers()
})
describe('drawing results', () => {
  it('shows Ready before any batch exists', () => {
    render(<DrawingResult {...props} />)
    expect(screen.getByRole('status', { name: 'Ready' })).toBeInTheDocument()
  })
  it('keeps all eight positions including a failed image, and downloads the successful images as a ZIP', async () => {
    render(<DrawingResult {...props} batch={batch} />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(7))
    expect(screen.getAllByRole('button', { name: 'Download' })).toHaveLength(8)
    expect(
      screen.getAllByRole('button', { name: 'Download' })[4]
    ).toBeDisabled()
    expect(screen.queryByText('05 Product 5')).toBeNull()
    expect(screen.queryByText(/864.*1152/)).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Download as ZIP' }))
    await waitFor(() => expect(getDrawingZip).toHaveBeenCalledWith('batch-1'))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
  })
  it('uses the available result width for one image and keeps the compact grid for multiple images', async () => {
    const one: DrawingBatch = { ...batch, items: [batch.items[0]] }
    const { rerender } = render(<DrawingResult {...props} batch={one} />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    expect(screen.getByTestId('drawing-results')).toHaveAttribute(
      'data-layout',
      'single'
    )
    expect(screen.getByTestId('drawing-result-item')).toHaveClass(
      'w-full',
      'max-w-5xl'
    )

    rerender(<DrawingResult {...props} batch={batch} />)
    expect(screen.getByTestId('drawing-results')).toHaveAttribute(
      'data-layout',
      'grid'
    )
    expect(screen.getAllByTestId('drawing-result-item')[0]).not.toHaveClass(
      'max-w-5xl'
    )
  })
  it('removes an expired preview and disables further downloads without refreshing the page', async () => {
    vi.useFakeTimers()
    const one: DrawingBatch = {
      ...batch,
      items: [
        { ...batch.items[0], expires_at: Math.floor(Date.now() / 1000) + 2 },
      ],
    }
    render(<DrawingResult {...props} batch={one} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('img')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })
})
