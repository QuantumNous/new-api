import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 一期纯中文：classic 复用代码里 t() 的 key 即中文原文，
// 空 resources 下 i18next 直接回显 key，无需任何语言包。
i18n.use(initReactI18next).init({
  lng: 'zh-CN',
  fallbackLng: false,
  resources: {},
  nsSeparator: false,
  keySeparator: false,
  returnEmptyString: false,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
