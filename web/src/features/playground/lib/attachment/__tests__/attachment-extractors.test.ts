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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  extractTextFromBytes,
  truncateAttachmentText,
} from '../attachment-extractors'

const FIXTURES = join(__dirname, 'fixtures')

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)))
}

describe('extractTextFromBytes', () => {
  it('extracts PDF page text', async () => {
    const text = await extractTextFromBytes(fixture('sample.pdf'), 'pdf')

    expect(text).toContain('Attachment text extraction')
    expect(text).toContain('Page one body')
  })

  it('reports the page number ahead of each page body', async () => {
    const text = await extractTextFromBytes(fixture('sample.pdf'), 'pdf')

    expect(text.startsWith('Page 1')).toBe(true)
    expect(text).toContain('Page 2')
    expect(text.indexOf('Page 1')).toBeLessThan(text.indexOf('Page one body'))
    expect(text.indexOf('Page one body')).toBeLessThan(text.indexOf('Page 2'))
  })

  it('extracts DOCX paragraph text', async () => {
    const text = await extractTextFromBytes(fixture('sample.docx'), 'docx')

    expect(text).toContain('Quarterly report')
    expect(text).toContain('Revenue grew by 12 percent.')
    expect(text).toContain('retention up')
  })

  it('supplies the input shape both mammoth builds expect', async () => {
    // mammoth picks its reader from the package `browser` field: the browser
    // build reads `arrayBuffer`, the Node build (used here) reads `buffer`.
    // Dropping either key silently breaks one of the two builds, so assert the
    // argument we hand over carries both.
    const mammoth = (await import('mammoth')).default
    const original = mammoth.extractRawText
    let received: Record<string, unknown> | undefined

    mammoth.extractRawText = (async (input: Record<string, unknown>) => {
      received = input

      return original.call(mammoth, input as never)
    }) as unknown as typeof mammoth.extractRawText

    try {
      await extractTextFromBytes(fixture('sample.docx'), 'docx')
    } finally {
      mammoth.extractRawText = original
    }

    expect(received?.arrayBuffer).toBeInstanceOf(ArrayBuffer)
    expect(received?.buffer).toBeInstanceOf(ArrayBuffer)
  })

  it('extracts XLSX sheets as labelled CSV', async () => {
    const text = await extractTextFromBytes(fixture('sample.xlsx'), 'xlsx')

    expect(text).toContain('## Q1')
    expect(text).toContain('Region,Revenue')
    expect(text).toContain('North,1200')
  })

  it('resolves shared strings in XLSX cells', async () => {
    const text = await extractTextFromBytes(fixture('sample.xlsx'), 'xlsx')

    // Values live in sharedStrings.xml, not the sheet part.
    expect(text).not.toContain('<si>')
    expect(text).toMatch(/North,\s*\d/)
  })

  it('extracts PPTX slide text in slide order', async () => {
    const text = await extractTextFromBytes(fixture('sample.pptx'), 'pptx')

    expect(text).toContain('## Slide 1')
    expect(text).toContain('Roadmap 2026')
    expect(text).toContain('## Slide 2')
    expect(text).toContain('Thanks')
    expect(text.indexOf('Roadmap 2026')).toBeLessThan(text.indexOf('Thanks'))
  })

  it('falls back to plain text decoding for source files', async () => {
    const bytes = new TextEncoder().encode('const answer = 42\n')

    expect(await extractTextFromBytes(bytes, 'ts')).toBe('const answer = 42\n')
  })

  it('strips a UTF-8 BOM from plain text', async () => {
    const bytes = new Uint8Array([
      0xef, 0xbb, 0xbf,
      ...new TextEncoder().encode('héllo'),
    ])

    expect(await extractTextFromBytes(bytes, 'txt')).toBe('héllo')
  })

  it('rejects a corrupt PDF instead of returning junk', async () => {
    await expect(
      extractTextFromBytes(fixture('corrupt.pdf'), 'pdf')
    ).rejects.toThrow()
  })

  it('rejects a corrupt XLSX instead of returning junk', async () => {
    await expect(
      extractTextFromBytes(fixture('corrupt.xlsx'), 'xlsx')
    ).rejects.toThrow()
  })
})

describe('truncateAttachmentText', () => {
  it('collapses runs of blank lines', () => {
    const result = truncateAttachmentText('a\n\n\n\n\nb', 100)

    expect(result.text).toBe('a\n\nb')
    expect(result.truncated).toBe(false)
  })

  it('keeps text under the limit untouched', () => {
    const result = truncateAttachmentText('short', 100)

    expect(result).toEqual({ text: 'short', truncated: false })
  })

  it('marks and trims text over the limit', () => {
    const result = truncateAttachmentText('x'.repeat(200), 50)

    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(50)
    expect(result.text.endsWith('[...]')).toBe(true)
  })

  it('never exceeds the limit even when the suffix barely fits', () => {
    const result = truncateAttachmentText('x'.repeat(200), 3)

    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(3)
  })

  it('returns empty text for a zero limit rather than the suffix alone', () => {
    const result = truncateAttachmentText('content', 0)

    expect(result.text).toBe('')
    expect(result.truncated).toBe(true)
  })
})
