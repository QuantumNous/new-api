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
import { beforeEach, describe, expect, it } from 'vitest'

import { loadMessages, saveMessages } from '../storage'
import { MESSAGE_ROLES, MESSAGE_STATUS } from '../../../constants'
import type { Message, PlaygroundAttachment } from '../../../types'

const DOCUMENT: PlaygroundAttachment = {
  id: 'doc-1',
  kind: 'document',
  filename: 'report.pdf',
  mediaType: 'application/pdf',
  size: 512,
  text: 'Revenue grew by 12 percent.',
}

const IMAGE: PlaygroundAttachment = {
  id: 'img-1',
  kind: 'image',
  filename: 'chart.png',
  mediaType: 'image/png',
  size: 2048,
  dataUrl: 'data:image/png;base64,AAAAAAAA',
}

function message(attachments: PlaygroundAttachment[]): Message {
  return {
    key: 'k-1',
    from: MESSAGE_ROLES.USER,
    status: MESSAGE_STATUS.COMPLETE,
    versions: [{ id: 'v-1', content: 'summarise this' }],
    attachments,
  }
}

describe('playground attachment persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips document text through localStorage', () => {
    saveMessages([message([DOCUMENT])])

    const loaded = loadMessages()
    const restored = loaded?.[0].attachments?.[0]

    expect(restored?.filename).toBe('report.pdf')
    expect(restored?.text).toBe('Revenue grew by 12 percent.')
  })

  it('never persists image data URLs', () => {
    saveMessages([message([IMAGE, DOCUMENT])])

    // Data URLs are orders of magnitude larger than the text payload and would
    // blow the localStorage quota, so they must not reach storage at all.
    const raw = localStorage.getItem('playground_messages') ?? ''

    expect(raw).not.toContain('data:image/png')
    expect(raw).toContain('Revenue grew by 12 percent.')
  })

  it('keeps image metadata after the payload is dropped', () => {
    saveMessages([message([IMAGE])])

    const restored = loadMessages()?.[0].attachments?.[0]

    // The chip still needs a name and size so a reloaded conversation is not
    // silently missing its attachments.
    expect(restored?.kind).toBe('image')
    expect(restored?.filename).toBe('chart.png')
    expect(restored?.dataUrl).toBeUndefined()
  })

  it('drops a document that lost all of its text to the storage budget', () => {
    // Once the payload budget is spent, a further document would persist as a
    // chip with no text — attached-looking but contributing nothing. It must
    // be dropped rather than reloaded as a decoy.
    const huge: PlaygroundAttachment = {
      ...DOCUMENT,
      id: 'doc-huge',
      filename: 'huge.pdf',
      text: 'z'.repeat(400_000),
    }
    const trailing: PlaygroundAttachment = {
      ...DOCUMENT,
      id: 'doc-trailing',
      filename: 'trailing.pdf',
      text: 'tail content',
    }

    saveMessages([message([huge, trailing])])

    const restored = loadMessages()?.[0].attachments ?? []

    // `huge` consumed the whole budget and is flagged; `trailing` has no text
    // left to keep, so only the oversized document survives.
    expect(restored.map((a) => a.filename)).toEqual(['huge.pdf'])
    expect(restored[0].textTruncated).toBeUndefined()
  })

  it('marks a partially stored document as truncated', () => {
    const partial: PlaygroundAttachment = {
      ...DOCUMENT,
      text: 'q'.repeat(500_000),
    }

    saveMessages([message([partial])])

    const restored = loadMessages()?.[0].attachments?.[0]

    expect(restored?.text).toHaveLength(400_000)
    expect(restored?.textTruncated).toBe(true)
  })

  it('preserves message text alongside attachments', () => {
    saveMessages([message([DOCUMENT])])

    const loaded = loadMessages()

    expect(loaded?.[0].versions[0].content).toBe('summarise this')
  })

  it('returns null when nothing has been stored', () => {
    expect(loadMessages()).toBeNull()
  })
})
