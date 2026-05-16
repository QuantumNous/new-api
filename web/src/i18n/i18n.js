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
import { supportedLanguages } from './language';

// English
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enAuth from './locales/en/auth.json';
import enSettings from './locales/en/settings.json';
import enTokens from './locales/en/tokens.json';
import enChannels from './locales/en/channels.json';
import enModels from './locales/en/models.json';
import enBilling from './locales/en/billing.json';
import enGroups from './locales/en/groups.json';
import enAdmin from './locales/en/admin.json';

// 简体中文
import zhCNCommon from './locales/zh-CN/common.json';
import zhCNHome from './locales/zh-CN/home.json';
import zhCNAuth from './locales/zh-CN/auth.json';
import zhCNSettings from './locales/zh-CN/settings.json';
import zhCNTokens from './locales/zh-CN/tokens.json';
import zhCNChannels from './locales/zh-CN/channels.json';
import zhCNModels from './locales/zh-CN/models.json';
import zhCNBilling from './locales/zh-CN/billing.json';
import zhCNGroups from './locales/zh-CN/groups.json';
import zhCNAdmin from './locales/zh-CN/admin.json';

// 繁體中文
import zhTWCommon from './locales/zh-TW/common.json';
import zhTWHome from './locales/zh-TW/home.json';
import zhTWAuth from './locales/zh-TW/auth.json';
import zhTWSettings from './locales/zh-TW/settings.json';
import zhTWTokens from './locales/zh-TW/tokens.json';
import zhTWChannels from './locales/zh-TW/channels.json';
import zhTWModels from './locales/zh-TW/models.json';
import zhTWBilling from './locales/zh-TW/billing.json';
import zhTWGroups from './locales/zh-TW/groups.json';
import zhTWAdmin from './locales/zh-TW/admin.json';

// Français
import frCommon from './locales/fr/common.json';
import frHome from './locales/fr/home.json';
import frAuth from './locales/fr/auth.json';
import frSettings from './locales/fr/settings.json';
import frTokens from './locales/fr/tokens.json';
import frChannels from './locales/fr/channels.json';
import frModels from './locales/fr/models.json';
import frBilling from './locales/fr/billing.json';
import frGroups from './locales/fr/groups.json';
import frAdmin from './locales/fr/admin.json';

// 日本語
import jaCommon from './locales/ja/common.json';
import jaHome from './locales/ja/home.json';
import jaAuth from './locales/ja/auth.json';
import jaSettings from './locales/ja/settings.json';
import jaTokens from './locales/ja/tokens.json';
import jaChannels from './locales/ja/channels.json';
import jaModels from './locales/ja/models.json';
import jaBilling from './locales/ja/billing.json';
import jaGroups from './locales/ja/groups.json';
import jaAdmin from './locales/ja/admin.json';

// Русский
import ruCommon from './locales/ru/common.json';
import ruHome from './locales/ru/home.json';
import ruAuth from './locales/ru/auth.json';
import ruSettings from './locales/ru/settings.json';
import ruTokens from './locales/ru/tokens.json';
import ruChannels from './locales/ru/channels.json';
import ruModels from './locales/ru/models.json';
import ruBilling from './locales/ru/billing.json';
import ruGroups from './locales/ru/groups.json';
import ruAdmin from './locales/ru/admin.json';

// Tiếng Việt
import viCommon from './locales/vi/common.json';
import viHome from './locales/vi/home.json';
import viAuth from './locales/vi/auth.json';
import viSettings from './locales/vi/settings.json';
import viTokens from './locales/vi/tokens.json';
import viChannels from './locales/vi/channels.json';
import viModels from './locales/vi/models.json';
import viBilling from './locales/vi/billing.json';
import viGroups from './locales/vi/groups.json';
import viAdmin from './locales/vi/admin.json';

function merge(...objs) {
  return Object.assign({}, ...objs);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    load: 'currentOnly',
    supportedLngs: supportedLanguages,
    resources: {
      en: { translation: merge(enCommon, enHome, enAuth, enSettings, enTokens, enChannels, enModels, enBilling, enGroups, enAdmin) },
      'zh-CN': { translation: merge(zhCNCommon, zhCNHome, zhCNAuth, zhCNSettings, zhCNTokens, zhCNChannels, zhCNModels, zhCNBilling, zhCNGroups, zhCNAdmin) },
      'zh-TW': { translation: merge(zhTWCommon, zhTWHome, zhTWAuth, zhTWSettings, zhTWTokens, zhTWChannels, zhTWModels, zhTWBilling, zhTWGroups, zhTWAdmin) },
      fr: { translation: merge(frCommon, frHome, frAuth, frSettings, frTokens, frChannels, frModels, frBilling, frGroups, frAdmin) },
      ru: { translation: merge(ruCommon, ruHome, ruAuth, ruSettings, ruTokens, ruChannels, ruModels, ruBilling, ruGroups, ruAdmin) },
      ja: { translation: merge(jaCommon, jaHome, jaAuth, jaSettings, jaTokens, jaChannels, jaModels, jaBilling, jaGroups, jaAdmin) },
      vi: { translation: merge(viCommon, viHome, viAuth, viSettings, viTokens, viChannels, viModels, viBilling, viGroups, viAdmin) },
    },
    fallbackLng: 'en',
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
  });

window.__i18n = i18n;

export default i18n;
