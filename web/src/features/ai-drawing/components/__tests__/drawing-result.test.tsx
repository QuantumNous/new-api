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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DrawingResult } from '../drawing-result'

describe('AI drawing result panel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled()
  })

  it('downloads the generated image as a local blob', async () => {
    const user = userEvent.setup()
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:download')
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => new Blob(['image'], { type: 'image/png' }),
      })
    )
    render(
      <DrawingResult
        resultUrl='https://example.com/generated.png'
        isLoading={false}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => expect(clickSpy).toHaveBeenCalledOnce())
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:download')
  })
})
