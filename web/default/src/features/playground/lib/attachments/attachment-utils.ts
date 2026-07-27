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
import type { ChatAttachment } from '../../types'

/**
 * Whether the attachment can still contribute a content part to a request.
 * Every stage that filters attachments must use this single predicate: the
 * variants carry their payload in different fields, and a field-specific check
 * silently drops whole attachment kinds.
 */
export function hasAttachmentPayload(attachment: ChatAttachment): boolean {
  if (attachment.kind === 'document') return attachment.text.trim() !== ''
  return Boolean(attachment.dataUrl?.trim())
}

/**
 * Whether the attachment still means something after the tab is closed, i.e.
 * its payload can be rebuilt from the server or is text we already hold.
 */
export function isAttachmentPersistable(attachment: ChatAttachment): boolean {
  if (attachment.kind === 'document') return attachment.text.trim() !== ''
  return attachment.assetId !== undefined
}

/**
 * Preview source for an image attachment. After a reload the inline bytes are
 * gone, so fall back to the same-origin asset route the browser can load with
 * the session cookie.
 */
export function attachmentPreviewSrc(
  attachment: ChatAttachment
): string | undefined {
  if (attachment.kind !== 'image') return undefined
  if (attachment.dataUrl?.trim()) return attachment.dataUrl
  if (attachment.assetId === undefined) return undefined
  return `/api/playground/assets/${attachment.assetId}/content`
}

/**
 * Images that need their bytes fetched back before the next request (after a
 * reload only the asset id survives). Documents never hydrate binary: only
 * their parsed text is ever sent.
 */
export function needsAttachmentHydration(attachment: ChatAttachment): boolean {
  if (attachment.kind !== 'image') return false
  if (attachment.dataUrl?.trim()) return false
  return attachment.assetId !== undefined
}
