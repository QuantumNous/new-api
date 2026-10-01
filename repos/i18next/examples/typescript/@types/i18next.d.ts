import { resources, defaultNS, fallbackNS } from '../i18n/config.js';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    fallbackNS: typeof fallbackNS;
    resources: typeof resources.en;
  }
}
