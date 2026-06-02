/*
Copyright (C) 2023-2026 QuantumNous
*/
import { describe, expect, test } from 'vitest'
import { normalizeInterfaceLanguage } from '../languages'

describe('normalizeInterfaceLanguage (case-insensitive matching)', () => {
  test('returns canonical code for exact matches', () => {
    expect(normalizeInterfaceLanguage('en')).toBe('en')
    expect(normalizeInterfaceLanguage('pt')).toBe('pt')
    expect(normalizeInterfaceLanguage('zh')).toBe('zh')
  })

  test('returns canonical code for case-insensitive matches (i18next-style)', () => {
    // i18next's browser-languagedetector may store the language in mixed
    // case (e.g. 'Pt' or 'PT'); the function must resolve to the canonical
    // option code regardless of input casing.
    expect(normalizeInterfaceLanguage('PT')).toBe('pt')
    expect(normalizeInterfaceLanguage('Pt')).toBe('pt')
  })

  test('handles zh variants', () => {
    expect(normalizeInterfaceLanguage('zh-CN')).toBe('zh')
    expect(normalizeInterfaceLanguage('zh-TW')).toBe('zh')
    expect(normalizeInterfaceLanguage('ZH')).toBe('zh')
  })

  test('falls back to "en" for unknown languages', () => {
    expect(normalizeInterfaceLanguage('xx')).toBe('en')
    expect(normalizeInterfaceLanguage('klingon')).toBe('en')
  })

  test('handles empty / null / undefined', () => {
    expect(normalizeInterfaceLanguage()).toBe('en')
    expect(normalizeInterfaceLanguage(null)).toBe('en')
    expect(normalizeInterfaceLanguage(undefined)).toBe('en')
  })
})
