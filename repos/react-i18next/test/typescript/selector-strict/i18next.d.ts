import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';
    allowObjectInHTMLChildren: true;
    enableSelector: 'strict';
    resources: {
      custom: {
        foo: 'foo';
        bar: 'bar';
      };

      alternate: {
        baz: 'baz';
        foobar: {
          barfoo: 'barfoo';
          deep: {
            deeper: {
              deeeeeper: 'foobar';
            };
          };
        };
      };
    };
  }
}
