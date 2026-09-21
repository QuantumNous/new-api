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
import { nanoid } from 'nanoid'

import {
  ATTACHMENT_ERRORS,
  ATTACHMENT_KINDS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_TEXT_CHARS,
  MAX_MESSAGE_CONTEXT_CHARS,
  getImageMediaType,
} from './attachment-constants'
import {
  AttachmentExtractionError,
  getAttachmentExtension,
  getAttachmentKind,
} from './attachment-file-utils'
import { extractTextFromBytes, truncateAttachmentText } from './attachment-extractors'
import type { PlaygroundAttachment } from '../../types'

function readFileAsDataUrl(
  file: File,
  mediaTypeOverride?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(
        mediaTypeOverride
          ? replaceDataUrlMediaType(result, mediaTypeOverride)
          : result
      )
    }
    reader.onerror = () => reject(new AttachmentExtractionError(ATTACHMENT_ERRORS.READ_FAILED))
    reader.readAsDataURL(file)
  })
}

/**
 * `FileReader.readAsDataURL` embeds `file.type` verbatim, so a file with no MIME
 * type yields `data:;base64,...`. Some providers reject that even though the
 * extension identifies the image, so the resolved type is written back in.
 */
function replaceDataUrlMediaType(dataUrl: string, mediaType: string): string {
  const marker = ';base64,'

  if (!dataUrl.startsWith('data:') || !dataUrl.includes(marker)) {
    return dataUrl
  }

  return `data:${mediaType}${dataUrl.slice(dataUrl.indexOf(marker))}`
}

async function buildImageAttachment(file: File): Promise<PlaygroundAttachment> {
  // The extension decided this file is an image, so it is also what labels it:
  // `file.type` can be empty, or present but wrong (a drag-and-dropped PNG can
  // report `application/octet-stream`). Using the extension for both the
  // metadata and the data URL keeps the two from describing different types.
  const mediaType = getImageMediaType(file.name)

  return {
    id: nanoid(),
    kind: ATTACHMENT_KINDS.IMAGE,
    filename: file.name,
    mediaType,
    size: file.size,
    dataUrl: await readFileAsDataUrl(file, mediaType),
  }
}

async function buildDocumentAttachment(
  file: File,
  limit: number
): Promise<PlaygroundAttachment> {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch (error) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.READ_FAILED, {
      cause: error,
    })
  }

  const { text, truncated } = truncateAttachmentText(
    await extractTextFromBytes(bytes, getAttachmentExtension(file.name)),
    Math.min(MAX_ATTACHMENT_TEXT_CHARS, limit)
  )

  return {
    id: nanoid(),
    kind: ATTACHMENT_KINDS.DOCUMENT,
    filename: file.name,
    mediaType: file.type || 'application/octet-stream',
    size: file.size,
    text,
    textTruncated: truncated,
  }
}

/** Document text already claimed by the attachments in `previous`. */
function getDocumentBudgetUsage(previous: PlaygroundAttachment[]): number {
  return previous.reduce(
    (total, attachment) => total + (attachment.text?.length ?? 0),
    0
  )
}

async function parseAttachment(
  file: File,
  previous: PlaygroundAttachment[]
): Promise<PlaygroundAttachment> {
  const kind = getAttachmentKind(file.name, file.type)

  if (kind === null) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.UNSUPPORTED_TYPE)
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.FILE_TOO_LARGE)
  }

  if (kind === ATTACHMENT_KINDS.IMAGE) {
    return buildImageAttachment(file)
  }

  const limit = Math.max(
    0,
    MAX_MESSAGE_CONTEXT_CHARS - getDocumentBudgetUsage(previous)
  )

  // An empty budget would yield a chip carrying no text, i.e. an attachment
  // that silently contributes nothing. Reject it instead so the user learns
  // the context is full rather than wondering why the model ignored the file.
  if (limit === 0) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.CONTEXT_FULL)
  }

  return buildDocumentAttachment(file, limit)
}

/**
 * Parse a batch of files, sharing one context budget across the batch.
 *
 * Rejects with the first `AttachmentExtractionError` so the caller can surface
 * a translated message; the files that did parse are dropped, matching how a
 * failed upload behaves elsewhere in the app.
 */
export async function parseAttachments(
  files: File[],
  existing: PlaygroundAttachment[] = []
): Promise<PlaygroundAttachment[]> {
  if (existing.length + files.length > MAX_ATTACHMENT_COUNT) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.TOO_MANY_FILES)
  }

  const parsed: PlaygroundAttachment[] = []
  for (const file of files) {
    const attachment = await parseAttachment(file, [...existing, ...parsed])
    parsed.push(attachment)
  }

  return parsed
}

export function getAttachmentPayloadSize(
  attachments: PlaygroundAttachment[]
): number {
  return attachments.reduce(
    (total, attachment) =>
      total + Math.max(attachment.dataUrl?.length ?? 0, attachment.text?.length ?? 0),
    0
  )
}
