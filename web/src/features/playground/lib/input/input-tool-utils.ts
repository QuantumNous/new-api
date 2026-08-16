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
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input'

import type { MessageAttachment } from '../../types'

/**
 * Convert prompt input files into message attachments. Only images are kept:
 * models reached through the playground consume images as `image_url` parts and
 * would silently ignore other file types.
 */
export function toImageAttachments(
  files: PromptInputMessage['files']
): MessageAttachment[] {
  if (!files?.length) {
    return []
  }

  return files
    .filter((file) => Boolean(file.url) && isImageAttachment(file.mediaType))
    .map((file) => ({
      url: file.url,
      mediaType: file.mediaType,
      filename: file.filename,
    }))
}

export function countUnsupportedFiles(
  files: PromptInputMessage['files']
): number {
  if (!files?.length) {
    return 0
  }

  return files.filter((file) => !file.url || !isImageAttachment(file.mediaType))
    .length
}

function isImageAttachment(mediaType?: string): boolean {
  return Boolean(mediaType?.startsWith('image/'))
}
