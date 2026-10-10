import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';
    allowObjectInHTMLChildren: true;
    enableSelector: true;
    resources: {
      custom: {
        foo: 'foo';
        bar: 'bar';
        title: 'Title: <strong>{{appName}}</strong>';

        some: 'some';
        some_me: 'some context';
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

      plurals: {
        foo_zero: 'foo';
        foo_one: 'foo';
        foo_two: 'foo';
        foo_many: 'foo';
        foo_other: 'foo';
      };

      context: {
        dessert_cake: 'a nice cake';
        dessert_muffin_one: 'a nice muffin';
        dessert_muffin_other: '{{count}} nice muffins';

        beverage: 'beverage';
        beverage_beer: 'beer';
      };
    };
  }
}
