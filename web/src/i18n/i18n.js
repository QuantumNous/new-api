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
import { normalizeLanguage, supportedLanguages } from './language';

const localeLoaders = {
  'zh-CN': () => import('./locales/zh-CN.json'),
  'zh-TW': () => import('./locales/zh-TW.json'),
  en: () => import('./locales/en.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
};

const defaultLanguage = 'zh-CN';
const loadedLanguages = new Set([defaultLanguage]);

async function ensureLanguageLoaded(language) {
  const normalizedLanguage = normalizeLanguage(language) || defaultLanguage;
  const targetLanguage = supportedLanguages.includes(normalizedLanguage)
    ? normalizedLanguage
    : defaultLanguage;

  if (loadedLanguages.has(targetLanguage)) {
    return;
  }

  const loader = localeLoaders[targetLanguage];
  if (!loader) {
    return;
  }

  const localeModule = await loader();
  const locale = localeModule.default || localeModule;
  i18n.addResourceBundle(targetLanguage, 'translation', locale, true, true);
  loadedLanguages.add(targetLanguage);
}

export const i18nReady = (async () => {
  const defaultLocaleModule = await localeLoaders[defaultLanguage]();
  const defaultLocale = defaultLocaleModule.default || defaultLocaleModule;

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      load: 'currentOnly',
      supportedLngs: supportedLanguages,
      resources: {
        'zh-CN': {
          translation: defaultLocale,
        },
      },
      fallbackLng: defaultLanguage,
      nsSeparator: false,
      interpolation: {
        escapeValue: false,
      },
    });

  i18n.on('languageChanged', (language) => {
    void ensureLanguageLoaded(language);
  });

  await ensureLanguageLoaded(i18n.language);
})();

export default i18n;
