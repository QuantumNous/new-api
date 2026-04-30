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
import enCustom from './locales/custom/en.json';
import frCustom from './locales/custom/fr.json';
import zhCNCustom from './locales/custom/zh-CN.json';
import zhTWCustom from './locales/custom/zh-TW.json';
import ruCustom from './locales/custom/ru.json';
import jaCustom from './locales/custom/ja.json';
import viCustom from './locales/custom/vi.json';
import { supportedLanguages } from './language';

const merge = (base, custom) => ({
  translation: { ...base.translation, ...custom.translation },
});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    load: 'currentOnly',
    supportedLngs: supportedLanguages,
    resources: {
      en: merge(enTranslation, enCustom),
      'zh-CN': merge(zhCNTranslation, zhCNCustom),
      'zh-TW': merge(zhTWTranslation, zhTWCustom),
      fr: merge(frTranslation, frCustom),
      ru: merge(ruTranslation, ruCustom),
      ja: merge(jaTranslation, jaCustom),
      vi: merge(viTranslation, viCustom),
    },
    fallbackLng: 'zh-CN',
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
  });

window.__i18n = i18n;

export default i18n;
