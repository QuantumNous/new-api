/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import {
  MAX_DOCUMENT_TEXT_CHARS,
  isServerParsedDocument,
  isTextDocumentFile,
  truncateDocumentText,
} from './document-extract'

describe('attachment classification', () => {
  it('routes binary documents to the server parse pipeline', () => {
    for (const name of ['a.pdf', 'b.docx', 'c.xlsx', 'd.pptx']) {
      expect(isServerParsedDocument(new File([''], name))).toBe(true)
    }
    expect(
      isServerParsedDocument(
        new File([''], 'blob', { type: 'application/pdf' })
      )
    ).toBe(true)
  })

  it('reads plain-text files in the browser', () => {
    for (const name of ['d.md', 'e.csv', 'f.txt', 'g.json']) {
      expect(isTextDocumentFile(new File([''], name))).toBe(true)
    }
    expect(
      isTextDocumentFile(new File([''], 'noext', { type: 'text/plain' }))
    ).toBe(true)
  })

  it('rejects images and unknown binaries from both document paths', () => {
    const image = new File([''], 'a.png', { type: 'image/png' })
    const binary = new File([''], 'a.bin')
    expect(isServerParsedDocument(image)).toBe(false)
    expect(isServerParsedDocument(binary)).toBe(false)
    expect(isTextDocumentFile(image)).toBe(false)
    expect(isTextDocumentFile(binary)).toBe(false)
  })
})

describe('truncateDocumentText', () => {
  it('normalizes CRLF and trims', () => {
    expect(truncateDocumentText('a\r\nb\r\n')).toBe('a\nb')
  })

  it('caps oversized text with a truncation marker', () => {
    const result = truncateDocumentText('x'.repeat(MAX_DOCUMENT_TEXT_CHARS + 5))
    expect(result.length).toBeLessThanOrEqual(MAX_DOCUMENT_TEXT_CHARS + 20)
    expect(result.endsWith('…[truncated]')).toBe(true)
  })
})
