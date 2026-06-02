/*
Copyright (C) 2023-2026 QuantumNous

Verifies that i18next's region-less fallback resolves to the canonical
'pt' entry. This is the explicit test of the fallback machinery described
in src/i18n/config.ts (supportedLngs includes 'pt').
*/
import { describe, expect, test } from 'vitest'
import { loadI18n } from '../../test/setup'

describe('i18next fallback resolves region-less codes to canonical', () => {
  test('changeLanguage("pt") lands on "pt" exactly (no lowercasing)', async () => {
    const i18n = await loadI18n('en')
    await i18n.changeLanguage('pt')
    expect(i18n.language).toBe('pt')
  })

  test('loadI18n("pt") lands on "pt" exactly', async () => {
    const i18n = await loadI18n('pt')
    expect(i18n.language).toBe('pt')
  })
})
