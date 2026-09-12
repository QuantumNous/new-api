import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'ctx';
    contextSeparator: '|';
    resources: {
      ctx: {
        beverage: 'beverage';
        'beverage|beer': 'beer';
        tea_one: 'a cuppa tea and a lie down';
        tea_other: '{{count}} cups of tea and a big sleep';
        'dessert|cake': 'a nice cake';
        'dessert|muffin_one': 'a nice muffin';
        'dessert|muffin_other': '{{count}} nice muffins';
        coffee: {
          drip: {
            black: 'a strong cup of black coffee';
          };
          bar: {
            shot: 'a shot of espresso';
            'espresso|americano': 'a hot americano';
            'espresso|latte_one': 'a foamy latte';
            'espresso|latte_other': '{{count}} foamy lattes';
            'espresso|cappuccino_one': 'a dry cappuccino';
            'espresso|cappuccino_other': '{{count}} dry cappuccinos';
          };
        };
        sodas: {
          coca_cola: {
            coke: 'a can of coke';
            'coke|diet_one': 'a can of diet coke';
            'coke|diet_other': '{{count}} cans of diet coke';
          };
          faygo: {
            purple: 'purple faygo';
            orange_one: 'one orange faygo';
            orange_other: '{{count}} orange faygo';
          };
        };
        array: [
          'element one',
          {
            elementTwo: 'element two';
          },
          {
            elementThree: [
              {
                nestedElementThree: 'element three';
              },
            ];
          },
        ];
      };
    };
  }
}
