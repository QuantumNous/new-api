import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'legacy-only';
    resources: {
      'legacy-only': {
        greeting: 'Hello from legacy-only';
      };
    };
  }
}
