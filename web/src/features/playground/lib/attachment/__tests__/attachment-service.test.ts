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

/** A file whose bytes cannot be read, to exercise the read-failure path. */
function unreadableFile(name: string, type: string): File {
  const file = fakeFile(name, type)
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.reject(new Error('read failed')),
  })

  return file
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

  it('treats an image extension as an image when the MIME type is missing', async () => {
    // Browsers do not always report a type — a pasted or drag-and-dropped file
    // can arrive with an empty one. The extension is then the only signal, and
    // without it these files would be filed as documents and have their binary
    // bytes decoded as text context instead of being sent as images.
    for (const filename of ['photo.heic', 'photo.heif', 'photo.avif']) {
      const [attachment] = await parseAttachments([fakeFile(filename, '')])

      expect(attachment.kind).toBe('image')
      expect(attachment.dataUrl).toMatch(/^data:/)
      expect(attachment.text).toBeUndefined()
    }
  })

  it('treats an image extension as an image when the MIME type is not an image', async () => {
    for (const filename of ['photo.png', 'photo.jpg', 'photo.webp']) {
      const [attachment] = await parseAttachments([
        fakeFile(filename, 'application/octet-stream'),
      ])

      expect(attachment.kind).toBe('image')
      expect(attachment.text).toBeUndefined()
    }
  })

  it('labels the data URL with the resolved image type when the MIME type is missing', async () => {
    // FileReader embeds file.type verbatim, so an empty type would produce
    // `data:;base64,...`. The metadata and the data URL must agree, otherwise
    // the attachment claims one type while the payload sent upstream declares
    // another (or none at all).
    const [attachment] = await parseAttachments([fakeFile('photo.heic', '')])

    expect(attachment.mediaType).toBe('image/heic')
    expect(attachment.dataUrl).toMatch(/^data:image\/heic;base64,/)
  })

  it('labels the data URL with the extension type when the MIME type disagrees', async () => {
    // A wrong-but-present type must not survive into the data URL either. The
    // extension decides both fields, so they cannot disagree with each other.
    const [attachment] = await parseAttachments([
      fakeFile('photo.png', 'application/octet-stream'),
    ])

    expect(attachment.mediaType).toBe('image/png')
    expect(attachment.dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('keeps metadata and data URL type consistent for a correct MIME type', async () => {
    const [attachment] = await parseAttachments([
      fakeFile('photo.jpg', 'image/jpeg', 'binary-ish'),
    ])

    expect(attachment.mediaType).toBe('image/jpeg')
    expect(attachment.dataUrl).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('falls back to image/png for an image extension it cannot map', async () => {
    // `getImageMediaType` must always return a usable type, so an extension the
    // map does not know still produces a well-formed data URL.
    const [attachment] = await parseAttachments([
      fakeFile('photo.tiff', 'image/tiff'),
    ])

    expect(attachment.kind).toBe('image')
    expect(attachment.mediaType).toBe('image/png')
    expect(attachment.dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('still parses a document extension with an empty MIME type', async () => {
    // The image check must not swallow document handling.
    const [attachment] = await parseAttachments([
      fakeFile('notes.txt', '', 'first line'),
    ])

    expect(attachment.kind).toBe('document')
    expect(attachment.text).toContain('first line')
  })

  it('rejects a file over the size limit', async () => {
    const oversized = fakeFile('big.txt', 'text/plain')
    Object.defineProperty(oversized, 'size', {
      value: MAX_ATTACHMENT_BYTES + 1,
    })

    const code = await expectError(parseAttachments([oversized]))

    expect(code).toBe(ATTACHMENT_ERRORS.FILE_TOO_LARGE)
  })

  it('reports a read failure when document bytes cannot be read', async () => {
    const code = await expectError(
      parseAttachments([unreadableFile('notes.txt', 'text/plain')])
    )

    expect(code).toBe(ATTACHMENT_ERRORS.READ_FAILED)
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
