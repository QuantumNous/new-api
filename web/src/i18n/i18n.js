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
import { Modal } from '@douyinfe/semi-ui';

import enTranslation from './locales/en.json';
import frTranslation from './locales/fr.json';
import zhCNTranslation from './locales/zh-CN.json';
import zhTWTranslation from './locales/zh-TW.json';
import ruTranslation from './locales/ru.json';
import jaTranslation from './locales/ja.json';
import viTranslation from './locales/vi.json';
import { supportedLanguages } from './language';

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
    fallbackLng: {
      'zh-CN': ['zh-CN'],
      'zh-TW': ['zh-TW', 'zh-CN', 'en'],
      en: ['en'],
      fr: ['fr', 'en'],
      ru: ['ru', 'en'],
      ja: ['ja', 'en'],
      vi: ['vi', 'en'],
      default: ['en'],
    },
    returnEmptyString: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
  });

// Runtime safety net:
// for locales that do not normally use Han script, avoid mixed-language UI
// by preferring English when translation output still contains Han text or
// simply echoes the key.
const containsHan = /[\u4e00-\u9fff]/;
const hanGuardLocales = /^(en|fr|ru|vi)(-|$)/i;
const originalT = i18n.t.bind(i18n);
i18n.t = function patchedT(...args) {
  const result = originalT(...args);
  const key = args[0];
  const options = args[1];
  const currentLang = i18n.resolvedLanguage || i18n.language || '';
  const shouldGuardHan = hanGuardLocales.test(currentLang);
  const needsFallback =
    typeof key === 'string' &&
    typeof result === 'string' &&
    shouldGuardHan &&
    !/^zh(?:-|$)/i.test(currentLang) &&
    (result === key || containsHan.test(result));

  if (needsFallback) {
    const enResult = originalT(key, { ...(options || {}), lng: 'en' });
    if (
      typeof enResult === 'string' &&
      enResult !== key &&
      !containsHan.test(enResult)
    ) {
      return enResult;
    }
  }

  return result;
};

function getLocalizedModalConfig(config = {}, withCancel = true) {
  const normalizedConfig =
    config && typeof config === 'object' ? { ...config } : {};
  if (typeof normalizedConfig.okText !== 'string') {
    normalizedConfig.okText = i18n.t('确定');
  }
  const shouldSetCancelText = withCancel && normalizedConfig.hasCancel !== false;
  if (
    shouldSetCancelText &&
    typeof normalizedConfig.cancelText !== 'string'
  ) {
    normalizedConfig.cancelText = i18n.t('取消');
  }
  return normalizedConfig;
}

function patchSemiStaticModalI18n() {
  const patchFlag = '__newApiSemiStaticModalI18nPatched';
  if (globalThis[patchFlag]) {
    return;
  }
  globalThis[patchFlag] = true;

  const methods = [
    ['confirm', true],
    ['warning', true],
    ['error', true],
    ['info', true],
    ['success', true],
  ];

  methods.forEach(([methodName, withCancel]) => {
    const originalMethod = Modal?.[methodName];
    if (typeof originalMethod !== 'function') {
      return;
    }
    Modal[methodName] = (config = {}) =>
      originalMethod.call(Modal, getLocalizedModalConfig(config, withCancel));
  });
}

patchSemiStaticModalI18n();

window.__i18n = i18n;

export default i18n;
