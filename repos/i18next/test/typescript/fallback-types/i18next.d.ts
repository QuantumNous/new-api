import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';
    fallbackNS: ['fallback', 'fallback2'];
    resources: {
      custom: {
        bar: 'bar';
      };
      fallback: {
        fallbackKey: 'fallback';
      };
      fallback2: {
        anotherFallbackKey: 'fallback2';
      };
      alternate: {
        foobar: {
          barfoo: 'barfoo';
        };
      };
    };
  }
}
