/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import type { ChatDocumentAttachment, ChatImageAttachment } from '../../types'
import { buildMessageContent, createUserMessage } from './message-utils'

function imageAttachment(
  overrides: Partial<ChatImageAttachment> = {}
): ChatImageAttachment {
  return {
    id: 'i1',
    kind: 'image',
    name: 'shot.png',
    mimeType: 'image/png',
    dataUrl: 'data:image/png;base64,AAA',
    ...overrides,
  }
}

function documentAttachment(
  overrides: Partial<ChatDocumentAttachment> = {}
): ChatDocumentAttachment {
  return {
    id: 'd1',
    kind: 'document',
    name: 'report.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    text: 'Quarterly numbers\nRevenue up',
    ...overrides,
  }
}

describe('createUserMessage', () => {
  it('keeps parsed documents, which carry no binary payload', () => {
    const message = createUserMessage('summarize', 1, [documentAttachment()])
    expect(message.attachments).toEqual([documentAttachment()])
  })

  it('drops attachments with no usable payload at all', () => {
    const message = createUserMessage('hi', 1, [
      documentAttachment({ text: '  ' }),
      imageAttachment({ dataUrl: '' }),
    ])
    expect(message.attachments).toBeUndefined()
  })
})

describe('buildMessageContent', () => {
  it('returns plain text when no usable attachments exist', () => {
    expect(buildMessageContent('hi', [])).toBe('hi')
    expect(buildMessageContent('hi', [documentAttachment({ text: '' })])).toBe(
      'hi'
    )
  })

  it('emits images as image_url parts', () => {
    const parts = buildMessageContent('look', [imageAttachment()])
    expect(parts).toEqual([
      { type: 'text', text: 'look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    ])
  })

  it('emits parsed document text as a labeled text part', () => {
    const parts = buildMessageContent('summarize', [
      documentAttachment({ name: 'doc.pdf', text: 'page one' }),
    ])
    expect(parts).toEqual([
      { type: 'text', text: 'summarize' },
      { type: 'text', text: 'Attached document "doc.pdf":\n\npage one' },
    ])
  })

  it('drops an unreadable document instead of sending an empty part', () => {
    const parts = buildMessageContent('summarize', [
      documentAttachment({ text: '' }),
      imageAttachment(),
    ])
    expect(parts).toEqual([
      { type: 'text', text: 'summarize' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    ])
  })
})
