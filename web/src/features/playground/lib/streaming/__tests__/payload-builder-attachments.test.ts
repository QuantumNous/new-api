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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildChatCompletionPayload } from '../payload-builder'
import { MESSAGE_ROLES, MESSAGE_STATUS } from '../../../constants'
import type {
  Message,
  ParameterEnabled,
  PlaygroundAttachment,
  PlaygroundConfig,
} from '../../../types'

const ALL_PARAMETERS_OFF: ParameterEnabled = {
  temperature: false,
  top_p: false,
  max_tokens: false,
  frequency_penalty: false,
  presence_penalty: false,
  seed: false,
}

const BASE_CONFIG: PlaygroundConfig = {
  model: 'gpt-test',
  group: '',
  temperature: 1,
  top_p: 1,
  max_tokens: 1024,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  stream: true,
}

function imageAttachment(
  overrides: Partial<PlaygroundAttachment> = {}
): PlaygroundAttachment {
  return {
    id: 'img-1',
    kind: 'image',
    filename: 'chart.png',
    mediaType: 'image/png',
    size: 128,
    dataUrl: 'data:image/png;base64,AAAA',
    ...overrides,
  }
}

function documentAttachment(
  overrides: Partial<PlaygroundAttachment> = {}
): PlaygroundAttachment {
  return {
    id: 'doc-1',
    kind: 'document',
    filename: 'report.pdf',
    mediaType: 'application/pdf',
    size: 512,
    text: 'Revenue grew by 12 percent.',
    ...overrides,
  }
}

function userMessage(
  content: string,
  attachments?: PlaygroundAttachment[]
): Message {
  return {
    key: 'k-1',
    from: MESSAGE_ROLES.USER,
    status: MESSAGE_STATUS.COMPLETE,
    versions: [{ id: 'v-1', content }],
    ...(attachments ? { attachments } : {}),
  }
}

describe('buildChatCompletionPayload attachments', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps plain string content when there are no attachments', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hello')],
      BASE_CONFIG,
      ALL_PARAMETERS_OFF
    )

    expect(payload.messages[0].content).toBe('hello')
  })

  it('sends images as OpenAI-style content parts', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('what is this?', [imageAttachment()])],
      BASE_CONFIG,
      ALL_PARAMETERS_OFF
    )

    const content = payload.messages[0].content as Array<{
      type: string
      [key: string]: unknown
    }>

    expect(Array.isArray(content)).toBe(true)
    expect(content).toContainEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AAAA' },
    })
    expect(content).toContainEqual({ type: 'text', text: 'what is this?' })
  })

  it('wraps document text in a labelled context block', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('summarise', [documentAttachment()])],
      BASE_CONFIG,
      ALL_PARAMETERS_OFF
    )

    const serialized = JSON.stringify(payload.messages[0].content)

    expect(serialized).toContain('report.pdf')
    expect(serialized).toContain('Revenue grew by 12 percent.')
    expect(serialized).toContain('summarise')
  })

  it('still sends an image-only message', () => {
    // The composer allows submitting with no typed text, so the payload must
    // carry the image parts even when `content` is empty.
    const payload = buildChatCompletionPayload(
      [userMessage('', [imageAttachment()])],
      BASE_CONFIG,
      ALL_PARAMETERS_OFF
    )

    expect(payload.messages).toHaveLength(1)

    const content = payload.messages[0].content as Array<{ type: string }>

    expect(content.some((part) => part.type === 'image_url')).toBe(true)
  })

  it('drops an attachment with neither image data nor text', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hello', [imageAttachment({ dataUrl: undefined })])],
      BASE_CONFIG,
      ALL_PARAMETERS_OFF
    )

    // Nothing usable to send, so the message degrades to plain text rather
    // than emitting an empty content-part array the API would reject.
    expect(payload.messages[0].content).toBe('hello')
  })

  it('puts the text prompt before the image parts', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('describe', [imageAttachment(), documentAttachment()])],
      BASE_CONFIG,
      ALL_PARAMETERS_OFF
    )

    const content = payload.messages[0].content as Array<{
      type: string
      text?: string
    }>

    // Text leads and carries the document context; images follow. This is the
    // order the OpenAI chat schema expects and what Open WebUI emits, so a
    // model sees the instruction before the pixels.
    expect(content[0].type).toBe('text')
    expect(content[0].text).toContain('describe')
    expect(content[0].text).toContain('report.pdf')
    expect(content.slice(1).every((part) => part.type === 'image_url')).toBe(
      true
    )
  })
})
