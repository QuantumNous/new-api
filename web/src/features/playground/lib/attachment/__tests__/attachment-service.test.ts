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

import {
  ATTACHMENT_ERRORS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
} from '../attachment-constants'
import { AttachmentExtractionError } from '../attachment-file-utils'
import { parseAttachments } from '../attachment-service'
import type { PlaygroundAttachment } from '../../../types'

function fakeFile(
  name: string,
  type: string,
  content = 'hello world'
): File {
  return new File([content], name, { type })
}

function existingDocument(text: string): PlaygroundAttachment {
  return {
    id: 'doc-existing',
    kind: 'document',
    filename: 'existing.txt',
    mediaType: 'text/plain',
    size: text.length,
    text,
  }
}

async function expectError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AttachmentExtractionError) return error.message

    throw error
  }

  throw new Error('expected the parse to reject')
}

describe('parseAttachments', () => {
  it('parses a plain text file into a document attachment', async () => {
    const [attachment] = await parseAttachments([
      fakeFile('notes.txt', 'text/plain', 'first line\nsecond line'),
    ])

    expect(attachment.kind).toBe('document')
    expect(attachment.filename).toBe('notes.txt')
    expect(attachment.text).toContain('first line')
  })

  it('parses an image into a data URL attachment', async () => {
    const [attachment] = await parseAttachments([
      fakeFile('chart.png', 'image/png', 'binary-ish'),
    ])

    expect(attachment.kind).toBe('image')
    expect(attachment.dataUrl).toMatch(/^data:/)
  })

  it('rejects an unsupported extension', async () => {
    const code = await expectError(
      parseAttachments([fakeFile('archive.zip', 'application/zip')])
    )

    expect(code).toBe(ATTACHMENT_ERRORS.UNSUPPORTED_TYPE)
  })

  it('rejects a file over the size limit', async () => {
    const oversized = fakeFile('big.txt', 'text/plain')
    Object.defineProperty(oversized, 'size', {
      value: MAX_ATTACHMENT_BYTES + 1,
    })

    const code = await expectError(parseAttachments([oversized]))

    expect(code).toBe(ATTACHMENT_ERRORS.FILE_TOO_LARGE)
  })

  it('rejects a batch that exceeds the attachment count', async () => {
    const files = Array.from({ length: MAX_ATTACHMENT_COUNT + 1 }, (_, i) =>
      fakeFile(`f${i}.txt`, 'text/plain')
    )

    const code = await expectError(parseAttachments(files))

    expect(code).toBe(ATTACHMENT_ERRORS.TOO_MANY_FILES)
  })

  it('rejects a document once the shared context budget is exhausted', async () => {
    // The budget is already spent, so a further document would store empty
    // text and silently contribute nothing. It must fail loudly instead.
    const existing = [existingDocument('x'.repeat(60_000))]

    const code = await expectError(
      parseAttachments([fakeFile('late.txt', 'text/plain')], existing)
    )

    expect(code).toBe(ATTACHMENT_ERRORS.CONTEXT_FULL)
  })

  it('keeps images attachable even when the text budget is spent', async () => {
    // Images travel as image parts, not extracted text, so they are not
    // subject to the text budget.
    const existing = [existingDocument('x'.repeat(60_000))]

    const [attachment] = await parseAttachments(
      [fakeFile('photo.png', 'image/png')],
      existing
    )

    expect(attachment.kind).toBe('image')
  })

  it('shares one budget across a multi-file batch', async () => {
    const long = 'y'.repeat(30_000)
    const parsed = await parseAttachments([
      fakeFile('a.txt', 'text/plain', long),
      fakeFile('b.txt', 'text/plain', long),
    ])

    // 30k + 30k exceeds the 60k message budget only if not truncated, so at
    // least one document must be marked truncated rather than silently cut.
    expect(parsed).toHaveLength(2)
    expect(parsed.some((attachment) => attachment.textTruncated)).toBe(true)
  })
})
