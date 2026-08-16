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
import { MESSAGE_ROLES } from '../../constants'
import type {
  ImageGenerationResponse,
  Message,
  MessageAttachment,
} from '../../types'
import { completeAssistantMessage } from './message-streaming-utils'
import { getMessageContent, updateCurrentVersionContent } from './message-utils'

const GENERATED_IMAGE_MEDIA_TYPE = 'image/png'

/**
 * Convert an image generation response into message attachments. Providers
 * return either a hosted URL or base64 payload, so both are normalized here.
 */
export function toGeneratedImageAttachments(
  response: ImageGenerationResponse,
  prompt: string
): MessageAttachment[] {
  return (response.data ?? [])
    .map((item, index): MessageAttachment | null => {
      const url = item.url || toDataUrl(item.b64_json)

      if (!url) {
        return null
      }

      return {
        url,
        mediaType: GENERATED_IMAGE_MEDIA_TYPE,
        filename: buildImageFilename(prompt, index),
      }
    })
    .filter((attachment): attachment is MessageAttachment =>
      Boolean(attachment)
    )
}

/**
 * Attach generated images to an assistant message and mark it complete.
 */
export function applyGeneratedImages(
  message: Message,
  attachments: MessageAttachment[]
): Message {
  return completeAssistantMessage({
    ...updateCurrentVersionContent(message, ''),
    attachments,
  })
}

/**
 * Get the most recent user prompt, used as the image generation prompt.
 */
export function getLastUserPrompt(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.from === MESSAGE_ROLES.USER) {
      return getMessageContent(message)
    }
  }

  return ''
}

function toDataUrl(base64?: string): string | undefined {
  if (!base64) {
    return undefined
  }

  return `data:${GENERATED_IMAGE_MEDIA_TYPE};base64,${base64}`
}

function buildImageFilename(prompt: string, index: number): string {
  const normalized = prompt.trim().slice(0, 40) || 'image'
  return index === 0 ? normalized : `${normalized} (${index + 1})`
}
