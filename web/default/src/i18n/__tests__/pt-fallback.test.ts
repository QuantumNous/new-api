/*
Copyright (C) 2023-2026 QuantumNous

Verifies that i18next's fallback resolves region-less codes to the
canonical entry the test setup registers. This was the implicit reason
'pt' was originally listed in supportedLngs; the correct behavior is
that 'pt' (without region) should resolve to 'pt-BR' through i18next's
built-in fallback machinery, NOT by adding 'pt' to supportedLngs
(which would diverge from production config.ts).
*/
import { describe, expect, test } from 'vitest'
import { loadI18n } from '../../test/setup'

describe('i18next fallback resolves region-less codes to canonical', () => {
  test('changeLanguage("pt") resolves to "pt-BR" through the fallback', async () => {
    const i18n = await loadI18n('en')
    await i18n.changeLanguage('pt')
    // i18next's fallback (nonExplicitSupportedLngs) maps 'pt' -> 'pt-BR'
    // because the 'pt-BR' resources entry exists and is the best match.
    expect(i18n.language.toLowerCase()).toBe('pt-br')
  })

  test('loadI18n("pt-BR") lands on "pt-BR" exactly (no lowercasing)', async () => {
    const i18n = await loadI18n('pt-BR')
    expect(i18n.language).toBe('pt-BR')
  })

  test('changeLanguage("PT-br") (mixed case) resolves to "pt-BR"', async () => {
    const i18n = await loadI18n('en')
    await i18n.changeLanguage('PT-br')
    expect(i18n.language.toLowerCase()).toBe('pt-br')
  })
})
