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
import zhCNTranslation from './locales/zh-CN.json';
import zhTWTranslation from './locales/zh-TW.json';
import idTranslation from './locales/id.json';
import koTranslation from './locales/ko.json';
import esTranslation from './locales/es.json';
import ruTranslation from './locales/ru.json';
import viTranslation from './locales/vi.json';
import { apimasterLocaleMap, normalizeLanguage, supportedLanguages } from './language';

const APIMASTER_STORAGE_KEY = 'apimaster-locale';

const resolveStoredApimasterLanguage = () => {
  try {
    const locale = localStorage.getItem(APIMASTER_STORAGE_KEY);
    return locale ? apimasterLocaleMap[locale] : undefined;
  } catch (e) {
    return undefined;
  }
};

const apimasterLanguage = resolveStoredApimasterLanguage();

const applyLanguage = (language) => {
  const normalized = normalizeLanguage(language);
  if (!supportedLanguages.includes(normalized)) {
    return;
  }

  localStorage.setItem('i18nextLng', normalized);
  if (i18n.resolvedLanguage !== normalized && i18n.language !== normalized) {
    i18n.changeLanguage(normalized);
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    load: 'currentOnly',
    supportedLngs: supportedLanguages,
    ...(apimasterLanguage ? { lng: apimasterLanguage } : {}),
    resources: {
      en: enTranslation,
      'zh-CN': zhCNTranslation,
      'zh-TW': zhTWTranslation,
      id: idTranslation,
      ko: koTranslation,
      es: esTranslation,
      ru: ruTranslation,
      vi: viTranslation,
    },
    fallbackLng: 'zh-CN',
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
  });

window.__i18n = i18n;

window.addEventListener('storage', (event) => {
  if (event.key === APIMASTER_STORAGE_KEY && event.newValue) {
    applyLanguage(event.newValue);
  }
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.type === 'apimaster-locale') {
    applyLanguage(data.locale);
  }

  if (data.lang) {
    applyLanguage(data.lang);
  }
});

export default i18n;
