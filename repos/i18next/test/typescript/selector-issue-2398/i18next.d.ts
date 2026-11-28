import 'i18next';
import translation from './translation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      translation: typeof translation;
    };
    enableSelector: true;
    returnNull: false;
  }
}
