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
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildAttachmentFileName,
  copyImageAttachment,
  downloadImageAttachment,
} from '../message/image-action-utils'

const PNG_BLOB = new Blob(['fake'], { type: 'image/png' })

function mockFetchOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, blob: async () => PNG_BLOB })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('attachment file names', () => {
  it('uses the original filename when available', () => {
    expect(
      buildAttachmentFileName({
        url: 'data:image/png;base64,AA',
        filename: 'shot.png',
      })
    ).toBe('shot.png')
  })

  it('derives the extension from the media type when unnamed', () => {
    expect(
      buildAttachmentFileName(
        { url: 'https://x/y', mediaType: 'image/jpeg' },
        1
      )
    ).toBe('image-2.jpg')
  })

  it('falls back to the data url media type when unnamed', () => {
    expect(buildAttachmentFileName({ url: 'data:image/webp;base64,AA' })).toBe(
      'image-1.webp'
    )
  })
})

describe('downloading an image attachment', () => {
  it('downloads through an object url instead of navigating to the data url', async () => {
    mockFetchOk()
    const createObjectURL = vi.fn().mockReturnValue('blob:local/1')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    await downloadImageAttachment(
      { url: 'data:image/png;base64,AA', filename: 'shot.png' },
      0
    )

    expect(createObjectURL).toHaveBeenCalledWith(PNG_BLOB)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local/1')
    expect(document.querySelector('a')).toBeNull()
  })

  it('rejects when the attachment cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(
      downloadImageAttachment({ url: 'https://example.com/missing.png' })
    ).rejects.toThrow()
  })
})

describe('copying an image attachment', () => {
  it('copies image data when the clipboard supports it', async () => {
    mockFetchOk()
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', class {})
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } })

    await expect(
      copyImageAttachment({ url: 'data:image/png;base64,AA' })
    ).resolves.toBe('image')
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('falls back to copying the url when image copy is unsupported', async () => {
    mockFetchOk()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(
      copyImageAttachment({ url: 'https://example.com/a.png' })
    ).resolves.toBe('url')
    expect(writeText).toHaveBeenCalledWith('https://example.com/a.png')
  })
})
