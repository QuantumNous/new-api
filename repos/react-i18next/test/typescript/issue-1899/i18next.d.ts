import 'i18next';

/**
 * Issue #1899: Type errors when custom resources are declared
 * https://github.com/i18next/react-i18next/issues/1899
 *
 * This configuration reproduces the bug where declaring custom resources
 * causes type errors in IcuTrans type definitions.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'app';
    resources: {
      app: { foo: string; bar: string };
    };
  }
}
