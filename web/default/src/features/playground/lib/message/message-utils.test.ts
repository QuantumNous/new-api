/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import type {
  ChatDocumentAttachment,
  ChatFileAttachment,
  ChatImageAttachment,
} from '../../types'
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

function pdfAttachment(
  overrides: Partial<ChatFileAttachment> = {}
): ChatFileAttachment {
  return {
    id: 'f1',
    kind: 'file',
    name: 'doc.pdf',
    mimeType: 'application/pdf',
    dataUrl: 'data:application/pdf;base64,BBB',
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
  it('keeps extracted documents, which carry no binary payload', () => {
    const message = createUserMessage('summarize', 1, [documentAttachment()])
    expect(message.attachments).toEqual([documentAttachment()])
  })

  it('keeps a PDF restored without inline bytes but with extracted text', () => {
    const restored = pdfAttachment({
      dataUrl: undefined,
      assetId: 7,
      text: 'page one',
    })
    const message = createUserMessage('summarize', 1, [restored])
    expect(message.attachments).toEqual([restored])
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

  it('emits a native file part only for a model that reads documents', () => {
    const parts = buildMessageContent(
      'look',
      [imageAttachment(), pdfAttachment({ text: 'page one' })],
      true
    )
    expect(parts).toEqual([
      { type: 'text', text: 'look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
      {
        type: 'file',
        file: {
          filename: 'doc.pdf',
          file_data: 'data:application/pdf;base64,BBB',
        },
      },
    ])
  })

  it('defaults to extracted text, which every upstream accepts', () => {
    const parts = buildMessageContent('look', [
      pdfAttachment({ text: 'page one' }),
    ])
    expect(parts).toEqual([
      { type: 'text', text: 'look' },
      { type: 'text', text: 'Attached document "doc.pdf":\n\npage one' },
    ])
  })

  it('emits extracted document text as a labeled text part', () => {
    const parts = buildMessageContent('summarize', [documentAttachment()])
    expect(parts).toEqual([
      { type: 'text', text: 'summarize' },
      {
        type: 'text',
        text: 'Attached document "report.docx":\n\nQuarterly numbers\nRevenue up',
      },
    ])
  })

  it('sends a PDF as extracted text when the model has no file input', () => {
    const parts = buildMessageContent(
      'summarize',
      [pdfAttachment({ text: 'page one' })],
      false
    )
    expect(parts).toEqual([
      { type: 'text', text: 'summarize' },
      { type: 'text', text: 'Attached document "doc.pdf":\n\npage one' },
    ])
  })

  it('drops an unreadable PDF instead of sending a part the model rejects', () => {
    const parts = buildMessageContent('summarize', [pdfAttachment()], false)
    expect(parts).toEqual([{ type: 'text', text: 'summarize' }])
  })
})
