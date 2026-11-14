import { resources, defaultNS } from '../i18n/config.js';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: typeof resources.en;
    enableSelector: true;
  }
}
