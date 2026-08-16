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
import type { MessageAttachment } from '../../types'

const MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

export type ImageCopyResult = 'image' | 'url'

/**
 * Stable file name for downloading an attachment: keeps the original name when
 * present and otherwise derives an extension from the media type.
 */
export function buildAttachmentFileName(
  attachment: MessageAttachment,
  index = 0
): string {
  if (attachment.filename?.trim()) {
    return attachment.filename.trim()
  }

  const mediaType =
    attachment.mediaType ?? inferMediaTypeFromDataUrl(attachment.url)
  const extension = (mediaType && MIME_EXTENSIONS[mediaType]) || 'png'
  return `image-${index + 1}.${extension}`
}

function inferMediaTypeFromDataUrl(url: string): string | undefined {
  const match = /^data:([^;,]+)[;,]/.exec(url)
  return match?.[1]
}

async function fetchAttachmentBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('attachment-unavailable')
  }
  return response.blob()
}

/**
 * Download an attachment through an object URL so large data URLs never end up
 * in the address bar (which can hang or crash the tab).
 */
export async function downloadImageAttachment(
  attachment: MessageAttachment,
  index = 0
): Promise<void> {
  const blob = await fetchAttachmentBlob(attachment.url)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = buildAttachmentFileName(attachment, index)
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Copy an image to the clipboard, falling back to copying its URL when the
 * browser cannot put binary image data on the clipboard.
 */
export async function copyImageAttachment(
  attachment: MessageAttachment
): Promise<ImageCopyResult> {
  const canCopyImage =
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'

  if (canCopyImage) {
    try {
      const blob = await fetchAttachmentBlob(attachment.url)
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob }),
      ])
      return 'image'
    } catch {
      // Falls through to copying the URL instead.
    }
  }

  await navigator.clipboard.writeText(attachment.url)
  return 'url'
}
