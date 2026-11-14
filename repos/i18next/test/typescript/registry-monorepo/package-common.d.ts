import 'i18next';

// second package, second file — would be TS2717 on CustomTypeOptions.resources
declare module 'i18next' {
  interface ResourceNamespaceMap {
    common: {
      hello: 'Hello {{name}}';
      farewell: 'Goodbye';
    };
  }

  interface CustomTypeOptions {
    defaultNS: 'common';
  }
}
