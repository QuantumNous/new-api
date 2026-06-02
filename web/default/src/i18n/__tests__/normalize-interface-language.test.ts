/*
Copyright (C) 2023-2026 QuantumNous
*/
import { describe, expect, test } from 'vitest'
import { normalizeInterfaceLanguage } from '../languages'

describe('normalizeInterfaceLanguage (case-insensitive matching for pt-BR)', () => {
  test('returns canonical code for exact matches', () => {
    expect(normalizeInterfaceLanguage('en')).toBe('en')
    expect(normalizeInterfaceLanguage('pt-BR')).toBe('pt-BR')
    expect(normalizeInterfaceLanguage('zh')).toBe('zh')
  })

  test('returns canonical code for case-insensitive matches (i18next-style)', () => {
    // i18next's browser-languagedetector stores 'pt-BR' (mixed case) but
    // the lowercased version 'pt-br' must also resolve to the canonical
    // 'pt-BR' option code.
    expect(normalizeInterfaceLanguage('PT-BR')).toBe('pt-BR')
    expect(normalizeInterfaceLanguage('pt-br')).toBe('pt-BR')
    expect(normalizeInterfaceLanguage('Pt-Br')).toBe('pt-BR')
  })

  test('returns canonical code for underscored variants', () => {
    expect(normalizeInterfaceLanguage('pt_BR')).toBe('pt-BR')
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
