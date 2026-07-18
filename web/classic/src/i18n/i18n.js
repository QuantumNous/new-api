/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en.json';
import frTranslation from './locales/fr.json';
import zhCNTranslation from './locales/zh-CN.json';
import zhTWTranslation from './locales/zh-TW.json';
import ruTranslation from './locales/ru.json';
import jaTranslation from './locales/ja.json';
import viTranslation from './locales/vi.json';
import { supportedLanguages } from './language';

// 默认简体中文：忽略 navigator；一次性迁移历史 en 缓存。
const I18N_STORAGE_KEY = 'i18nextLng';
const I18N_DEFAULT_ZH_MIGRATION_KEY = 'i18nDefaultZhCN.v1';
try {
  if (typeof localStorage !== 'undefined') {
    if (!localStorage.getItem(I18N_DEFAULT_ZH_MIGRATION_KEY)) {
      const cached = localStorage.getItem(I18N_STORAGE_KEY);
      if (
        !cached ||
        cached === 'en' ||
        String(cached).toLowerCase().startsWith('en-')
      ) {
        localStorage.setItem(I18N_STORAGE_KEY, 'zh-CN');
      }
      localStorage.setItem(I18N_DEFAULT_ZH_MIGRATION_KEY, '1');
    }
  }
} catch (e) {
  // ignore storage failures
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    load: 'currentOnly',
    supportedLngs: supportedLanguages,
    resources: {
      en: enTranslation,
      'zh-CN': zhCNTranslation,
      'zh-TW': zhTWTranslation,
      fr: frTranslation,
      ru: ruTranslation,
      ja: jaTranslation,
      vi: viTranslation,
    },
    fallbackLng: 'zh-CN',
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: I18N_STORAGE_KEY,
    },
  });

window.__i18n = i18n;

export default i18n;
