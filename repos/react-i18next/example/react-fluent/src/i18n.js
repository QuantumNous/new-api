import i18n from 'i18next';
import Backend from 'i18next-fluent-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import Fluent from 'i18next-fluent';
i18n
  .use(Fluent)
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',

    // have a common namespace used around the full app
    ns: ['translations'],
    defaultNS: 'translations',

    debug: true,

    interpolation: {
      escapeValue: false, // not needed for react!!
    },

    // resources: { // or use inline resources
    //   en: {
    //     translations: {
    //       description_1: 'To get started, edit <1>src/App.js</1> and save to reload.',
    //       description_2: 'Switch language between english and german using buttons above.',
    //       emails: '{ $unreadEmails ->\n  [one] You have <1>one</1> unread email.\n *[other] You have <1>{ $unreadEmails }</1> unread emails.\n}',
    //       title: 'Welcome to react using react-i18next with fluent'
    //     }
    //   },
    //   de: {
    //     translations: {
    //       title: 'Willkommen zu react und react-i18next mit fluent',
    //       description_1: 'Um loszulegen, ändere <1>src/App(DE).js</1> speicheren und neuladen.',
    //       description_2: 'Ändere die Sprachen zwischen deutsch und englisch mit Hilfe der beiden Schalter.',
    //       emails: '{ $unreadEmails ->\n  [one] Du hast <1>eine</1> ungelesene Email.\n *[other] Du hast <1>{ $unreadEmails }</1> ungelesene Emails.\n}'
    //     }
    //   }
    // }
  });

export default i18n;
