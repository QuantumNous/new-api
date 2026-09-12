import 'intl-pluralrules';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import RNLanguageDetector from '@os-team/i18next-react-native-language-detector';
import ChainedBackend from 'i18next-chained-backend';
import LocizeBackend from 'i18next-locize-backend';
import LocalStorageBackend from 'i18next-localstorage-backend';

i18n
  .use(ChainedBackend)
  .use(RNLanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    backend: {
      backends: [LocalStorageBackend, LocizeBackend],
      backendOptions: [
        {
          expirationTime: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
        {
          projectId: 'ce0cf818-32e5-44a5-b7f0-4ea9e840d962',
        },
      ],
    },
  });

export default i18n;
