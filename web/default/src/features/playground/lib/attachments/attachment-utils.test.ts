/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import type { ChatFileAttachment, ChatImageAttachment } from '../../types'
import {
  hasAttachmentPayload,
  needsAttachmentHydration,
} from './attachment-utils'

const restoredPdf: ChatFileAttachment = {
  id: 'f1',
  kind: 'file',
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  assetId: 4,
}

const restoredImage: ChatImageAttachment = {
  id: 'i1',
  kind: 'image',
  name: 'shot.png',
  mimeType: 'image/png',
  assetId: 5,
}

describe('needsAttachmentHydration', () => {
  it('refetches a PDF only when the model reads documents natively', () => {
    const withText = { ...restoredPdf, text: 'page one' }
    expect(needsAttachmentHydration(withText, true)).toBe(true)
    expect(needsAttachmentHydration(withText, false)).toBe(false)
  })

  it('refetches a PDF with no extracted text so the model can still see it', () => {
    expect(needsAttachmentHydration(restoredPdf, true)).toBe(true)
    expect(needsAttachmentHydration(restoredPdf, false)).toBe(true)
  })

  it('always refetches images, which have no text representation', () => {
    expect(needsAttachmentHydration(restoredImage, false)).toBe(true)
    expect(
      needsAttachmentHydration({
        ...restoredImage,
        dataUrl: 'data:image/png;base64,AAA',
      })
    ).toBe(false)
  })
})

describe('hasAttachmentPayload', () => {
  it('keeps a PDF that only carries extracted text', () => {
    expect(hasAttachmentPayload({ ...restoredPdf, text: 'page one' })).toBe(
      true
    )
    expect(hasAttachmentPayload(restoredPdf)).toBe(false)
  })
})
