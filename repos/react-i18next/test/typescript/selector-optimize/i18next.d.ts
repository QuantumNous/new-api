import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';
    allowObjectInHTMLChildren: true;
    enableSelector: 'optimize';
    resources: {
      custom: {
        foo: 'foo';
        bar: 'bar';

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
