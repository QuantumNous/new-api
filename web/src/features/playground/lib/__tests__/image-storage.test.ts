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

import type { Message } from '../../types'
import {
  extractInlineImages,
  isImageRef,
  resolveInlineImages,
} from '../storage/image-store'
import {
  clearPlaygroundData,
  loadMessages,
  saveMessages,
} from '../storage/storage'
import { MAX_STORED_IMAGE_BYTES } from '../storage/storage-schema'

function createImageMessage(url: string, key = 'user-1'): Message {
  return {
    key,
    from: 'user',
    versions: [{ id: `${key}-v1`, content: 'look at this' }],
    attachments: [{ url, mediaType: 'image/png', filename: 'shot.png' }],
    status: 'complete',
  }
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('playground inline image extraction', () => {
  it('replaces data urls with references and stores the payload once', () => {
    const dataUrl = 'data:image/png;base64,AAAA'
    const extraction = extractInlineImages([
      createImageMessage(dataUrl, 'user-1'),
      createImageMessage(dataUrl, 'user-2'),
    ])

    const refs = extraction.messages.map(
      (message) => message.attachments?.[0]?.url
    )
    expect(refs.every((ref) => ref && isImageRef(ref))).toBe(true)
    expect(refs[0]).toBe(refs[1])
    expect(Object.values(extraction.images)).toEqual([dataUrl])
  })

  it('keeps remote urls inline without storing them', () => {
    const extraction = extractInlineImages([
      createImageMessage('https://example.com/a.png'),
    ])

    expect(extraction.messages[0].attachments?.[0].url).toBe(
      'https://example.com/a.png'
    )
    expect(extraction.images).toEqual({})
  })

  it('drops images larger than the per-image budget', () => {
    const huge = `data:image/png;base64,${'A'.repeat(MAX_STORED_IMAGE_BYTES)}`
    const extraction = extractInlineImages([createImageMessage(huge)])

    expect(extraction.messages[0].attachments).toBeUndefined()
    expect(extraction.images).toEqual({})
  })

  it('drops references whose image is missing when resolving', () => {
    const extraction = extractInlineImages([
      createImageMessage('data:image/png;base64,AAAA'),
    ])

    const resolved = resolveInlineImages(extraction.messages, {})

    expect(resolved[0].attachments).toBeUndefined()
  })
})

describe('playground message persistence with images', () => {
  it('restores uploaded images after a reload', () => {
    const dataUrl = 'data:image/png;base64,BBBB'

    saveMessages([createImageMessage(dataUrl)])
    const loaded = loadMessages()

    expect(loaded?.[0].attachments?.[0].url).toBe(dataUrl)
  })

  it('keeps the conversation when the image payload cannot be stored', () => {
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === 'playground_images') {
        throw new DOMException('quota', 'QuotaExceededError')
      }
      originalSetItem.call(this, key, value)
    })

    saveMessages([createImageMessage('data:image/png;base64,CCCC')])
    vi.restoreAllMocks()

    const loaded = loadMessages()
    expect(loaded?.[0].versions[0].content).toBe('look at this')
    expect(loaded?.[0].attachments).toBeUndefined()
  })

  it('clears stored images together with the conversation', () => {
    saveMessages([createImageMessage('data:image/png;base64,DDDD')])

    clearPlaygroundData()

    expect(localStorage.getItem('playground_images')).toBeNull()
    expect(localStorage.getItem('playground_messages')).toBeNull()
  })
})
