import 'i18next';
import ns1 from '../test.namespace.extra-large.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'ns1';
    contextSeparator: '|';
    enableSelector: 'optimize';
    resources: {
      ns1: typeof ns1;
    };
  }
}
