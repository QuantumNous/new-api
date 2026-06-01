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

export const supportedLanguages = [
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'id',
  'ko',
  'es',
  'ru',
  'vi',
];

export const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'id', label: 'Bahasa' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
  { value: 'vi', label: 'Tiếng Việt' },
];

export const apimasterLocaleMap = {
  zh: 'zh-CN',
  'zh-tw': 'zh-TW',
  en: 'en',
  ja: 'ja',
  id: 'id',
  ko: 'ko',
  es: 'es',
  ru: 'ru',
  vi: 'vi',
};

export const normalizeLanguage = (language) => {
  if (!language) {
    return language;
  }

  const normalized = language.trim().replace(/_/g, '-');
  const lower = normalized.toLowerCase();

  if (apimasterLocaleMap[lower]) {
    return apimasterLocaleMap[lower];
  }

  if (
    lower === 'zh' ||
    lower === 'zh-cn' ||
    lower === 'zh-sg' ||
    lower.startsWith('zh-hans')
  ) {
    return 'zh-CN';
  }

  if (
    lower === 'zh-tw' ||
    lower === 'zh-hk' ||
    lower === 'zh-mo' ||
    lower.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }

  if (lower.startsWith('en')) {
    return 'en';
  }

  if (lower.startsWith('ja')) {
    return 'ja';
  }

  if (lower === 'id' || lower.startsWith('id-') || lower === 'in' || lower.startsWith('in-')) {
    return 'id';
  }

  if (lower.startsWith('ko')) {
    return 'ko';
  }

  if (lower.startsWith('es')) {
    return 'es';
  }

  if (lower.startsWith('ru')) {
    return 'ru';
  }

  if (lower.startsWith('vi')) {
    return 'vi';
  }

  const matchedLanguage = supportedLanguages.find(
    (supportedLanguage) => supportedLanguage.toLowerCase() === lower,
  );

  return matchedLanguage || normalized;
};
