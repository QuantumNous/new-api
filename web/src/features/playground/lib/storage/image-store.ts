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
import type { Message } from '../../types'
import {
  MAX_STORED_IMAGES_BYTES,
  MAX_STORED_IMAGE_BYTES,
} from './storage-schema'

export const IMAGE_REF_PREFIX = 'playground-image:'

export type ImageStore = Record<string, string>

export type ImageExtraction = {
  images: ImageStore
  messages: Message[]
}

function hashDataUrl(dataUrl: string): string {
  let hash = 5381
  for (let index = 0; index < dataUrl.length; index++) {
    hash = ((hash << 5) + hash + dataUrl.charCodeAt(index)) | 0
  }
  return `${(hash >>> 0).toString(36)}-${dataUrl.length.toString(36)}`
}

export function isImageRef(url: string): boolean {
  return url.startsWith(IMAGE_REF_PREFIX)
}

function toImageRef(id: string): string {
  return `${IMAGE_REF_PREFIX}${id}`
}

function fromImageRef(url: string): string {
  return url.slice(IMAGE_REF_PREFIX.length)
}

/**
 * Move inline (data URL) attachments into a separate image store so that
 * uploaded and generated images survive a reload without duplicating megabytes
 * of base64 inside every stored message.
 *
 * Newest messages win: once the image budget is exhausted, older images are
 * dropped from the persisted copy (in-memory messages are untouched).
 */
export function extractInlineImages(messages: Message[]): ImageExtraction {
  const images: ImageStore = {}
  let usedBytes = 0

  const rewritten = [...messages].reverse().map((message) => {
    if (!message.attachments?.length) {
      return message
    }

    let changed = false
    const attachments = message.attachments.flatMap((attachment) => {
      if (!attachment.url.startsWith('data:')) {
        return [attachment]
      }

      changed = true

      if (attachment.url.length > MAX_STORED_IMAGE_BYTES) {
        return []
      }

      const id = hashDataUrl(attachment.url)
      if (!(id in images)) {
        if (usedBytes + attachment.url.length > MAX_STORED_IMAGES_BYTES) {
          return []
        }
        images[id] = attachment.url
        usedBytes += attachment.url.length
      }

      return [{ ...attachment, url: toImageRef(id) }]
    })

    if (!changed) {
      return message
    }

    return {
      ...message,
      attachments: attachments.length > 0 ? attachments : undefined,
    }
  })

  return { images, messages: rewritten.reverse() }
}

/**
 * Resolve stored image references back to their data URLs, dropping references
 * whose image is no longer available.
 */
export function resolveInlineImages(
  messages: Message[],
  images: ImageStore
): Message[] {
  return messages.map((message) => {
    if (
      !message.attachments?.some((attachment) => isImageRef(attachment.url))
    ) {
      return message
    }

    const attachments = message.attachments.flatMap((attachment) => {
      if (!isImageRef(attachment.url)) {
        return [attachment]
      }

      const url = images[fromImageRef(attachment.url)]
      return url ? [{ ...attachment, url }] : []
    })

    return {
      ...message,
      attachments: attachments.length > 0 ? attachments : undefined,
    }
  })
}

/**
 * Drop every inline image reference, used as a fallback when the browser
 * refuses to store the image payload (quota exceeded).
 */
export function stripImageRefs(messages: Message[]): Message[] {
  return resolveInlineImages(messages, {})
}
