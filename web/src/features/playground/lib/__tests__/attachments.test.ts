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
import { describe, expect, it } from 'vitest'

import type { PromptInputMessage } from '@/components/ai-elements/prompt-input'

import {
  countUnsupportedFiles,
  toImageAttachments,
} from '../input/input-tool-utils'
import {
  createUserMessage,
  formatMessageForAPI,
} from '../message/message-utils'

describe('playground attachment conversion', () => {
  it('keeps image files with a resolved url', () => {
    const attachments = toImageAttachments([
      {
        type: 'file',
        filename: 'shot.png',
        mediaType: 'image/png',
        url: 'data:image/png;base64,AAA',
      },
    ])

    expect(attachments).toEqual([
      {
        url: 'data:image/png;base64,AAA',
        mediaType: 'image/png',
        filename: 'shot.png',
      },
    ])
  })

  it('drops non image files and reports them as unsupported', () => {
    const files: PromptInputMessage['files'] = [
      {
        type: 'file',
        filename: 'notes.pdf',
        mediaType: 'application/pdf',
        url: 'data:application/pdf;base64,AAA',
      },
      {
        type: 'file',
        filename: 'shot.png',
        mediaType: 'image/png',
        url: 'data:image/png;base64,BBB',
      },
    ]

    expect(toImageAttachments(files)).toHaveLength(1)
    expect(countUnsupportedFiles(files)).toBe(1)
  })

  it('returns no attachments when no files were submitted', () => {
    expect(toImageAttachments(undefined)).toEqual([])
    expect(countUnsupportedFiles(undefined)).toBe(0)
  })
})

describe('formatMessageForAPI with attachments', () => {
  it('builds multimodal content for user image attachments', () => {
    const message = createUserMessage('What is this?', 1, [
      { url: 'data:image/png;base64,AAA', mediaType: 'image/png' },
    ])

    expect(formatMessageForAPI(message)).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'What is this?' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,AAA' },
        },
      ],
    })
  })

  it('keeps plain string content when there are no attachments', () => {
    const message = createUserMessage('hello', 1)

    expect(formatMessageForAPI(message)).toEqual({
      role: 'user',
      content: 'hello',
    })
  })
})
