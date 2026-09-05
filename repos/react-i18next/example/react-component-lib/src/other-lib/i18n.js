import { createInstance } from 'i18next';

const i18n = createInstance({
  fallbackLng: 'en',
  debug: true,

  interpolation: {
    escapeValue: false, // not needed for react as it escapes by default
  },

  resources: {
    en: {
      translation: {
        hello: 'Hello from other i18n instance',
      },
    },
    de: {
      translation: {
        hello: 'Hallo aus einer anderen i18n Instanz',
      },
    },
  },
});

i18n.init();

export default i18n;
