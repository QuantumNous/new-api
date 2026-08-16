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
  buildCaptureFileName,
  buildTextFileSnippet,
  isCameraCaptureSupported,
  isImageFile,
  isScreenCaptureSupported,
  isTextLikeFile,
  stopMediaStream,
} from '../input/attachment-capture'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('capture file names', () => {
  it('names screenshots with a sortable timestamp', () => {
    expect(
      buildCaptureFileName('screen', new Date('2026-02-03T04:05:06.700Z'))
    ).toBe('screenshot-2026-02-03_04-05-06.png')
  })

  it('names camera captures as photos', () => {
    expect(
      buildCaptureFileName('camera', new Date('2026-02-03T04:05:06.700Z'))
    ).toBe('photo-2026-02-03_04-05-06.png')
  })
})

describe('attachment classification', () => {
  it('treats images as image attachments', () => {
    expect(isImageFile(new File([''], 'a.png', { type: 'image/png' }))).toBe(
      true
    )
  })

  it('treats documents with a text extension as inlinable text', () => {
    expect(isTextLikeFile(new File([''], 'notes.md', { type: '' }))).toBe(true)
    expect(isTextLikeFile(new File([''], 'data.json', { type: '' }))).toBe(true)
  })

  it('rejects binary documents that models cannot consume', () => {
    expect(
      isTextLikeFile(new File([''], 'report.pdf', { type: 'application/pdf' }))
    ).toBe(false)
  })

  it('labels inlined text with its file name', () => {
    expect(buildTextFileSnippet('notes.md', ' hello \n')).toBe(
      'notes.md:\n```\nhello\n```'
    )
  })
})

describe('capture capability detection', () => {
  it('reports screen and camera capture as unavailable without media devices', () => {
    vi.stubGlobal('navigator', {})

    expect(isScreenCaptureSupported()).toBe(false)
    expect(isCameraCaptureSupported()).toBe(false)
  })

  it('reports capture as available when the browser exposes the apis', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getDisplayMedia: () => Promise.resolve(),
        getUserMedia: () => Promise.resolve(),
      },
    })

    expect(isScreenCaptureSupported()).toBe(true)
    expect(isCameraCaptureSupported()).toBe(true)
  })
})

describe('releasing media streams', () => {
  it('stops every track so the recording indicator disappears', () => {
    const stop = vi.fn()
    const stream = {
      getTracks: () => [{ stop }, { stop }],
    } as unknown as MediaStream

    stopMediaStream(stream)

    expect(stop).toHaveBeenCalledTimes(2)
  })

  it('ignores a missing stream', () => {
    expect(() => stopMediaStream(null)).not.toThrow()
  })
})
