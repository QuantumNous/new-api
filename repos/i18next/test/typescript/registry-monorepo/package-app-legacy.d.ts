import 'i18next';

// leaf app namespaces via legacy resources (one resources block for the whole app)
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      'app-feature': {
        landing_title: 'Welcome to the app';
      };
      overlap: {
        legacy_only: 'from legacy';
        shared_literal: 'same value';
        shared_conflict: 'A';
      };
    };
  }
}
