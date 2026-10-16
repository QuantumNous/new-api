import 'i18next';

import {
  TestNamespaceContext,
  TestNamespacePlurals,
  TestNamespaceOrdinal,
  TestNamespaceCustom,
  TestNamespaceCustomAlternate,
  TestNamespaceFallback,
  TestNamespaceNonPlurals,
  TestNamespaceInterpolators,
  TestNamespaceContextAlternate,
} from '../test.namespace.samples';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';
    fallbackNS: 'fallback';
    resources: {
      custom: TestNamespaceCustom;

      alternate: TestNamespaceCustomAlternate;

      fallback: TestNamespaceFallback;

      ctx: TestNamespaceContext;
      ctxAlternate: TestNamespaceContextAlternate;

      plurals: TestNamespacePlurals;

      nonPlurals: TestNamespaceNonPlurals;

      ord: TestNamespaceOrdinal;

      interpolator: TestNamespaceInterpolators;
    };
  }
}
