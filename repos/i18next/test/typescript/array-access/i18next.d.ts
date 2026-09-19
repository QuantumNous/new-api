import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'prefix';
    resources: {
      main: {
        arrayOfStrings: ['zero', 'one'];
        readonlyArrayOfStrings: readonly ['readonly zero', 'readonly one'];
        arrayOfObjects: [
          { foo: 'bar' },
          { fizz: 'buzz' },
          [{ test: 'success'; sub: { deep: 'still success' } }],
        ];
      };

      ctx: {
        dessert: [
          {
            dessert_cake: 'a nice cake';
            dessert_muffin_one: 'a nice muffin';
            dessert_muffin_other: '{{count}} nice muffins';
          },
        ];
      };

      prefix: {
        deep: {
          deeper: {
            extra_deep: string;
          };
        };
      };

      ord: {
        list: [
          {
            place_ordinal_one: '1st place';
            place_ordinal_two: '2nd place';
            place_ordinal_few: '3rd place';
            place_ordinal_other: '{{count}}th place';
          },
        ];
      };
    };
  }
}
