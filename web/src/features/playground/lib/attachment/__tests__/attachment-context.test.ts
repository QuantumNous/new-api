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
import { describe, expect, it } from 'vitest'

import { buildAttachedMessageContent } from '../attachment-context'
import type { PlaygroundAttachment } from '../../../types'

function image(overrides: Partial<PlaygroundAttachment> = {}): PlaygroundAttachment {
  return {
    id: 'img-1',
    kind: 'image',
    filename: 'photo.png',
    mediaType: 'image/png',
    size: 1024,
    dataUrl: 'data:image/png;base64,AAAA',
    ...overrides,
  }
}

function document(overrides: Partial<PlaygroundAttachment> = {}): PlaygroundAttachment {
  return {
    id: 'doc-1',
    kind: 'document',
    filename: 'report.pdf',
    mediaType: 'application/pdf',
    size: 2048,
    text: 'Revenue grew by 12 percent.',
    ...overrides,
  }
}

describe('buildAttachedMessageContent', () => {
  it('keeps plain text as a string when there are no attachments', () => {
    expect(buildAttachedMessageContent('hello')).toBe('hello')
    expect(buildAttachedMessageContent('hello', [])).toBe('hello')
  })

  it('wraps document text in a context block without changing the text part', () => {
    const content = buildAttachedMessageContent('summarise this', [document()])

    expect(typeof content).toBe('string')
    expect(content).toContain('summarise this')
    expect(content).toContain('<context>')
    expect(content).toContain('### Source: report.pdf')
    expect(content).toContain('<source>')
    expect(content).toContain('Revenue grew by 12 percent.')
  })

  it('emits image parts after the text part', () => {
    const content = buildAttachedMessageContent('what is this', [image()])

    expect(Array.isArray(content)).toBe(true)
    expect(content).toEqual([
      { type: 'text', text: 'what is this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    ])
  })

  it('combines images and documents into a single multipart message', () => {
    const content = buildAttachedMessageContent('describe', [
      image(),
      document(),
    ]) as Array<{ type: string; text?: string; image_url?: { url: string } }>

    expect(content).toHaveLength(2)
    expect(content[0].text).toContain('<context>')
    expect(content[0].text).toContain('Revenue grew by 12 percent.')
    expect(content[1].image_url?.url).toBe('data:image/png;base64,AAAA')
  })

  it('sends one image part per image', () => {
    const content = buildAttachedMessageContent('compare', [
      image({ id: 'a', dataUrl: 'data:image/png;base64,AAA' }),
      image({ id: 'b', dataUrl: 'data:image/png;base64,BBB' }),
    ]) as Array<{ image_url?: { url: string } }>

    expect(content).toHaveLength(3)
    expect(content[1].image_url?.url).toContain('AAA')
    expect(content[2].image_url?.url).toContain('BBB')
  })

  it('skips images whose payload was dropped by storage', () => {
    const content = buildAttachedMessageContent('hi', [
      image({ dataUrl: undefined }),
    ])

    expect(content).toBe('hi')
  })

  it('skips documents with blank text', () => {
    const content = buildAttachedMessageContent('hi', [
      document({ text: '   \n  ' }),
      document({ text: undefined }),
    ])

    expect(content).toBe('hi')
  })

  it('labels each document so multiple files stay distinguishable', () => {
    const content = buildAttachedMessageContent('compare', [
      document({ id: '1', filename: 'q1.pdf', text: 'first quarter' }),
      document({ id: '2', filename: 'q2.pdf', text: 'second quarter' }),
    ]) as string

    expect(content).toContain('### Source: q1.pdf')
    expect(content).toContain('### Source: q2.pdf')
    expect(content).toContain('first quarter')
    expect(content).toContain('second quarter')
  })

  it('sends an attachment-only message without a leading newline run', () => {
    const content = buildAttachedMessageContent('', [document()]) as string

    expect(content.startsWith('\n')).toBe(false)
    expect(content).toContain('Revenue grew by 12 percent.')
  })
})
