import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';

    // We're mostly testing for setting returnNull and returnEmptyString to their non-default values
    returnNull: true;
    returnEmptyString: false;

    resources: {
      custom: {
        nullKey: null;
        'empty string with {{val}}': '';
      };
    };
  }
}
