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
import {
  ATTACHMENT_KINDS,
  isImageExtension,
  isSupportedImageMediaType,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
} from './attachment-constants'
import type { AttachmentKind } from '../../types'

export class AttachmentExtractionError extends Error {
  constructor(code: string, options?: { cause?: unknown }) {
    super(code, options)
    this.name = 'AttachmentExtractionError'
  }
}

export function getAttachmentExtension(filename: string): string {
  const match = /\.([^.]+)$/.exec(filename.trim().toLowerCase())

  return match?.[1] ?? ''
}

/**
 * Resolve how an attachment is sent upstream: images become image parts,
 * supported documents become extracted text, anything else is rejected.
 */
export function getAttachmentKind(
  filename: string,
  mediaType: string
): AttachmentKind | null {
  const extension = getAttachmentExtension(filename)

  if (isImageExtension(extension)) {
    return ATTACHMENT_KINDS.IMAGE
  }
  if (SUPPORTED_ATTACHMENT_EXTENSIONS.includes(extension)) {
    return ATTACHMENT_KINDS.DOCUMENT
  }

  // No usable extension — an unnamed clipboard or screenshot payload, for
  // instance. Fall back to the MIME type, but only for an image whose type we
  // can actually label: the bytes are forwarded unchanged, so labelling them as
  // something else would hand a decoder a format it cannot read.
  const type = mediaType.trim().toLowerCase()
  if (type.startsWith('image/') && isSupportedImageMediaType(type)) {
    return ATTACHMENT_KINDS.IMAGE
  }

  return null
}

export function isSupportedAttachment(
  filename: string,
  mediaType: string
): boolean {
  return getAttachmentKind(filename, mediaType) !== null
}

export function decodePlainText(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  return text.replace(/^\uFEFF/, '')
}
