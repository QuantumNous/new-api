import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-locize-backend';
import LastUsed from 'locize-lastused';
import { locizePlugin } from 'locize';

// OPTIONAL IF YOU LIKE TO SEE ALL (LOGIN TO TRANSLATION MANAGEMENT EDITOR)
// 1) signup at https://locize.com/register and login
// 2) create a new project
// 3) copy/paste your projectId, apiKey below
// 4) add de as additional language
// 5a) import en from: http://api.locize.app/ce0cf818-32e5-44a5-b7f0-4ea9e840d962/latest/en/translation
// 5b) import de from: http://api.locize.app/ce0cf818-32e5-44a5-b7f0-4ea9e840d962/latest/de/translation
const locizeOptions = {
  projectId: 'ce0cf818-32e5-44a5-b7f0-4ea9e840d962',
  apiKey: '5c2bbc21-027d-4f41-995a-e8beb451cdef', // YOU should not expose your apps API key to production!!!
  referenceLng: 'en',
};

i18n
  // i18next-locize-backend
  // loads translations from your project, saves new keys to it (saveMissing: true)
  // https://github.com/locize/i18next-locize-backend
  .use(Backend)
  // locize-lastused
  // sets a timestamp of last access on every translation segment on locize
  // -> safely remove the ones not being touched for weeks/months
  // https://github.com/locize/locize-lastused
  .use(LastUsed)
  // locize-editor
  // InContext Editor of locize
  .use(locizePlugin) // will show the incontext editor only if passing ?incontext=true
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: 'en',
    debug: true,
    saveMissing: true,
    // keySeparator: false,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    backend: locizeOptions,
    locizeLastUsed: locizeOptions,
    react: {
      bindI18n: 'languageChanged editorSaved',
    },
  });

export default i18n;
