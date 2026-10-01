import 'i18next';

import {
  TestNamespaceCustom,
  TestNamespaceCustomAlternate,
  TestNamespaceFallback,
  TestNamespaceInterpolators,
} from '../test.namespace.samples';

declare module 'i18next' {
  interface CustomTypeOptions {
    strictKeyChecks: true;
    defaultNS: 'custom';
    fallbackNS: 'fallback';
    resources: {
      custom: TestNamespaceCustom;
      alternate: TestNamespaceCustomAlternate;
      fallback: TestNamespaceFallback;
      interpolators: TestNamespaceInterpolators;
      arrayKeys: {
        arrayOfStrings: ['zero', 'one'];
        readonlyArrayOfStrings: readonly ['readonly zero', 'readonly one'];
        arrayOfObjects: [
          { foo: 'bar' },
          { fizz: 'buzz' },
          [{ test: 'success'; sub: { deep: 'still success' } }],
        ];
      };
    };
  }
}
