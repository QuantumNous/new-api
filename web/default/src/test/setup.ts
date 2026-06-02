/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import '@testing-library/jest-dom/vitest'
import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ptBR from '@/i18n/locales/pt-BR.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zh from '@/i18n/locales/zh.json'

// Stub matchMedia for jsdom (some libs call it unconditionally).
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

/**
 * Build a fresh i18next instance from the real locale JSON files.
 * Returns a promise that resolves to the initialized instance.
 * Each test should call this for isolation; do not share the singleton.
 *
 * Resources are passed in their raw JSON shape (with the `translation`
 * namespace wrapper). i18next v26+ expects this and applies the
 * `translation` namespace automatically on lookup.
 */
export async function loadI18n(lng: string = 'en'): Promise<I18nInstance> {
  const instance = i18next.createInstance()
  await instance.use(initReactI18next).init({
    resources: {
      en: en as never,
      zh: zh as never,
      fr: fr as never,
      ja: ja as never,
      'pt-BR': ptBR as never,
      ru: ru as never,
      vi: vi as never,
    } as never,
    lng,
    fallbackLng: 'en',
    // Note: 'pt' is included (alongside 'pt-BR') to exercise language
    // normalization from 'pt' -> 'pt-BR' in tests. Production config.ts
    // exposes only 'pt-BR'; the i18n.next fallback resolves 'pt' to 'pt-BR'
    // through the pt-BR resources entry.
    supportedLngs: ['en', 'zh', 'fr', 'ja', 'pt-BR', 'pt', 'ru', 'vi'] as never,
    nsSeparator: false,
    interpolation: { escapeValue: false },
  } as never)
  return instance
}
