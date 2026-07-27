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
  if (attachment.dataUrl?.trim()) return true
  if (attachment.kind === 'file' && attachment.text?.trim()) return true
  return false
}

/**
 * Whether the attachment still means something after the tab is closed, i.e.
 * its payload can be rebuilt from the server or is text we already hold.
 */
export function isAttachmentPersistable(attachment: ChatAttachment): boolean {
  if (attachment.kind === 'document') return attachment.text.trim() !== ''
  if (attachment.assetId !== undefined) return true
  return attachment.kind === 'file' && (attachment.text?.trim() ?? '') !== ''
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
 * Attachments that need binary bytes fetched back before the next request.
 * A PDF headed for a model without document input is sent as its extracted
 * text, so refetching those bytes would only slow the turn down.
 */
export function needsAttachmentHydration(
  attachment: ChatAttachment,
  nativeFileInput = false
): boolean {
  if (attachment.kind === 'document') return false
  if (attachment.dataUrl?.trim()) return false
  if (attachment.assetId === undefined) return false
  if (attachment.kind === 'file' && !nativeFileInput) {
    return (attachment.text?.trim() ?? '') === ''
  }
  return true
}
