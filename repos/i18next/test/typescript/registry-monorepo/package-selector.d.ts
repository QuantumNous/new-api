import 'i18next';

// enableSelector is isolated in tsconfig.selector.json so string-key t() tests stay valid.
declare module 'i18next' {
  interface CustomTypeOptions {
    enableSelector: true;
  }
}
