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
import { ATTACHMENT_KINDS } from './attachment-constants'
import type { PlaygroundAttachment, ContentPart } from '../../types'

/**
 * The context wrapper Open WebUI wraps extracted document text in
 * (`RAG_TEMPLATE` in `backend/open_webui/config.py`), so models that were
 * tuned against that prompt keep behaving the same here.
 */
const DOCUMENT_CONTEXT_TEMPLATE = `<context>
{CONTEXT}
</context>`
const DOCUMENT_HEADER = '### Source: {NAME}'
const DOCUMENT_SOURCE_TEMPLATE = `<source>
{CONTENT}
</source>`

function formatDocumentContext(attachments: PlaygroundAttachment[]): string {
  const documents = attachments
    .filter(
      (attachment) =>
        attachment.kind === ATTACHMENT_KINDS.DOCUMENT && attachment.text?.trim()
    )
    .map((attachment) => {
      const header = DOCUMENT_HEADER.replace('{NAME}', attachment.filename)

      return `${header}\n${DOCUMENT_SOURCE_TEMPLATE.replace(
        '{CONTENT}',
        attachment.text?.trim() ?? ''
      )}`
    })

  return documents.join('\n\n')
}

/**
 * Build the `content` field for one chat message.
 *
 * Plain text stays a bare string so the request shape is unchanged for
 * attachment-free messages. Images become `image_url` parts (data URLs) and
 * every document's text is appended to the text part inside a `<context>`
 * block, exactly like Open WebUI's file handler does server-side.
 */
export function buildAttachedMessageContent(
  text: string,
  attachments: PlaygroundAttachment[] = []
): string | ContentPart[] {
  const images = attachments.filter(
    (attachment) =>
      attachment.kind === ATTACHMENT_KINDS.IMAGE && attachment.dataUrl
  )
  const documentContext = formatDocumentContext(attachments)
  const trimmedText = text.trim()
  const content = documentContext
    ? [
        trimmedText,
        DOCUMENT_CONTEXT_TEMPLATE.replace('{CONTEXT}', documentContext),
      ]
        .filter(Boolean)
        .join('\n\n')
    : trimmedText

  if (images.length === 0) {
    return content
  }

  return [
    { type: 'text', text: content },
    ...images.map((image) => ({
      type: 'image_url' as const,
      image_url: { url: image.dataUrl ?? '' },
    })),
  ]
}
