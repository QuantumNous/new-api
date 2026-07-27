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
import { fetchPlaygroundAssetBlob } from '../../api'
import type { ChatAttachment, Message } from '../../types'
import { needsAttachmentHydration } from './attachment-utils'

/**
 * Data URLs are stripped before the store is persisted, so a reloaded session
 * only carries asset ids. Cache the refetched bytes for the tab lifetime: every
 * later turn replays the same attachment.
 */
const dataUrlByAssetId = new Map<number, string>()

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)), {
      once: true,
    })
    reader.addEventListener('error', () => reject(reader.error), { once: true })
    reader.readAsDataURL(blob)
  })
}

export function rememberAttachmentAsset(
  assetId: number,
  dataUrl: string
): void {
  dataUrlByAssetId.set(assetId, dataUrl)
}

async function resolveAttachmentDataUrl(assetId: number): Promise<string> {
  const cached = dataUrlByAssetId.get(assetId)
  if (cached) return cached
  const dataUrl = await blobToDataUrl(await fetchPlaygroundAssetBlob(assetId))
  dataUrlByAssetId.set(assetId, dataUrl)
  return dataUrl
}

async function hydrateAttachment(
  attachment: ChatAttachment
): Promise<ChatAttachment> {
  if (!needsAttachmentHydration(attachment) || attachment.kind === 'document') {
    return attachment
  }
  try {
    return {
      ...attachment,
      dataUrl: await resolveAttachmentDataUrl(attachment.assetId as number),
    }
  } catch {
    // A missing or expired asset must not block the turn; the attachment falls
    // back to its extracted text, or is dropped by the payload filter.
    return attachment
  }
}

/**
 * Refill inline bytes for attachments restored from persistence, so a request
 * built after a page reload still carries the files the user attached.
 */
export async function hydrateMessageAttachments(
  messages: Message[]
): Promise<Message[]> {
  if (
    !messages.some((message) =>
      message.attachments?.some(needsAttachmentHydration)
    )
  ) {
    return messages
  }
  return Promise.all(
    messages.map(async (message) => {
      if (!message.attachments?.some(needsAttachmentHydration)) return message
      return {
        ...message,
        attachments: await Promise.all(
          message.attachments.map(hydrateAttachment)
        ),
      }
    })
  )
}
