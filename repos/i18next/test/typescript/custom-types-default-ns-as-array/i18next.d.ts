import 'i18next';

import {
  TestNamespaceContext,
  TestNamespacePlurals,
  TestNamespaceOrdinal,
  TestNamespaceCustom,
  TestNamespaceCustomAlternate,
  TestNamespaceFallback,
  TestNamespaceNonPlurals,
} from '../test.namespace.samples';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: Readonly<['custom', 'custom_b']>;
    fallbackNS: 'fallback';
    resources: {
      custom: TestNamespaceCustom;

      custom_b: {
        another_entry: 'Argh';
      };

      alternate: TestNamespaceCustomAlternate;

      fallback: TestNamespaceFallback;

      plurals: TestNamespacePlurals;

      nonPlurals: TestNamespaceNonPlurals;

      ctx: TestNamespaceContext;

      ord: TestNamespaceOrdinal;
    };
  }
}
