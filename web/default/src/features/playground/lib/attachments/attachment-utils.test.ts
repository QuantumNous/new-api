/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import type { ChatDocumentAttachment, ChatImageAttachment } from '../../types'
import {
  hasAttachmentPayload,
  needsAttachmentHydration,
} from './attachment-utils'

const parsedDocument: ChatDocumentAttachment = {
  id: 'd1',
  kind: 'document',
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  text: 'page one',
  assetId: 4,
  status: 'done',
}

const restoredImage: ChatImageAttachment = {
  id: 'i1',
  kind: 'image',
  name: 'shot.png',
  mimeType: 'image/png',
  assetId: 5,
}

describe('needsAttachmentHydration', () => {
  it('never refetches documents: only their parsed text is sent', () => {
    expect(needsAttachmentHydration(parsedDocument)).toBe(false)
    expect(needsAttachmentHydration({ ...parsedDocument, text: '' })).toBe(
      false
    )
  })

  it('refetches images restored without inline bytes', () => {
    expect(needsAttachmentHydration(restoredImage)).toBe(true)
    expect(
      needsAttachmentHydration({
        ...restoredImage,
        dataUrl: 'data:image/png;base64,AAA',
      })
    ).toBe(false)
  })
})

describe('hasAttachmentPayload', () => {
  it('keeps a document only when its parsed text is non-empty', () => {
    expect(hasAttachmentPayload(parsedDocument)).toBe(true)
    expect(hasAttachmentPayload({ ...parsedDocument, text: '  ' })).toBe(false)
  })

  it('keeps an image only when inline bytes are present', () => {
    expect(hasAttachmentPayload(restoredImage)).toBe(false)
    expect(
      hasAttachmentPayload({
        ...restoredImage,
        dataUrl: 'data:image/png;base64,AAA',
      })
    ).toBe(true)
  })
})
